import json
import os
from urllib import error, parse, request


GOOGLE_PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"


def places_is_configured():
    return bool(os.getenv("GOOGLE_PLACES_API_KEY"))


def search_places(message, search_type, context=None):
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured on the backend.")

    context = context or {}
    query = build_places_query(message, search_type, context)
    raw_results = request_json(
        GOOGLE_PLACES_TEXT_SEARCH_URL,
        {
            "query": query,
            "key": api_key,
        },
    )

    results = raw_results.get("results") or []
    if not results:
        return {
            "reply": "I could not find live place results for that request right now.",
            "places": [],
            "searchType": search_type,
        }

    places = [normalize_place_result(item, api_key) for item in results[:6]]
    reply = build_places_reply(search_type, query, places)
    return {
        "reply": reply,
        "places": places,
        "searchType": search_type,
        "query": query,
    }


def get_place_details(place_id):
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured on the backend.")

    data = request_json(
        GOOGLE_PLACES_DETAILS_URL,
        {
            "place_id": place_id,
            "fields": "name,formatted_address,rating,geometry,photos,url,website,formatted_phone_number",
            "key": api_key,
        },
    )
    result = data.get("result") or {}
    if not result:
        raise RuntimeError("No place details were returned.")

    return normalize_place_result(result, api_key)


def build_places_query(message, search_type, context):
    text = message.strip()
    latest_booking = context.get("latestBooking") or {}
    destination = latest_booking.get("destination") or context.get("selectedDestination") or ""

    if search_type == "nearby":
        anchor = latest_booking.get("hotelName") or destination or "the user's hotel"
        return f"tourist attractions near {anchor}"
    if search_type == "hotels":
        return text if "hotel" in text.lower() else f"hotels in {text}"
    if search_type == "attractions":
        return text if "attraction" in text.lower() else f"tourist attractions in {text}"
    if search_type == "place_details":
        return text

    return text


def build_places_reply(search_type, query, places):
    labels = {
        "hotels": "hotels",
        "attractions": "attractions",
        "nearby": "nearby places",
        "place_details": "place details",
        "places": "places",
    }
    label = labels.get(search_type, "places")
    top_names = ", ".join(place["name"] for place in places[:3])
    return f"I found live {label} for '{query}'. Top matches include {top_names}."


def normalize_place_result(item, api_key):
    geometry = item.get("geometry", {}).get("location", {})
    photos = item.get("photos") or []
    photo_url = ""
    if photos and photos[0].get("photo_reference"):
        photo_url = (
            f"{GOOGLE_PLACES_PHOTO_URL}?maxwidth=600&photo_reference="
            f"{parse.quote(photos[0]['photo_reference'])}&key={api_key}"
        )

    place_id = item.get("place_id", "")
    maps_url = item.get("url") or (
        f"https://www.google.com/maps/search/?api=1&query={geometry.get('lat', 0)},"
        f"{geometry.get('lng', 0)}"
    )
    if place_id:
        maps_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

    return {
        "placeId": place_id,
        "name": item.get("name", "Unknown place"),
        "address": item.get("formatted_address") or item.get("vicinity") or "Address unavailable",
        "rating": item.get("rating"),
        "coordinates": {
            "lat": geometry.get("lat"),
            "lng": geometry.get("lng"),
        },
        "photoUrl": photo_url,
        "mapsUrl": maps_url,
    }


def request_json(base_url, params):
    url = f"{base_url}?{parse.urlencode(params)}"

    try:
        with request.urlopen(url, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Google Places request failed: {error_body or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("Google Places could not be reached from the backend.") from exc

    status = payload.get("status", "UNKNOWN_ERROR")
    if status not in {"OK", "ZERO_RESULTS"}:
        raise RuntimeError(payload.get("error_message") or f"Google Places returned {status}.")

    return payload
