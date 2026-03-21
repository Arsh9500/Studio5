import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "./components/Logo";
import { requestBudgetPlan } from "./services/budgetAiService";
import "./Budget.css";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const GEO_DB_URL = "https://wft-geo-db.p.rapidapi.com/v1/geo/cities";
const GEO_DB_HOST = "wft-geo-db.p.rapidapi.com";
const GEO_DB_KEY = process.env.REACT_APP_GEODB_API_KEY || "";
const REST_COUNTRIES_URL = "https://restcountries.com/v3.1/name";
const USD_RATES_URL = "https://open.er-api.com/v6/latest/USD";

let cachedUsdRates = null;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrencyAmount(amount, currencyCode) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(safeNumber(amount));
  } catch {
    return `${safeNumber(amount).toFixed(0)} ${currencyCode}`;
  }
}

function pickCurrencyFromCountryPayload(payload) {
  const country = Array.isArray(payload) ? payload[0] : null;
  if (!country || !country.currencies || typeof country.currencies !== "object") {
    return null;
  }

  const [code, details] = Object.entries(country.currencies)[0] || [];
  if (!code) return null;

  return {
    code,
    name: details?.name || code,
  };
}

function Budget() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const [totalBudget, setTotalBudget] = useState(state.totalBudget || "");
  const [days, setDays] = useState(state.days || 1);

  const [destinationSearch, setDestinationSearch] = useState(state.destinationSearch || "");
  const [selectedLocation, setSelectedLocation] = useState(state.selectedLocation || null);
  const [saveMessage, setSaveMessage] = useState("");

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  const [budgetAiLoading, setBudgetAiLoading] = useState(false);
  const [budgetAiError, setBudgetAiError] = useState("");
  const [budgetAiResult, setBudgetAiResult] = useState(null);
  const [currencyInfo, setCurrencyInfo] = useState(null);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState("");

  const hasRequiredInput =
    safeNumber(totalBudget) > 0 && safeNumber(days) > 0 && (selectedLocation || destinationSearch.trim());

  const nights = Math.max(0, safeNumber(days));

  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    setDestinationSearch(loc.name);
    setLocationSuggestions([]);
    setLocationStatus("");
  };

  const normalizeGeoDbLocations = (data, fallbackName) => {
    return (data?.data || [])
      .map((item) => ({
        id: String(item.id),
        name: item.city || item.name || fallbackName,
        country: item.country || "",
        region: item.region || item.country || "",
        lat: Number(item.latitude),
        lon: Number(item.longitude),
      }))
      .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon));
  };

  const normalizeNominatimLocations = (data, fallbackName) => {
    return (Array.isArray(data) ? data : [])
      .map((item) => ({
        id: `${item.osm_type}-${item.osm_id}`,
        name:
          item.address?.city ||
          item.address?.town ||
          item.address?.village ||
          item.address?.municipality ||
          item.address?.state ||
          item.address?.county ||
          item.address?.country ||
          (item.display_name || fallbackName).split(",")[0],
        country: item.address?.country || "",
        region: item.address?.state || item.address?.region || "",
        lat: Number(item.lat),
        lon: Number(item.lon),
      }))
      .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon));
  };

  const fetchNominatimSuggestions = async (query, signal) => {
    const resp = await fetch(
      `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8`,
      {
        signal,
        headers: { Accept: "application/json" },
      }
    );

    if (!resp.ok) {
      throw new Error(`Location search failed (${resp.status})`);
    }

    const data = await resp.json();
    return normalizeNominatimLocations(data, query);
  };

  const fetchGeoDbSuggestions = async (query, signal) => {
    const resp = await fetch(
      `${GEO_DB_URL}?namePrefix=${encodeURIComponent(query)}&limit=8&types=CITY`,
      {
        signal,
        headers: {
          "X-RapidAPI-Key": GEO_DB_KEY,
          "X-RapidAPI-Host": GEO_DB_HOST,
        },
      }
    );

    if (!resp.ok) {
      throw new Error(`Location search failed (${resp.status})`);
    }

    const data = await resp.json();
    return normalizeGeoDbLocations(data, query);
  };

  const fetchLocationSuggestions = async (query, signal) => {
    if (!query.trim()) {
      setLocationSuggestions([]);
      setLocationStatus("");
      return;
    }

    setLocationLoading(true);
    setLocationStatus("");

    try {
      let locations = [];

      if (GEO_DB_KEY) {
        try {
          locations = await fetchGeoDbSuggestions(query, signal);
        } catch (err) {
          console.warn("GeoDB lookup failed, using Nominatim fallback", err);
        }
      }

      // Always fall back to Nominatim if GeoDB key is missing or gives no city matches.
      if (!locations.length) {
        locations = await fetchNominatimSuggestions(query, signal);
      }

      if (locations.length) {
        setLocationSuggestions(locations.slice(0, 8));
        setLocationStatus("");
      } else {
        setLocationSuggestions([]);
        setLocationStatus("No matching locations found. Try full city names, e.g. Delhi, Auckland, Paris.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      setLocationStatus("Unable to search locations right now. Please try again.");
      setLocationSuggestions([]);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchLocationSuggestions(destinationSearch, controller.signal);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [destinationSearch]);

  useEffect(() => {
    setBudgetAiResult(null);
    setBudgetAiError("");
  }, [destinationSearch, selectedLocation, days, totalBudget]);

  useEffect(() => {
    const countryName = selectedLocation?.country;
    if (!countryName) {
      setCurrencyInfo(null);
      setCurrencyError("");
      setCurrencyLoading(false);
      return;
    }

    const controller = new AbortController();

    const resolveLocalCurrency = async () => {
      setCurrencyLoading(true);
      setCurrencyError("");

      try {
        let countryPayload = null;
        const fullTextResponse = await fetch(
          `${REST_COUNTRIES_URL}/${encodeURIComponent(countryName)}?fullText=true&fields=name,currencies`,
          { signal: controller.signal }
        );

        if (fullTextResponse.ok) {
          countryPayload = await fullTextResponse.json();
        } else {
          const fallbackResponse = await fetch(
            `${REST_COUNTRIES_URL}/${encodeURIComponent(countryName)}?fields=name,currencies`,
            { signal: controller.signal }
          );
          if (fallbackResponse.ok) {
            countryPayload = await fallbackResponse.json();
          }
        }

        const currency = pickCurrencyFromCountryPayload(countryPayload);
        if (!currency?.code) {
          setCurrencyInfo(null);
          setCurrencyError("Could not detect local currency for this destination.");
          return;
        }

        if (currency.code === "USD") {
          setCurrencyInfo({ ...currency, rateFromUsd: 1 });
          return;
        }

        if (!cachedUsdRates) {
          const ratesResponse = await fetch(USD_RATES_URL, { signal: controller.signal });
          if (!ratesResponse.ok) {
            throw new Error("Failed to fetch exchange rates");
          }
          const ratesPayload = await ratesResponse.json();
          cachedUsdRates = ratesPayload?.rates || null;
        }

        const rate = cachedUsdRates?.[currency.code];
        if (!rate || !Number.isFinite(rate)) {
          setCurrencyInfo(null);
          setCurrencyError(`Exchange rate unavailable for ${currency.code}.`);
          return;
        }

        setCurrencyInfo({ ...currency, rateFromUsd: rate });
      } catch (err) {
        if (err.name === "AbortError") return;
        setCurrencyInfo(null);
        setCurrencyError("Unable to load local currency conversion right now.");
      } finally {
        setCurrencyLoading(false);
      }
    };

    resolveLocalCurrency();

    return () => controller.abort();
  }, [selectedLocation?.country]);

  const handleGenerateAiBudget = async () => {
    const destination = selectedLocation?.name || destinationSearch.trim();
    if (!destination || safeNumber(days) <= 0 || safeNumber(totalBudget) <= 0) {
      setBudgetAiError("Enter destination, days, and total budget before generating AI budget.");
      return;
    }

    setBudgetAiLoading(true);
    setBudgetAiError("");

    try {
      const data = await requestBudgetPlan({
        destination,
        days: safeNumber(days),
        totalBudget: safeNumber(totalBudget),
        currency: "USD",
      });
      setBudgetAiResult(data);
    } catch (err) {
      setBudgetAiError(err.message || "Unable to generate AI budget right now.");
      setBudgetAiResult(null);
    } finally {
      setBudgetAiLoading(false);
    }
  };

  const handleSaveToPlanner = () => {
    if (!budgetAiResult) {
      setSaveMessage("Generate AI budget plan first, then save to planner.");
      setTimeout(() => setSaveMessage(""), 3500);
      return;
    }

    const ai = budgetAiResult.breakdown || {};
    const trip = {
      city: selectedLocation?.name || destinationSearch || "",
      budget: safeNumber(totalBudget),
      days: nights,
      hotelCost: safeNumber(ai.hotel).toFixed(0),
      foodCost: safeNumber(ai.food).toFixed(0),
      transportCost: safeNumber(ai.transport).toFixed(0),
      activitiesCost: safeNumber(ai.activities).toFixed(0),
      miscCost: safeNumber(ai.misc).toFixed(0),
      estimatedTotal: safeNumber(ai.total).toFixed(0),
      remaining: (safeNumber(totalBudget) - safeNumber(ai.total)).toFixed(0),
      destinationSummary: budgetAiResult.destinationSummary || "",
      aiTips: Array.isArray(budgetAiResult.tips) ? budgetAiResult.tips : [],
      timestamp: Date.now(),
      source: "ai",
    };

    const saved = JSON.parse(localStorage.getItem("savedTrips") || "[]");
    saved.push(trip);
    localStorage.setItem("savedTrips", JSON.stringify(saved));
    setSaveMessage("AI trip budget saved to planner!");
    setTimeout(() => setSaveMessage(""), 3500);
  };

  const aiBreakdown = budgetAiResult?.breakdown || {};
  const aiRemaining = safeNumber(totalBudget) - safeNumber(aiBreakdown.total);
  const showLocalCurrency = Boolean(currencyInfo?.code && Number.isFinite(currencyInfo?.rateFromUsd));

  const renderDualAmount = (usdAmount) => {
    const usd = formatCurrencyAmount(usdAmount, "USD");
    if (!showLocalCurrency) {
      return <span>{usd}</span>;
    }

    const localValue = safeNumber(usdAmount) * safeNumber(currencyInfo.rateFromUsd);
    const local = formatCurrencyAmount(localValue, currencyInfo.code);
    return (
      <span className="budget-dual-value">
        <strong>{usd}</strong>
        <em>{local}</em>
      </span>
    );
  };

  return (
    <div className="budget-page">
      <header className="budget-header">
        <div className="budget-header-inner">
          <Logo className="budget-logo" />
          <nav className="budget-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/hotels">Hotels</Link>
            <Link to="/planner">Planner</Link>
          </nav>
        </div>
      </header>

      <main className="budget-main">
        <section className="budget-intro">
          <h1>Budget Planner</h1>
          <p>Generate an AI budget plan by destination, trip days, and total budget.</p>
          <p className="budget-selected">
            {selectedLocation ? (
              <>
                Selected location: <strong>{selectedLocation.name}</strong>
              </>
            ) : destinationSearch.trim() ? (
              <>
                Selected location: <strong>{destinationSearch}</strong>
              </>
            ) : (
              "Select a destination to create an AI budget plan."
            )}
          </p>
        </section>

        <section className="budget-form-card">
          <h2>Trip Inputs</h2>
          <div className="budget-form-grid">
            <div className="budget-field">
              <label htmlFor="budget-total">Total trip budget (USD)</label>
              <input
                id="budget-total"
                type="number"
                min="0"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="e.g. 2500"
              />
            </div>

            <div className="budget-field">
              <label htmlFor="budget-days">Number of days</label>
              <input
                id="budget-days"
                type="number"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>

            <div className="budget-field">
              <label htmlFor="budget-destination-search">Destination</label>
              <input
                id="budget-destination-search"
                type="text"
                value={destinationSearch}
                onChange={(e) => {
                  setDestinationSearch(e.target.value);
                  setLocationSuggestions([]);
                  setSelectedLocation(null);
                }}
                placeholder="Type a city or country (e.g. Delhi)"
                autoComplete="off"
              />

              {locationLoading && <p className="budget-help-text">Searching destinations…</p>}
              {locationStatus && <p className="budget-help-text">{locationStatus}</p>}

              {locationSuggestions.length > 0 && (
                <ul className="budget-suggestions">
                  {locationSuggestions.map((loc) => (
                    <li key={loc.id}>
                      <button type="button" className="budget-suggestion-btn" onClick={() => selectLocation(loc)}>
                        {loc.name}
                        {loc.region ? `, ${loc.region}` : ""}
                        {loc.country ? `, ${loc.country}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="budget-summary-card">
          <h2>AI Budget Plan</h2>

          {!hasRequiredInput && (
            <p className="budget-help-text">
              Enter destination, number of days, and total budget, then click Generate AI budget plan.
            </p>
          )}

          <div className="budget-actions">
            <button type="button" onClick={() => navigate(-1)}>
              Back
            </button>
            <button type="button" className="budget-secondary" onClick={handleSaveToPlanner}>
              Save to Planner
            </button>
            <button
              type="button"
              className="budget-ai-btn"
              onClick={handleGenerateAiBudget}
              disabled={budgetAiLoading || !hasRequiredInput}
            >
              {budgetAiLoading ? "Generating AI budget..." : "Generate AI budget plan"}
            </button>
          </div>

          {saveMessage && <p className="budget-save-success">{saveMessage}</p>}

          <div className="budget-ai-panel">
            <h3>AI Budget Breakdown (Groq)</h3>
            {currencyLoading && <p className="budget-help-text">Loading local currency conversion…</p>}
            {!currencyLoading && showLocalCurrency && (
              <p className="budget-help-text">
                Showing amounts in USD and {currencyInfo.code} ({currencyInfo.name}).
              </p>
            )}
            {!currencyLoading && currencyError && <p className="budget-help-text">{currencyError}</p>}
            {budgetAiError && <p className="budget-ai-error">{budgetAiError}</p>}

            {!budgetAiError && !budgetAiResult && (
              <p className="budget-help-text">
                AI will generate destination-specific cost allocation and practical local tips.
              </p>
            )}

            {budgetAiResult && (
              <>
                {budgetAiResult.destinationSummary && (
                  <p className="budget-ai-summary">{budgetAiResult.destinationSummary}</p>
                )}
                <div className="budget-breakdown budget-ai-breakdown">
                  <div className="budget-row">
                    <span>Hotel</span>
                    {renderDualAmount(aiBreakdown.hotel || 0)}
                  </div>
                  <div className="budget-row">
                    <span>Food</span>
                    {renderDualAmount(aiBreakdown.food || 0)}
                  </div>
                  <div className="budget-row">
                    <span>Transport</span>
                    {renderDualAmount(aiBreakdown.transport || 0)}
                  </div>
                  <div className="budget-row">
                    <span>Activities</span>
                    {renderDualAmount(aiBreakdown.activities || 0)}
                  </div>
                  <div className="budget-row">
                    <span>Misc</span>
                    {renderDualAmount(aiBreakdown.misc || 0)}
                  </div>
                  <div className="budget-divider" />
                  <div className="budget-row budget-total">
                    <span>AI total</span>
                    {renderDualAmount(aiBreakdown.total || 0)}
                  </div>
                  <div className="budget-row budget-remaining">
                    <span>Remaining budget</span>
                    {renderDualAmount(aiRemaining)}
                  </div>
                </div>

                {Array.isArray(budgetAiResult.tips) && budgetAiResult.tips.length > 0 && (
                  <ul className="budget-ai-tips">
                    {budgetAiResult.tips.map((tip, index) => (
                      <li key={`ai-tip-${index}`}>{tip}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Budget;
