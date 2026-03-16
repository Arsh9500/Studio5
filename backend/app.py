from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from chat_workflow import classify_search_type, handle_chat_message
from gemini_service import generate_travel_reply
from places_service import search_places


app = Flask(__name__)
CORS(app)


# Destination dataset for the travel recommendation endpoint.
DESTINATIONS = [
    {"destination_name": "Bali", "average_budget": 800, "weather_type": "warm", "trip_type": "beach", "recommended_days": 5},
    {"destination_name": "Gold Coast", "average_budget": 900, "weather_type": "warm", "trip_type": "beach", "recommended_days": 4},
    {"destination_name": "Queenstown", "average_budget": 1200, "weather_type": "cold", "trip_type": "mountain", "recommended_days": 5},
    {"destination_name": "Tokyo", "average_budget": 1500, "weather_type": "mild", "trip_type": "city", "recommended_days": 6},
    {"destination_name": "Phuket", "average_budget": 700, "weather_type": "warm", "trip_type": "beach", "recommended_days": 5},
    {"destination_name": "Paris", "average_budget": 1600, "weather_type": "mild", "trip_type": "city", "recommended_days": 5},
    {"destination_name": "Swiss Alps", "average_budget": 1800, "weather_type": "cold", "trip_type": "mountain", "recommended_days": 7},
    {"destination_name": "Dubai", "average_budget": 1400, "weather_type": "warm", "trip_type": "city", "recommended_days": 4},
    {"destination_name": "Banff", "average_budget": 1300, "weather_type": "cold", "trip_type": "mountain", "recommended_days": 5},
    {"destination_name": "Barcelona", "average_budget": 1100, "weather_type": "mild", "trip_type": "beach", "recommended_days": 5},
]


# Hotel dataset for the hotel recommendation endpoint.
# Amenity flags are kept explicit so the chatbot can ask for wifi, parking, breakfast, and similar features.
HOTELS = [
    {"hotel_name": "City Centre Budget Inn", "rating": 4.1, "price_per_night": 85, "location_preference": "city centre", "wifi": 1, "parking": 0, "breakfast": 1},
    {"hotel_name": "Downtown Smart Stay", "rating": 4.4, "price_per_night": 110, "location_preference": "city centre", "wifi": 1, "parking": 1, "breakfast": 0},
    {"hotel_name": "Harbour Comfort Hotel", "rating": 4.6, "price_per_night": 145, "location_preference": "harbour", "wifi": 1, "parking": 1, "breakfast": 1},
    {"hotel_name": "Airport Express Lodge", "rating": 4.0, "price_per_night": 95, "location_preference": "airport", "wifi": 1, "parking": 1, "breakfast": 0},
    {"hotel_name": "Beachside Escape Resort", "rating": 4.8, "price_per_night": 210, "location_preference": "beach", "wifi": 1, "parking": 1, "breakfast": 1},
    {"hotel_name": "Mountain View Retreat", "rating": 4.7, "price_per_night": 185, "location_preference": "mountain", "wifi": 1, "parking": 1, "breakfast": 1},
    {"hotel_name": "Central Backpackers Hub", "rating": 3.9, "price_per_night": 60, "location_preference": "city centre", "wifi": 1, "parking": 0, "breakfast": 0},
    {"hotel_name": "Suburban Family Suites", "rating": 4.3, "price_per_night": 125, "location_preference": "suburb", "wifi": 1, "parking": 1, "breakfast": 1},
    {"hotel_name": "Parkside Business Hotel", "rating": 4.5, "price_per_night": 135, "location_preference": "park", "wifi": 1, "parking": 1, "breakfast": 0},
    {"hotel_name": "Luxury City Palace", "rating": 4.9, "price_per_night": 280, "location_preference": "city centre", "wifi": 1, "parking": 1, "breakfast": 1},
]


destinations_df = pd.DataFrame(DESTINATIONS)
hotels_df = pd.DataFrame(HOTELS)


DESTINATION_FEATURES = ["average_budget", "weather_type", "trip_type", "recommended_days"]
HOTEL_FEATURES = ["price_per_night", "rating", "location_preference", "wifi", "parking", "breakfast"]


