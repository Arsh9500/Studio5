import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { destinations, getDestination } from "./data/destinations";
import Logo from "./components/Logo";
import "./Budget.css";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function Budget() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const [totalBudget, setTotalBudget] = useState(state.totalBudget || "");
  const [days, setDays] = useState(state.days || 1);

  const [destinationSearch, setDestinationSearch] = useState(state.destinationSearch || "");
  const [destinationId, setDestinationId] = useState(state.destinationId || "");
  const [selectedLocation, setSelectedLocation] = useState(state.selectedLocation || null);
  const [destinationCosts, setDestinationCosts] = useState({
    foodPerDay: 0,
    localTransportPerDay: 0,
    activitiesPerDay: 0,
    hotelPerNight: 0,
  });

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");


  const destination = useMemo(() => getDestination(destinationId), [destinationId]);

  const findDestinationIdFromLocation = (locName) => {
    const normalized = (locName || "").trim().toLowerCase();
    if (!normalized) return "";
    const match = destinations.find(
      (d) =>
        d.city.toLowerCase() === normalized ||
        d.country.toLowerCase() === normalized ||
        d.name.toLowerCase() === normalized
    );
    return match?.id || "";
  };

  const DEFAULT_ESTIMATED_COSTS = {
    foodPerDay: 45,
    localTransportPerDay: 18,
    activitiesPerDay: 40,
    hotelPerNight: 130,
  };

  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    setDestinationSearch(loc.name);
    setLocationSuggestions([]);
    setLocationStatus("");

    const matchId = findDestinationIdFromLocation(loc.name);
    setDestinationId(matchId);

    if (!matchId) {
      setDestinationCosts(DEFAULT_ESTIMATED_COSTS);
    }
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
      const resp = await fetch(
        `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=6`,
        {
          signal,
          headers: { Accept: "application/json" },
        }
      );

      if (!resp.ok) {
        throw new Error(`Location search failed (${resp.status})`);
      }

      const data = await resp.json();
      const locations = (Array.isArray(data) ? data : [])
        .filter((item) =>
          ["city", "town", "village", "municipality", "county", "country"].includes(item.type)
        )
        .map((item) => ({
          id: `${item.osm_type}-${item.osm_id}`,
          name:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.county ||
            item.address?.country ||
            item.display_name ||
            query,
          country: item.address?.country || "",
          region: item.address?.state || item.address?.region || "",
          lat: Number(item.lat),
          lon: Number(item.lon),
        }))
        .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon));

      setLocationSuggestions(locations);
      setLocationStatus(locations.length ? "" : "No matching locations found.");
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      setLocationStatus("Unable to search locations. Check your connection.");
      setLocationSuggestions([]);
    } finally {
      setLocationLoading(false);
    }
  };


  useEffect(() => {
    if (!destinationId) return;

    const dest = getDestination(destinationId);
    if (!dest) {
      setDestinationCosts({ foodPerDay: 0, localTransportPerDay: 0, activitiesPerDay: 0 });
      return;
    }

    setDestinationCosts({
      foodPerDay: dest.estimatedCosts.foodPerDay || 0,
      localTransportPerDay: dest.estimatedCosts.localTransportPerDay || 0,
      activitiesPerDay: dest.estimatedCosts.activitiesPerDay || 0,
      hotelPerNight: dest.estimatedCosts.hotelPerNight || 0,
    });
  }, [destinationId]);

  useEffect(() => {
    if (!destination) return;
    setDestinationSearch(destination.name);
  }, [destination]);

  useEffect(() => {
    if (!destinationId && selectedLocation) return;

    // When there is no matching preset destination but a location is chosen,
    // keep the destination search text set to the selected place name.
    if (!destinationId && selectedLocation) {
      setDestinationSearch(selectedLocation.name);
    }
  }, [destinationId, selectedLocation]);

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
    if (!selectedLocation) return;
    const matchId = findDestinationIdFromLocation(selectedLocation.name);
    setDestinationId(matchId);
  }, [selectedLocation]);


  const nights = Math.max(0, safeNumber(days));
  const hotelCost = safeNumber(destinationCosts.hotelPerNight) * nights;
  const foodCost = safeNumber(destinationCosts.foodPerDay) * nights;
  const transportCost = safeNumber(destinationCosts.localTransportPerDay) * nights;
  const activitiesCost = safeNumber(destinationCosts.activitiesPerDay) * nights;
  const estimatedTotal = hotelCost + foodCost + transportCost + activitiesCost;
  const remaining = safeNumber(totalBudget) - estimatedTotal;

  const showOverBudget = safeNumber(totalBudget) > 0 && estimatedTotal > safeNumber(totalBudget);

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
          <p>
            Enter your trip details and see a breakdown of estimated expenses based on your destination and
            hotel choices.
          </p>
          <p className="budget-selected">
            {destination ? (
              <>
                Selected destination: <strong>{destination.name}</strong>
              </>
            ) : selectedLocation ? (
              <>
                Selected location: <strong>{selectedLocation.name}</strong>
              </>
            ) : (
              "Select a destination to auto-populate food, transport, and activity cost estimates."
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
                placeholder="Type a city or country (e.g. Paris)"
                autoComplete="off"
              />

              {locationLoading && <p className="budget-help-text">Searching destinations…</p>}
              {locationStatus && <p className="budget-help-text">{locationStatus}</p>}

              {locationSuggestions.length > 0 && (
                <ul className="budget-suggestions">
                  {locationSuggestions.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        className="budget-suggestion-btn"
                        onClick={() => selectLocation(loc)}
                      >
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
          <h2>Budget Breakdown</h2>
          <div className="budget-breakdown">
            <div className="budget-row">
              <span>Hotel ({nights} nights)</span>
              <span>${hotelCost.toFixed(0)}</span>
            </div>
            <div className="budget-row">
              <span>Food ({nights} days)</span>
              <span>${foodCost.toFixed(0)}</span>
            </div>
            <div className="budget-row">
              <span>Transport ({nights} days)</span>
              <span>${transportCost.toFixed(0)}</span>
            </div>
            <div className="budget-row">
              <span>Activities ({nights} days)</span>
              <span>${activitiesCost.toFixed(0)}</span>
            </div>
            <div className="budget-divider" />
            <div className="budget-row budget-total">
              <span>Total estimated cost</span>
              <span>${estimatedTotal.toFixed(0)}</span>
            </div>
            <div className="budget-row budget-remaining">
              <span>Remaining budget</span>
              <span>${remaining.toFixed(0)}</span>
            </div>
          </div>

          {showOverBudget && (
            <div className="budget-warning">
              <strong>Over budget!</strong> Try a cheaper hotel, reduce the number of days, or choose fewer activities.
            </div>
          )}

          <div className="budget-actions">
            <button type="button" onClick={() => navigate(-1)}>
              Back
            </button>
            <Link to="/planner" className="budget-secondary">
              Save to Planner
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Budget;
