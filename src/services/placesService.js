const TRAVEL_API_BASE_URL = process.env.REACT_APP_TRAVEL_API_BASE_URL || "http://127.0.0.1:5000";

export async function requestPlacesReply({ message, searchType, context = {} }) {
  const response = await fetch(`${TRAVEL_API_BASE_URL}/chat/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, searchType, context }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Places service is unavailable right now.");
  }

  return data;
}

export function buildPlaceMapLink(place) {
  return place?.mapsUrl || "#";
}
