const TRAVEL_API_BASE_URL = process.env.REACT_APP_TRAVEL_API_BASE_URL || "http://127.0.0.1:5000";

export async function sendChatMessage({ message, context = {} }) {
  const response = await fetch(`${TRAVEL_API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Chat service is unavailable right now.");
  }

  return data;
}
