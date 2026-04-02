import React, { useEffect, useState } from "react";
import { getWeatherAiSuggestions } from "../services/weatherAiService";
import "./WeatherAISuggestions.css";

/**
 * This component fetches AI travel suggestions based on the
 * selected city, current weather, and temperature.
 *
 * Props:
 *   city    (string) – city name from OpenWeather response
 *   weather (string) – weather description, e.g. "light rain"
 *   temp    (number) – temperature in °C
 */
function WeatherAISuggestions({ city, weather, temp }) {
  // Stores the final suggestion text returned by the AI service.
  const [suggestions, setSuggestions] = useState("");

  // Shows a loading state while the API request is in progress.
  const [loading, setLoading] = useState(false);

  // Stores an error message if the request fails.
  const [error, setError] = useState("");

  useEffect(() => {
    // Do not call the service until we have the required weather data.
    if (!city || !weather) return;

    // Reset old data before starting a new request.
    setLoading(true);
    setSuggestions("");
    setError("");

    // Ask the backend for activities that match the current weather.
    getWeatherAiSuggestions({ city, weather, temp })
      .then((data) => setSuggestions(data.suggestions || ""))
      .catch((err) =>
        setError(err.message || "Unable to load AI suggestions right now.")
      )
      // Stop the loading state whether the request succeeds or fails.
      .finally(() => setLoading(false));
  }, [city, weather, temp]);

  // If no city is available yet, there is nothing useful to render.
  if (!city) return null;

  return (
    <div className="weather-ai-suggestions">
      <h4>Things To Do</h4>
      <p className="weather-ai-subtitle">
        AI suggestions for {city} — {weather}, {temp}°C
      </p>

      {/* Show a spinner while new suggestions are being generated. */}
      {loading && (
        <div className="weather-ai-loading">
          <span className="weather-ai-spinner" aria-hidden="true" />
          Generating local suggestions…
        </div>
      )}

      {/* Show an error message only after loading is finished. */}
      {!loading && error && (
        <p className="weather-ai-error">{error}</p>
      )}

      {/* Show each suggestion line separately for cleaner display. */}
      {!loading && !error && suggestions && (
        <div className="weather-ai-content">
          {suggestions
            .split(/\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => (
              <p key={index} className="weather-ai-line">
                {line}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export default WeatherAISuggestions;