def build_destination_model():
    # Numeric and categorical features are transformed so KNN can compare them in one vector space.
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), ["average_budget", "recommended_days"]),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), ["weather_type", "trip_type"]),
        ]
    )
    pipeline = Pipeline(steps=[("preprocessor", preprocessor)])
    matrix = pipeline.fit_transform(destinations_df[DESTINATION_FEATURES])

    # NearestNeighbors is a KNN-style recommender for the closest destination profiles.
    model = NearestNeighbors(n_neighbors=3, metric="euclidean")
    model.fit(matrix)
    return pipeline, model


def build_hotel_model():
    # Price/rating are numeric. Location is categorical. Amenities are binary numeric flags.
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), ["price_per_night", "rating", "wifi", "parking", "breakfast"]),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), ["location_preference"]),
        ]
    )
    pipeline = Pipeline(steps=[("preprocessor", preprocessor)])
    matrix = pipeline.fit_transform(hotels_df[HOTEL_FEATURES])

    # Use more neighbors first, then rerank by business rules and past choices.
    model = NearestNeighbors(n_neighbors=min(6, len(hotels_df)), metric="euclidean")
    model.fit(matrix)
    return pipeline, model


destination_pipeline, destination_model = build_destination_model()
hotel_pipeline, hotel_model = build_hotel_model()


def validate_destination_payload(payload):
    required = ["budget", "weather", "trip_type", "days"]
    missing = [field for field in required if field not in payload]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"

    if payload["weather"] not in {"warm", "cold", "mild"}:
        return "weather must be one of: warm, cold, mild"
    if payload["trip_type"] not in {"beach", "city", "mountain"}:
        return "trip_type must be one of: beach, city, mountain"

    try:
        float(payload["budget"])
        int(payload["days"])
    except (TypeError, ValueError):
        return "budget must be numeric and days must be an integer"

    return None


def validate_hotel_payload(payload):
    required = ["budget", "location_preference", "amenities"]
    missing = [field for field in required if field not in payload]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"

    try:
        float(payload["budget"])
    except (TypeError, ValueError):
        return "budget must be numeric"

    if not isinstance(payload["amenities"], list):
        return "amenities must be a list"

    valid_locations = {"city centre", "harbour", "airport", "beach", "mountain", "suburb", "park"}
    if payload["location_preference"] not in valid_locations:
        return "location_preference must be one of: city centre, harbour, airport, beach, mountain, suburb, park"

    valid_amenities = {"wifi", "parking", "breakfast"}
    invalid_amenities = [item for item in payload["amenities"] if item not in valid_amenities]
    if invalid_amenities:
        return f"Unsupported amenities: {', '.join(invalid_amenities)}"

    if "past_choices" in payload and not isinstance(payload["past_choices"], list):
        return "past_choices must be a list of hotel names"

    return None


def build_destination_request_frame(payload):
    return pd.DataFrame(
        [
            {
                "average_budget": float(payload["budget"]),
                "weather_type": payload["weather"],
                "trip_type": payload["trip_type"],
                "recommended_days": int(payload["days"]),
            }
        ]
    )


def build_hotel_request_frame(payload, preference_profile=None):
    amenities = set(payload.get("amenities", []))

    # Past user choices are summarized into an average profile.
    # This acts as a lightweight personalization signal.
    budget_value = float(payload["budget"])
    rating_value = 4.0
    location_value = payload["location_preference"]
    wifi_value = 1 if "wifi" in amenities else 0
    parking_value = 1 if "parking" in amenities else 0
    breakfast_value = 1 if "breakfast" in amenities else 0

    if preference_profile is not None:
        budget_value = (budget_value + float(preference_profile["price_per_night"])) / 2
        rating_value = float(preference_profile["rating"])
        if payload["location_preference"] == "city centre":
            location_value = preference_profile["location_preference"]
        wifi_value = max(wifi_value, int(preference_profile["wifi"]))
        parking_value = max(parking_value, int(preference_profile["parking"]))
        breakfast_value = max(breakfast_value, int(preference_profile["breakfast"]))

    return pd.DataFrame(
        [
            {
                "price_per_night": budget_value,
                "rating": rating_value,
                "location_preference": location_value,
                "wifi": wifi_value,
                "parking": parking_value,
                "breakfast": breakfast_value,
            }
        ]
    )


