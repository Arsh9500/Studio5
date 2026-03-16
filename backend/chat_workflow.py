from gemini_service import generate_travel_reply, gemini_is_configured
from places_service import get_place_details, places_is_configured, search_places


def handle_chat_message(message, context=None):
    text = (message or "").strip()
    if not text:
        raise ValueError("message is required")

    context = context or {}
    search_type = classify_search_type(text)
    use_places = should_use_places(text, search_type)

    if use_places:
        if not places_is_configured():
            raise ValueError("Google Places is not configured on the backend.")

        if search_type == "place_details" and context.get("selectedPlaceId"):
            place = get_place_details(context["selectedPlaceId"])
            return {
                "mode": "places",
                "reply": f"Here are the live details for {place['name']}.",
                "places": [place],
                "searchType": search_type,
            }

        result = search_places(text, search_type, context=context)
        result["mode"] = "places"
        return result

    if not gemini_is_configured():
        raise ValueError("Gemini is not configured on the backend.")

    reply = generate_travel_reply(text, context=context)
    return {
        "mode": "gemini",
        "reply": reply,
        "places": [],
        "searchType": search_type,
    }


def classify_search_type(message):
    text = message.lower()

    if "near my hotel" in text or "nearby" in text or "near me" in text:
        return "nearby"
    if "hotel" in text or "stay" in text or "accommodation" in text:
        return "hotels"
    if "tourist place" in text or "attraction" in text or "things to do" in text:
        return "attractions"
    if "place detail" in text or "details for" in text:
        return "place_details"
    if "place" in text or "destination" in text:
        return "places"
    return "general"


def should_use_places(message, search_type):
    text = message.lower()
    lookup_words = ["find", "show", "search", "near", "rating", "address", "map", "where is"]
    if search_type in {"hotels", "attractions", "nearby", "place_details"}:
        return True
    return any(word in text for word in lookup_words) and search_type == "places"
