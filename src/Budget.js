import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { destinations, getDestination } from "./data/destinations";
import Logo from "./components/Logo";
import "./Budget.css";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildHotelPayload({ budget, pastChoices }) {
  const payload = {
    budget: budget || 0,
    location_preference: "city centre",
    amenities: [],
  };
  if (pastChoices && pastChoices.length) {
    payload.past_choices = pastChoices;
  }
  return payload;
}

function Budget() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const [totalBudget, setTotalBudget] = useState(state.totalBudget || "");
  const [days, setDays] = useState(state.days || 1);

  const [destinationSearch, setDestinationSearch] = useState(state.destinationSearch || "");
  const [destinationId, setDestinationId] = useState(state.destinationId || "");
  const [destinationCosts, setDestinationCosts] = useState({
    foodPerDay: 0,
    localTransportPerDay: 0,
    activitiesPerDay: 0,
    hotelPerNight: 0,
  });

  const [selectedLocation, setSelectedLocation] = useState(state.selectedLocation || null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  const [hotelSearchResults, setHotelSearchResults] = useState([]);
  const [hotelSearchLoading, setHotelSearchLoading] = useState(false);
  const [hotelSearchStatus, setHotelSearchStatus] = useState("");

  const [hotelName, setHotelName] = useState(state.hotelName || "");
  const [hotelPricePerNight, setHotelPricePerNight] = useState(state.hotelPricePerNight || "");

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

  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    setDestinationSearch(loc.name);
    setLocationSuggestions([]);
    setLocationStatus("");

    const matchId = findDestinationIdFromLocation(loc.name);
    setDestinationId(matchId);
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

  const fetchHotelsForLocation = async (loc) => {
    if (!loc) {
      setHotelSearchResults([]);
      setHotelSearchStatus("");
      return;
    }

    setHotelSearchLoading(true);
    setHotelSearchStatus("");

    const overpassQuery = `
[out:json][timeout:25];
(
  node["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${loc.lat},${loc.lon});
  way["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${loc.lat},${loc.lon});
  relation["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${loc.lat},${loc.lon});
);
out center tags 24;
    `.trim();

    try {
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: overpassQuery,
      });

      if (!resp.ok) {
        throw new Error(`Hotels API request failed (${resp.status})`);
      }

      const payload = await resp.json();
      const elements = Array.isArray(payload?.elements) ? payload.elements : [];
      const hotels = elements.slice(0, 16).map((item, index) => {
        const tags = item.tags || {};
        const name = tags.name || `Hotel ${index + 1}`;
        const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || loc.name;
        const country = tags["addr:country"] || loc.country || "";
        const address = [tags["addr:street"], tags["addr:housenumber"], city, country]
          .filter(Boolean)
          .join(", ");

        return {
          id: `${item.type}-${item.id}`,
          name,
          city,
          country,
          address,
          lat: item.lat || item.center?.lat || loc.lat,
          lon: item.lon || item.center?.lon || loc.lon,
        };
      });

      setHotelSearchResults(hotels);
      setHotelSearchStatus(hotels.length ? "" : "No hotels found for this location.");
    } catch (err) {
      console.error(err);
      setHotelSearchStatus("Unable to fetch hotels for this location.");
      setHotelSearchResults([]);
    } finally {
      setHotelSearchLoading(false);
    }
  };

  const fetchHotelPriceForName = async (name) => {
    if (!name) return;
    setHotelSearchStatus("Looking up hotel price...");

    const payload = buildHotelPayload({
      budget: totalBudget,
      pastChoices: [name],
    });

    try {
      const resp = await fetch("http://localhost:5000/recommend-hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`Server responded with ${resp.status}`);
      }

      const data = await resp.json();
      const match = Array.isArray(data?.recommendations)
        ? data.recommendations.find((item) => item.hotel_name === name)
        : null;

      if (match) {
        setHotelPricePerNight(match.price_per_night);
        setHotelSearchStatus("");
      } else {
        const fallback = destination?.estimatedCosts?.hotelPerNight || 0;
        setHotelPricePerNight(fallback);
        setHotelSearchStatus(
          fallback
            ? `Hotel pricing not available; using destination average ($${fallback.toFixed(0)}).`
            : "Hotel pricing not available; please enter it manually."
        );
      }
    } catch (err) {
      console.error(err);
      const fallback = destination?.estimatedCosts?.hotelPerNight || 0;
      setHotelPricePerNight(fallback);
      setHotelSearchStatus(
        fallback
          ? `Unable to fetch hotel pricing; using destination average ($${fallback.toFixed(0)}).`
          : "Unable to fetch hotel pricing. Please enter it manually."
      );
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
    fetchHotelsForLocation(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;
    const matchId = findDestinationIdFromLocation(selectedLocation.name);
    setDestinationId(matchId);
  }, [selectedLocation]);

  useEffect(() => {
    if (!hotelName) return;
    fetchHotelPriceForName(hotelName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelName, totalBudget]);

  const handleHotelSearchSelect = (hotel) => {
    setHotelName(hotel.name);

    // If the hotel API cannot provide a price, use the destination's typical nightly rate.
    const fallbackPrice =
      destinationCosts.hotelPerNight || destination?.estimatedCosts?.hotelPerNight || 0;
    setHotelPricePerNight(fallbackPrice);
    setHotelSearchStatus(
      fallbackPrice
        ? `Estimated nightly rate set from destination averages ($${fallbackPrice.toFixed(0)}).`
        : "Select a hotel to set a price or enter it manually."
    );
  };

  const nights = Math.max(0, safeNumber(days));
  const hotelCost = safeNumber(hotelPricePerNight) * nights;
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
                  setHotelSearchResults([]);
                  setHotelName("");
                  setHotelPricePerNight("");
                  setHotelSearchStatus("");
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

              {selectedLocation && (
                <p className="budget-help-text">
                  Searching hotels near <strong>{selectedLocation.name}</strong>
                  {selectedLocation.region ? `, ${selectedLocation.region}` : ""}
                  {selectedLocation.country ? `, ${selectedLocation.country}` : ""}
                  {" • "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedLocation.name
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on map
                  </a>
                </p>
              )}
            </div>

            <div className="budget-field">
              <label>Hotels in area</label>
              {hotelSearchLoading && <p className="budget-help-text">Fetching hotels…</p>}
              {hotelSearchStatus && <p className="budget-help-text">{hotelSearchStatus}</p>}
              {hotelSearchResults.length > 0 && (
                <div className="budget-hotel-list">
                  {hotelSearchResults.map((hotel) => (
                    <button
                      key={hotel.id}
                      type="button"
                      className={`budget-hotel-item ${hotelName === hotel.name ? "selected" : ""}`}
                      onClick={() => handleHotelSearchSelect(hotel)}
                    >
                      <span className="budget-hotel-title">{hotel.name}</span>
                      <span className="budget-hotel-meta">
                        {hotel.address || `${hotel.city}, ${hotel.country}`}
                      </span>
                      <span className="budget-hotel-action">
                        {hotelName === hotel.name ? "Selected" : "Select"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="budget-help-text">
                Selecting a hotel will fetch a nightly price from the hotel API (if available).
              </p>
            </div>

            <div className="budget-field">
              <label htmlFor="budget-hotel-price">Hotel price per night</label>
              <input
                id="budget-hotel-price"
                type="number"
                min="0"
                placeholder="Hotel price per night"
                value={hotelPricePerNight}
                onChange={(e) => setHotelPricePerNight(e.target.value)}
              />
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
