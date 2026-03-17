import React, { useState } from "react";
import "./Weather.css";

// Replace with your own free API key from https://openweathermap.org (or another provider)
const API_BASE = "https://api.openweathermap.org/data/2.5/weather";
// Convenience fallback for quick testing.
const DEFAULT_API_KEY = "b0de676fca853faaf818b515e2940193"; // demo only

function Weather() {
  const [location, setLocation] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // clickable examples to make the page look good
  const sampleCities = [
    "Paris",
    "Tokyo",
    "New York",
    "Sydney",
    "Cairo",
    "Rio de Janeiro",
    "Moscow",
    "Cape Town",
  ];

  const isEmpty = !result && !error;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    let apiKey = process.env.REACT_APP_WEATHER_API_KEY;
    if (!apiKey) {
      apiKey = DEFAULT_API_KEY;
      console.warn("REACT_APP_WEATHER_API_KEY not set; falling back to default");
    }
    if (!apiKey) {
      setError("API key is missing. Please create a .env file with REACT_APP_WEATHER_API_KEY set or hard-code one.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}?q=${encodeURIComponent(location)}&units=metric&appid=${apiKey}`
      );
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.message || "Unable to fetch weather");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // determine optional theme class (clear, clouds, rain, snow)
  const themeClass = result
    ? `weather-${(result.weather[0].main || "").toLowerCase()}`
    : "";

  return (
    <div className={`weather-page ${themeClass}`}> 
      <div className="weather-header">
        <img src="https://images.unsplash.com/photo-1501973801540-537f08ccae7f?w=100&auto=format&fit=crop" alt="weather icon" className="weather-header-icon" />
        <h2>Weather Checker</h2>
      </div>
      <form onSubmit={handleSubmit} className="weather-form">
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter city or place name"
          required
        />
        <button type="submit">Search</button>
      </form>

      <div className="weather-samples">
        <p>Try one of these:</p>
        <div className="weather-sample-list">
          {sampleCities.map((c) => (
            <button
              key={c}
              type="button"
              className="weather-sample"
              onClick={() => {
                setLocation(c);
                // trigger search immediately
                const ev = { preventDefault: () => {} };
                handleSubmit(ev);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="weather-error">{error}</p>}
      {isEmpty && <p className="weather-empty">No weather data yet. Enter a location and click Search.</p>}

      {result && (
        <div className="weather-result">
          <div className="weather-result-header">
            <h3>
              {result.name}, {result.sys?.country}
            </h3>
            {result.weather[0].icon && (
              <img
                alt={result.weather[0].description}
                src={`https://openweathermap.org/img/wn/${result.weather[0].icon}@2x.png`}
                className="weather-result-icon"
              />
            )}
          </div>
          <p className="temp">{Math.round(result.main.temp)}&deg;C</p>
          <p className="desc">{result.weather[0].description}</p>
          <div className="weather-details">
            <span>💧 {result.main.humidity}%</span>
            <span>🌬️ {result.wind.speed} m/s</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Weather;