def get_past_choice_profile(past_choices):
    if not past_choices:
        return None

    previous_hotels = hotels_df[hotels_df["hotel_name"].isin(past_choices)]
    if previous_hotels.empty:
        return None

    preferred_location = previous_hotels["location_preference"].mode().iloc[0]
    return {
        "price_per_night": previous_hotels["price_per_night"].mean(),
        "rating": previous_hotels["rating"].mean(),
        "location_preference": preferred_location,
        "wifi": round(previous_hotels["wifi"].mean()),
        "parking": round(previous_hotels["parking"].mean()),
        "breakfast": round(previous_hotels["breakfast"].mean()),
    }


def score_hotel_row(row, payload, distance, past_choice_profile):
    requested_amenities = set(payload.get("amenities", []))
    matched_amenities = sum(int(row[amenity]) for amenity in requested_amenities)
    amenity_score = matched_amenities / max(len(requested_amenities), 1) if requested_amenities else 0

    # Close distance from KNN means the hotel looks similar to the user's feature profile.
    similarity_score = 1 / (1 + distance)
    rating_score = row["rating"] / 5
    budget_score = 1 if row["price_per_night"] <= float(payload["budget"]) else 0.25
    location_score = 1 if row["location_preference"] == payload["location_preference"] else 0

    past_choice_bonus = 0
    if past_choice_profile and row["location_preference"] == past_choice_profile["location_preference"]:
        past_choice_bonus = 0.2

    return (
        similarity_score * 0.35
        + rating_score * 0.2
        + budget_score * 0.15
        + location_score * 0.15
        + amenity_score * 0.15
        + past_choice_bonus
    )


@app.get("/")
def health_check():
    return jsonify({"message": "Travel Planner ML API is running."})


@app.post("/recommend")
def recommend_destinations():
    payload = request.get_json(silent=True) or {}
    validation_error = validate_destination_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    user_frame = build_destination_request_frame(payload)
    transformed_user = destination_pipeline.transform(user_frame[DESTINATION_FEATURES])
    _, indices = destination_model.kneighbors(transformed_user, n_neighbors=3)

    recommendations = destinations_df.iloc[indices[0]]["destination_name"].tolist()
    return jsonify({"recommendations": recommendations})


@app.post("/recommend-hotels")
def recommend_hotels():
    payload = request.get_json(silent=True) or {}
    validation_error = validate_hotel_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    past_choice_profile = get_past_choice_profile(payload.get("past_choices", []))
    user_frame = build_hotel_request_frame(payload, preference_profile=past_choice_profile)

    # KNN returns a candidate set of similar hotels.
    transformed_user = hotel_pipeline.transform(user_frame[HOTEL_FEATURES])
    distances, indices = hotel_model.kneighbors(transformed_user, n_neighbors=min(6, len(hotels_df)))

    ranked_results = []
    for distance, hotel_index in zip(distances[0], indices[0]):
        hotel = hotels_df.iloc[hotel_index]
        score = score_hotel_row(hotel, payload, distance, past_choice_profile)
        ranked_results.append(
            {
                "hotel_name": hotel["hotel_name"],
                "rating": float(hotel["rating"]),
                "price_per_night": float(hotel["price_per_night"]),
                "location_preference": hotel["location_preference"],
                "amenities": {
                    "wifi": bool(hotel["wifi"]),
                    "parking": bool(hotel["parking"]),
                    "breakfast": bool(hotel["breakfast"]),
                },
                "score": round(score, 4),
            }
        )

    # The chatbot can read this ordered list from best to least suitable.
    ranked_results.sort(key=lambda item: item["score"], reverse=True)

    return jsonify(
        {
            "recommendations": ranked_results[:3],
            "message": "Hotels ranked from best to least suitable.",
        }
    )


@app.post("/chat/gemini")
def chat_with_gemini():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        reply = generate_travel_reply(message, payload.get("context") or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"reply": reply, "mode": "gemini", "places": [], "searchType": "general"})


@app.post("/chat/places")
def chat_with_places():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    search_type = payload.get("searchType") or classify_search_type(message)

    try:
        result = search_places(message, search_type, context=payload.get("context") or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"mode": "places", **result})


@app.post("/chat/message")
def chat_message():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        result = handle_chat_message(message, payload.get("context") or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 503
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
