const WEATHER_AI_API = "http://localhost:5000/weather-ai";

/**
 * Calls the local Flask backend which contacts Ollama (phi model)
 * and returns AI-generated things-to-do suggestions.
 *
 * @param {{ city: string, weather: string, temp: number }} params
 * @returns {Promise<{ suggestions: string }>}
 */
export async function getWeatherAiSuggestions({ city, weather, temp }) {
  const response = await fetch(WEATHER_AI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, weather, temp }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}
