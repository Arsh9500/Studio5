
import json
import os
from urllib import error, parse, request
from env_config import load_env_files


load_env_files()


GOOGLE_PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"
GOOGLE_PLACES_NEW_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_PLACES_NEW_PLACE_URL = "https://places.googleapis.com/v1/places"


def _get_places_api_key():
    return os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("REACT_APP_GOOGLE_MAPS_API_KEY")


def places_is_configured():
    return bool(_get_places_api_key())


def search_places(message, search_type, context=None):
    api_key = _get_places_api_key()
    if not api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured on the backend.")

    context = context or {}
    query = build_places_query(message, search_type, context)
    try:
        raw_results = request_json(
            GOOGLE_PLACES_TEXT_SEARCH_URL,
            {
                "query": query,
                "key": api_key,
            },
        )
        results = raw_results.get("results") or []
        places = [normalize_place_result(item, api_key) for item in results[:6]]
    except RuntimeError as exc:
        # Some keys only have Places API (New) enabled.
        # Fall back automatically so the frontend does not need changes.
        if "LegacyApiNotActivatedMapError" not in str(exc):
            raise
        places = search_places_new(query, api_key)

    if not places:
        return {
            "reply": "I could not find live place results for that request right now.",
            "places": [],
            "searchType": search_type,
        }

    reply = build_places_reply(search_type, query, places)
    return {
        "reply": reply,
        "places": places,
        "searchType": search_type,
        "query": query,
    }


def get_place_details(place_id):
    api_key = _get_places_api_key()
    if not api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured on the backend.")

    try:
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
    except RuntimeError as exc:
        if "LegacyApiNotActivatedMapError" not in str(exc):
            raise
        return get_place_details_new(place_id, api_key)


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


def normalize_new_place_result(item):
    location = item.get("location") or {}
    lat = location.get("latitude")
    lng = location.get("longitude")
    place_id = item.get("id", "")

    maps_url = item.get("googleMapsUri")
    if not maps_url:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat or 0},{lng or 0}"

    return {
        "placeId": place_id,
        "name": (item.get("displayName") or {}).get("text") or "Unknown place",
        "address": item.get("formattedAddress") or "Address unavailable",
        "rating": item.get("rating"),
        "coordinates": {
            "lat": lat,
            "lng": lng,
        },
        "photoUrl": "",
        "mapsUrl": maps_url,
    }


def request_places_new_text_search(query, api_key):
    body = json.dumps({"textQuery": query}).encode("utf-8")
    req = request.Request(
        GOOGLE_PLACES_NEW_TEXT_SEARCH_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.location,places.googleMapsUri",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Google Places (New) request failed: {error_body or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("Google Places (New) could not be reached from the backend.") from exc


def search_places_new(query, api_key):
    payload = request_places_new_text_search(query, api_key)
    return [normalize_new_place_result(item) for item in (payload.get("places") or [])[:6]]


def get_place_details_new(place_id, api_key):
    req = request.Request(
        f"{GOOGLE_PLACES_NEW_PLACE_URL}/{parse.quote(place_id)}",
        headers={
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,location,googleMapsUri",
        },
        method="GET",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Google Places (New) details request failed: {error_body or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("Google Places (New) details endpoint could not be reached from the backend.") from exc

    if not payload:
        raise RuntimeError("No place details were returned.")

    return normalize_new_place_result(payload)


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
