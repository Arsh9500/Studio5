import json
import os
from urllib import error, request
from env_config import load_env_files


load_env_files()


DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def gemini_is_configured():
    return bool(os.getenv("GEMINI_API_KEY"))


def generate_travel_reply(message, context=None):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
      raise ValueError("GEMINI_API_KEY is not configured on the backend.")

    prompt = build_travel_prompt(message, context or {})
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{DEFAULT_GEMINI_MODEL}:generateContent?key={api_key}"
    )
    payload = {
        "system_instruction": {
            "parts": [
                {
                    "text": (
                        "You are a friendly travel assistant for a travel planning app. "
                        "Be concise, practical, and welcoming. "
                        "When you are unsure, say so clearly. "
                        "Do not invent live hotel listings, attraction details, or ratings."
                    )
                }
            ]
        },
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "maxOutputTokens": 600,
        },
    }

    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Gemini request failed: {error_body or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("Gemini could not be reached from the backend.") from exc

    candidates = body.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no response.")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "").strip() for part in parts if part.get("text"))
    if not text:
        raise RuntimeError("Gemini returned an empty reply.")

    return text.strip()


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
