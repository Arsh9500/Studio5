import os
import json

import requests

DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


def _extract_json_block(text):
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        candidate = cleaned[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return None
    return None


def gemini_is_configured():
    # Keep legacy function name because other modules import it.
    return bool(os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY"))


def generate_travel_reply(message, context=None):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured on the backend.")

    prompt = build_travel_prompt(message, context or {})
    endpoint = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": DEFAULT_GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a friendly travel assistant for a travel planning app. "
                    "Be concise, practical, and welcoming. "
                    "When you are unsure, say so clearly. "
                    "Do not invent live hotel listings, attraction details, or ratings."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        "temperature": 0.7,
        "max_tokens": 600,
    }

    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "TravelPlannerApp/1.0",
            },
            timeout=20,
        )
        response.raise_for_status()
        body = response.json()
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"Groq request failed: {exc.response.text or str(exc)}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError("Groq could not be reached from the backend.") from exc

    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no response.")

    text = (choices[0].get("message") or {}).get("content", "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty reply.")

    return text.strip()


def generate_budget_reply(destination, days, total_budget, currency="USD"):
    api_key = os.getenv("GROQ_BUDGET_API_KEY") or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_BUDGET_API_KEY (or GROQ_API_KEY) is not configured on the backend.")

    model = os.getenv("GROQ_BUDGET_MODEL") or os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL
    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    daily_budget = round(float(total_budget) / max(int(days), 1), 2)

    user_prompt = (
        "Create a realistic travel budget plan using this input:\n"
        f"- Destination: {destination}\n"
        f"- Trip length: {days} days\n"
        f"- Total budget: {total_budget} {currency}\n"
        f"- Daily budget target: {daily_budget} {currency}\n"
        "Be destination-aware: use local cost patterns for this specific city/region (do not reuse generic values).\n"
        "Return ONLY valid JSON with this schema:\n"
        "{\n"
        '  "destinationSummary": "short destination-specific planning note",\n'
        '  "breakdown": {\n'
        '    "hotel": number,\n'
        '    "food": number,\n'
        '    "transport": number,\n'
        '    "activities": number,\n'
        '    "misc": number,\n'
        '    "total": number\n'
        "  },\n"
        '  "tips": ["tip1", "tip2", "tip3"]\n'
        "}\n"
        "Rules: use numbers only (no currency symbols), keep tips practical and destination-specific, make totals coherent, and avoid repeating identical breakdowns across different destinations."
    )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a travel budget planner. Return strict JSON only.",
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "temperature": 0.4,
        "max_tokens": 700,
        "response_format": {"type": "json_object"},
    }

    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "TravelPlannerBudget/1.0",
            },
            timeout=25,
        )
        response.raise_for_status()
        body = response.json()
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"Groq budget request failed: {exc.response.text or str(exc)}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError("Groq budget service could not be reached from the backend.") from exc

    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Groq budget service returned no response.")

    raw_text = (choices[0].get("message") or {}).get("content", "").strip()
    if not raw_text:
        raise RuntimeError("Groq budget service returned an empty reply.")

    parsed = _extract_json_block(raw_text)
    if not isinstance(parsed, dict):
        retry_payload = {
            **payload,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": "Return only strict JSON object. No prose, no markdown.",
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
        }
        try:
            retry_response = requests.post(
                endpoint,
                json=retry_payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "TravelPlannerBudget/1.0",
                },
                timeout=25,
            )
            retry_response.raise_for_status()
            retry_body = retry_response.json()
            retry_choices = retry_body.get("choices") or []
            retry_text = ((retry_choices[0].get("message") or {}).get("content", "").strip() if retry_choices else "")
            parsed = _extract_json_block(retry_text)
        except requests.exceptions.RequestException as exc:
            raise RuntimeError("Groq budget service retry failed.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("Groq budget service returned non-JSON content.")

    breakdown = parsed.get("breakdown") or {}
    hotel = max(0.0, float(breakdown.get("hotel") or 0))
    food = max(0.0, float(breakdown.get("food") or 0))
    transport = max(0.0, float(breakdown.get("transport") or 0))
    activities = max(0.0, float(breakdown.get("activities") or 0))
    misc = max(0.0, float(breakdown.get("misc") or 0))
    components_total = hotel + food + transport + activities + misc

    # Keep AI output aligned with user budget while preserving relative category proportions.
    min_target = float(total_budget) * 0.8
    max_target = float(total_budget) * 1.05
    normalized_total = float(breakdown.get("total") or components_total or 0)
    if normalized_total <= 0:
        normalized_total = components_total

    if components_total <= 0:
        # Safe fallback when model returns zeros.
        hotel = float(total_budget) * 0.42
        food = float(total_budget) * 0.24
        transport = float(total_budget) * 0.12
        activities = float(total_budget) * 0.16
        misc = float(total_budget) * 0.06
        components_total = hotel + food + transport + activities + misc

    target_total = max(min(components_total, max_target), min_target)
    if components_total > 0 and abs(target_total - components_total) > 1:
        scale = target_total / components_total
        hotel *= scale
        food *= scale
        transport *= scale
        activities *= scale
        misc *= scale
        components_total = hotel + food + transport + activities + misc

    summary = str(parsed.get("destinationSummary") or "").strip()
    if summary and destination.lower() not in summary.lower():
        summary = f"{destination}: {summary}"

    result = {
        "destinationSummary": summary,
        "breakdown": {
            "hotel": round(hotel, 2),
            "food": round(food, 2),
            "transport": round(transport, 2),
            "activities": round(activities, 2),
            "misc": round(misc, 2),
            "total": round(components_total, 2),
        },
        "tips": [str(t).strip() for t in (parsed.get("tips") or []) if str(t).strip()][:5],
    }

    return result


def build_travel_prompt(message, context):
    latest_booking = context.get("latestBooking") or {}
    latest_destination = latest_booking.get("destination") or context.get("selectedDestination") or ""

    prompt_sections = [
        f"User message: {message}",
        "App context:",
        f"- Latest booking destination: {latest_destination or 'None'}",
        f"- Latest booking hotel: {latest_booking.get('hotelName') or 'None'}",
        "Please answer like a helpful travel assistant.",
    ]

    return "\n".join(prompt_sections)
