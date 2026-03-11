# Travel Planner ML Backend

Simple Flask backend with machine learning recommendation endpoints for destinations and hotels.

## Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API runs at `http://127.0.0.1:5000`.

## Endpoints

### `POST /recommend`

Destination recommendations based on:

- budget
- weather
- trip type
- days

Example request:

```json
{
  "budget": 800,
  "weather": "warm",
  "trip_type": "beach",
  "days": 5
}
```

Example response:

```json
{
  "recommendations": ["Bali", "Phuket", "Gold Coast"]
}
```

### `POST /recommend-hotels`

Hotel recommendations based on:

- past user choices
- rating
- budget
- location preference
- amenities such as wifi, parking, breakfast

Example chatbot request:

```json
{
  "budget": 100,
  "location_preference": "city centre",
  "amenities": ["wifi"],
  "past_choices": ["City Centre Budget Inn", "Downtown Smart Stay"]
}
```

Example response:

```json
{
  "message": "Hotels ranked from best to least suitable.",
  "recommendations": [
    {
      "hotel_name": "City Centre Budget Inn",
      "rating": 4.1,
      "price_per_night": 85.0,
      "location_preference": "city centre",
      "amenities": {
        "wifi": true,
        "parking": false,
        "breakfast": true
      },
      "score": 0.9012
    }
  ]
}
```

## Chatbot usage

For a message like:

`Find me a cheap hotel near city centre with free wifi`

the chatbot can convert it into:

```json
{
  "budget": 100,
  "location_preference": "city centre",
  "amenities": ["wifi"],
  "past_choices": []
}
```

Then call `POST /recommend-hotels` and show the ranked results.
