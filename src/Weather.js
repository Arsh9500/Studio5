import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useItinerary } from "./context/ItineraryContext";
import "./Weather.css";

// Replace with your own free API key from https://openweathermap.org (or another provider)
const API_BASE = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_API_BASE = "https://api.openweathermap.org/data/2.5/forecast";
// Convenience fallback for quick testing.
const DEFAULT_API_KEY = "b0de676fca853faaf818b515e2940193"; // demo only

function getWeatherRecommendation(result) {
  const weatherMain = (result?.weather?.[0]?.main || "").toLowerCase();
  const cityName = result?.name || "this city";

  if (weatherMain === "clear") {
    return {
      title: "Great day for outdoors",
      tip: `Sunny in ${cityName}. Good time for beach visits, parks, and walking tours.`,
    };
  }

  if (weatherMain === "rain" || weatherMain === "drizzle" || weatherMain === "thunderstorm") {
    return {
      title: "Rainy day plan",
      tip: `Wet weather in ${cityName}. Better for indoor plans like cafes, museums, and shopping.`,
    };
  }

  if (weatherMain === "snow") {
    return {
      title: "Snow day tip",
      tip: `Snow expected in ${cityName}. Wear warm layers and keep indoor stops in your plan.`,
    };
  }

  if (weatherMain === "clouds" || weatherMain === "mist" || weatherMain === "fog" || weatherMain === "haze") {
    return {
      title: "Balanced day plan",
      tip: `Cloudy weather in ${cityName}. Light outdoor sightseeing should still work well.`,
    };
  }

  return {
    title: "Smart travel tip",
    tip: `For ${cityName}, keep one outdoor option and one indoor backup plan.`,
  };
}

function buildDailyForecast(list) {
  if (!Array.isArray(list)) return [];

  const byDate = new Map();

  list.forEach((entry) => {
    const dt = new Date((entry?.dt || 0) * 1000);
    if (Number.isNaN(dt.getTime())) return;

    const dateKey = dt.toISOString().slice(0, 10);
    const existing = byDate.get(dateKey);

    // Prefer 12:00 data point if available because it is usually stable for daytime planning.
    const isNoon = (entry.dt_txt || "").includes("12:00:00");
    if (!existing || (isNoon && !existing.isNoon)) {
      byDate.set(dateKey, { ...entry, isNoon });
    }
  });

  return [...byDate.values()]
    .slice(1, 5)
    .map((entry) => {
      const dt = new Date((entry.dt || 0) * 1000);
      return {
        id: String(entry.dt),
        day: dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        temp: Math.round(entry.main?.temp || 0),
        description: entry.weather?.[0]?.description || "No details",
        icon: entry.weather?.[0]?.icon || "",
      };
    });
}

function Weather() {
  const locationState = useLocation();
  const { itineraryDestination, setItineraryDestination } = useItinerary();
  const [location, setLocation] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");

  const sampleCities = ["Paris", "Tokyo", "New York", "Sydney", "Cairo", "Rio de Janeiro", "Moscow", "Cape Town"];

  const isEmpty = !result && !error;
  const weatherRecommendation = useMemo(() => getWeatherRecommendation(result), [result]);

  const fetchWeatherForLocation = useCallback(async (rawLocation) => {
    const city = (rawLocation || "").trim();
    if (!city) return;

    setError("");
    setResult(null);
    setForecast([]);
    setForecastError("");

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
      const res = await fetch(`${API_BASE}?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Unable to fetch weather");
        return;
      }

      setResult(data);
      setItineraryDestination(city);

      // Future forecast based on selected city coordinates.
      if (Number.isFinite(data?.coord?.lat) && Number.isFinite(data?.coord?.lon)) {
        setForecastLoading(true);
        try {
          const forecastRes = await fetch(
            `${FORECAST_API_BASE}?lat=${data.coord.lat}&lon=${data.coord.lon}&units=metric&appid=${apiKey}`
          );
          const forecastData = await forecastRes.json();

          if (forecastRes.ok) {
            setForecast(buildDailyForecast(forecastData.list));
          } else {
            setForecastError(forecastData.message || "Unable to fetch future forecast.");
          }
        } catch (forecastErr) {
          setForecastError(forecastErr.message || "Unable to fetch future forecast.");
        } finally {
          setForecastLoading(false);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }, [setItineraryDestination]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    fetchWeatherForLocation(location);
  };

  useEffect(() => {
    if (hasAutoLoaded) return;

    const routeDestination = (locationState.state?.destination || "").trim();
    const sharedDestination = (itineraryDestination || "").trim();
    const autoDestination = routeDestination || sharedDestination;
    if (!autoDestination) return;

    setLocation(autoDestination);
    fetchWeatherForLocation(autoDestination);
    setHasAutoLoaded(true);
  }, [hasAutoLoaded, itineraryDestination, locationState.state, fetchWeatherForLocation]);

  const themeClass = result ? `weather-${(result.weather?.[0]?.main || "").toLowerCase()}` : "weather-default";

  return (
    <div className={`weather-screen ${themeClass}`}>
      <div className="weather-page">
        <div className="weather-header">
          <img
            src="https://images.unsplash.com/photo-1501973801540-537f08ccae7f?w=100&auto=format&fit=crop"
            alt="weather icon"
            className="weather-header-icon"
          />
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
                  fetchWeatherForLocation(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="weather-error">{error}</p>}
        {isEmpty && (
          <div className="weather-empty-card">
            <h3>Plan ideas will appear here</h3>
            <p>Search a city to get weather-based travel recommendations and future forecast.</p>
          </div>
        )}

        {result && (
          <div className="weather-result">
            <div className="weather-result-header">
              <h3>
                {result.name}, {result.sys?.country}
              </h3>
              {result.weather?.[0]?.icon && (
                <img
                  alt={result.weather[0].description}
                  src={`https://openweathermap.org/img/wn/${result.weather[0].icon}@2x.png`}
                  className="weather-result-icon"
                />
              )}
            </div>

            <p className="temp">{Math.round(result.main?.temp || 0)}&deg;C</p>
            <p className="desc">{result.weather?.[0]?.description}</p>
            <div className="weather-details">
              <span>Humidity {result.main?.humidity}%</span>
              <span>Wind {result.wind?.speed} m/s</span>
            </div>

            <div className="weather-recommendation">
              <h4>{weatherRecommendation.title}</h4>
              <p>{weatherRecommendation.tip}</p>
            </div>
          </div>
        )}

        {result && (
          <section className="weather-forecast">
            <h3>Future Weather (Next Days)</h3>
            {forecastLoading && <p>Loading future forecast...</p>}
            {!forecastLoading && forecastError && <p className="weather-error">{forecastError}</p>}
            {!forecastLoading && !forecastError && forecast.length === 0 && (
              <p>No forecast data available right now.</p>
            )}
            {!forecastLoading && forecast.length > 0 && (
              <div className="weather-forecast-grid">
                {forecast.map((item) => (
                  <article key={item.id} className="weather-forecast-item">
                    <p className="forecast-day">{item.day}</p>
                    {item.icon && (
                      <img
                        alt={item.description}
                        src={`https://openweathermap.org/img/wn/${item.icon}.png`}
                      />
                    )}
                    <p className="forecast-temp">{item.temp}&deg;C</p>
                    <p className="forecast-desc">{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default Weather;
