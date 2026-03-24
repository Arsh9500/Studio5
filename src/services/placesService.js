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
  const mapsUrl = (place?.mapsUrl || "").trim();
  if (/^https?:\/\//i.test(mapsUrl)) {
    return mapsUrl;
  }

  const lat = place?.coordinates?.lat;
  const lng = place?.coordinates?.lng;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const queryParts = [place?.name, place?.address].filter(Boolean).join(" ").trim();
  if (queryParts) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts)}`;
  }

  return "https://maps.google.com";
}
