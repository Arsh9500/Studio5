import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { destinations } from "./data/destinations";
import Logo from "./components/Logo";
import { useAuth } from "./context/AuthContext";
import { loadUserWishlist, saveUserWishlist } from "./utils/wishlist";
import "./Destinations.css";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const WIKIPEDIA_SUMMARY_BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const FILTER_ALL_OPTION = "All";
const DEFAULT_HOTEL_TYPES = ["Hotel", "Guest House", "Hostel", "Apartment", "Motel"];
const DEFAULT_STAR_OPTIONS = ["Unrated", "3 Star", "4 Star", "5 Star"];
const DEFAULT_AMENITIES = ["Wi-Fi", "Parking", "Pool", "Breakfast", "Accessible", "Air Conditioning", "General"];
const COUNTRY_CITY_SEEDS = {
  australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast"],
  japan: ["Tokyo", "Osaka", "Kyoto", "Sapporo", "Fukuoka"],
  france: ["Paris", "Lyon", "Nice", "Marseille", "Bordeaux"],
  italy: ["Rome", "Milan", "Venice", "Florence", "Naples"],
  usa: ["New York", "Los Angeles", "Chicago", "Miami", "Las Vegas"],
  "united states": ["New York", "Los Angeles", "Chicago", "Miami", "Las Vegas"],
  canada: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
  "new zealand": ["Auckland", "Wellington", "Queenstown", "Christchurch", "Rotorua"],
};

function fallbackImage(hotelName, locationName) {
  return `https://source.unsplash.com/900x600/?${encodeURIComponent(
    `${hotelName || "hotel"},${locationName || "travel stay"}`
  )}`;
}

function getHotelWishlistKey(hotel) {
  return `hotel:${hotel.osmType}:${hotel.osmId}`.toLowerCase();
}

function getHotelType(tags) {
  if (tags.tourism === "guest_house") return "Guest House";
  if (tags.tourism === "hostel") return "Hostel";
  if (tags.tourism === "motel") return "Motel";
  if (tags.tourism === "apartment") return "Apartment";
  if (tags.building === "hotel") return "Hotel";
  return "Hotel";
}

function getHotelStars(tags) {
  const rawStars = String(tags.stars || tags["hotel:stars"] || tags.hotel_class || "").trim();
  const normalizedStars = rawStars.replace(/[^0-9]/g, "");
  if (!normalizedStars) return "Unrated";
  const count = Number(normalizedStars);
  return Number.isFinite(count) && count > 0 ? `${count} Star` : "Unrated";
}

function getHotelAmenity(tags) {
  if (tags.swimming_pool === "yes" || tags.pool === "yes") return "Pool";
  if (tags.breakfast === "yes") return "Breakfast";
  if (tags.internet_access === "wlan" || tags.wifi === "yes") return "Wi-Fi";
  if (tags.parking === "yes") return "Parking";
  if (tags["wheelchair"] === "yes") return "Accessible";
  if (tags["air_conditioning"] === "yes") return "Air Conditioning";
  return "General";
}

function buildFallbackHotelsFromCities(countryName, cities, region = "Unknown") {
  const amenityCycle = ["Wi-Fi", "Parking", "Pool", "Breakfast", "Accessible", "Air Conditioning"];
  const typeCycle = ["Hotel", "Guest House", "Apartment", "Hostel", "Motel"];
  const starCycle = ["3 Star", "4 Star", "5 Star", "Unrated"];

  return cities.flatMap((city, cityIndex) =>
    Array.from({ length: 4 }, (_, hotelIndex) => {
      const optionIndex = cityIndex + hotelIndex;
      const hotelType = typeCycle[optionIndex % typeCycle.length];
      return {
        id: `fallback-${countryName}-${city}-${hotelIndex}`,
        osmId: `fallback-${countryName}-${city}-${hotelIndex}`,
        osmType: "fallback",
        name: `${city} ${["Central", "Harbour", "Grand", "Suites"][hotelIndex]} ${hotelType}`,
        city,
        region,
        country: countryName,
        lat: 0,
        lon: 0,
        type: hotelType,
        stars: starCycle[optionIndex % starCycle.length],
        amenity: amenityCycle[optionIndex % amenityCycle.length],
        address: `${city}, ${countryName}`,
        image: fallbackImage(`${city} ${hotelType}`, `${city}, ${countryName}`),
        source: "fallback",
      };
    })
  );
}

function fallbackHotelsForQuery(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const seededCities = COUNTRY_CITY_SEEDS[normalizedQuery];
  if (seededCities?.length) {
    const countryName = query.trim();
    return buildFallbackHotelsFromCities(countryName, seededCities);
  }

  const source = destinations.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.city.toLowerCase().includes(normalizedQuery) ||
      item.country.toLowerCase().includes(normalizedQuery) ||
      (item.region || "").toLowerCase().includes(normalizedQuery)
    );
  });

  if (!source.length) return [];

  const groupedByCountry = new Map();
  source.forEach((item) => {
    const key = item.country;
    if (!groupedByCountry.has(key)) groupedByCountry.set(key, []);
    groupedByCountry.get(key).push(item.city);
  });

  return [...groupedByCountry.entries()].flatMap(([country, cities]) =>
    buildFallbackHotelsFromCities(country, [...new Set(cities)].slice(0, 6))
  );
}

function getHotelAddress(tags, fallbackLocation) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:country"],
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : fallbackLocation;
}

async function resolveHotelImage(hotelName, locationName, signal) {
  const candidates = [hotelName, `${hotelName} ${locationName}`, locationName].filter(Boolean);

  for (const title of candidates) {
    const response = await fetch(`${WIKIPEDIA_SUMMARY_BASE_URL}/${encodeURIComponent(title)}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) continue;
    const payload = await response.json();
    if (payload?.thumbnail?.source) {
      return payload.thumbnail.source;
    }
  }

  return fallbackImage(hotelName, locationName);
}

function Hotels() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [hotelTypeFilter, setHotelTypeFilter] = useState(FILTER_ALL_OPTION);
  const [starFilter, setStarFilter] = useState(FILTER_ALL_OPTION);
  const [amenityFilter, setAmenityFilter] = useState(FILTER_ALL_OPTION);
  const [sortBy, setSortBy] = useState("a-z");
  const [liveHotelsLoading, setLiveHotelsLoading] = useState(false);
  const [liveHotelsStatus, setLiveHotelsStatus] = useState("");
  const [liveHotels, setLiveHotels] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [selectedLocationInfo, setSelectedLocationInfo] = useState(null);
  const [selectedCityGroup, setSelectedCityGroup] = useState(FILTER_ALL_OPTION);
  const [wishlist, setWishlist] = useState([]);

  const featuredSearches = useMemo(() => destinations.slice(0, 6), []);

  useEffect(() => {
    let ignore = false;

    const syncWishlist = async () => {
      const list = await loadUserWishlist(user?.uid);
      if (!ignore) setWishlist(list);
    };

    syncWishlist();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  const fetchLiveHotels = useCallback(async (rawQuery, signal) => {
    const q = rawQuery.trim();

    if (!q) {
      setLiveHotels([]);
      setLocationSuggestions([]);
      setSelectedLocationInfo(null);
      setSelectedCityGroup(FILTER_ALL_OPTION);
      setLiveHotelsLoading(false);
      return;
    }

    setLiveHotelsLoading(true);
    setLiveHotelsStatus("");
    setSelectedCityGroup(FILTER_ALL_OPTION);

    try {
      const locationResponse = await fetch(
        `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=8`,
        {
          signal,
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!locationResponse.ok) {
        setLiveHotels([]);
        setLocationSuggestions([]);
        setSelectedLocationInfo(null);
        setLiveHotelsStatus(`No location found for "${q}".`);
        return;
      }

      const locationPayload = await locationResponse.json();
      const locations = (Array.isArray(locationPayload) ? locationPayload : [])
        .filter((item) => ["city", "town", "village", "municipality", "county", "country"].includes(item.type))
        .map((item) => ({
          id: `${item.osm_type}-${item.osm_id}`,
          locationType: item.type,
          name:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.county ||
            item.address?.country ||
            item.name ||
            q,
          region: item.address?.state || item.address?.region || "Unknown",
          country: item.address?.country || "Unknown",
          lat: Number(item.lat),
          lon: Number(item.lon),
          displayName: item.display_name || q,
        }))
        .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon))
        .slice(0, 8);

      setLocationSuggestions(locations);

      if (!locations.length) {
        const fallbackHotels = fallbackHotelsForQuery(q);
        setLiveHotels(fallbackHotels);
        setSelectedLocationInfo(null);
        setLiveHotelsStatus(
          fallbackHotels.length
            ? `Live hotel API returned no location for "${q}". Showing fallback hotel data instead.`
            : `No location found for "${q}".`
        );
        return;
      }

      const selectedLocation =
        locations.find((item) => item.name.toLowerCase() === q.toLowerCase()) ||
        locations.find((item) => item.displayName.toLowerCase().includes(q.toLowerCase())) ||
        locations[0];

      setSelectedLocationInfo(selectedLocation);

      if (selectedLocation.locationType === "country") {
        const fallbackHotels = fallbackHotelsForQuery(selectedLocation.name);
        setLiveHotels(fallbackHotels);
        setLiveHotelsStatus(
          fallbackHotels.length
            ? `Showing hotel categories for ${selectedLocation.name}. Choose a city like Sydney or Melbourne to see more options.`
            : `No hotel categories found for "${selectedLocation.name}".`
        );
        return;
      }

      const overpassQuery = `
[out:json][timeout:25];
(
  node["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${selectedLocation.lat},${selectedLocation.lon});
  way["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${selectedLocation.lat},${selectedLocation.lon});
  relation["tourism"~"hotel|guest_house|hostel|motel|apartment"](around:15000,${selectedLocation.lat},${selectedLocation.lon});
);
out center tags 24;
      `.trim();

      const hotelResponse = await fetch(OVERPASS_URL, {
        signal,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: overpassQuery,
      });

      if (!hotelResponse.ok) {
        throw new Error(`Hotels API request failed (${hotelResponse.status})`);
      }

      const hotelPayload = await hotelResponse.json();
      const hotelElements = Array.isArray(hotelPayload?.elements) ? hotelPayload.elements : [];
      const hotels = await Promise.all(
        hotelElements.slice(0, 18).map(async (item, index) => {
          const tags = item.tags || {};
          const hotelName = tags.name || `${selectedLocation.name} Stay ${index + 1}`;
          const hotelType = getHotelType(tags);
          const stars = getHotelStars(tags);
          const amenity = getHotelAmenity(tags);
          const locationName = `${selectedLocation.name}, ${selectedLocation.country}`;

          return {
            id: `${item.type}-${item.id}`,
            osmId: item.id,
            osmType: item.type,
            name: hotelName,
            city:
              tags["addr:city"] ||
              tags["addr:town"] ||
              tags["addr:village"] ||
              selectedLocation.name,
            region: selectedLocation.region,
            country: selectedLocation.country,
            lat: item.lat || item.center?.lat || selectedLocation.lat,
            lon: item.lon || item.center?.lon || selectedLocation.lon,
            type: hotelType,
            stars,
            amenity,
            address: getHotelAddress(tags, locationName),
            image: await resolveHotelImage(hotelName, locationName, signal).catch(() =>
              fallbackImage(hotelName, locationName)
            ),
          };
        })
      );

      if (hotels.length) {
        setLiveHotels(hotels);
      } else {
        const fallbackHotels = fallbackHotelsForQuery(selectedLocation.name);
        setLiveHotels(fallbackHotels);
      }

      if (!hotels.length) {
        setLiveHotelsStatus(
          `Live hotel API returned no hotels for "${selectedLocation.name}". Showing fallback hotel data instead.`
        );
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      const fallbackHotels = fallbackHotelsForQuery(q);
      setLiveHotels(fallbackHotels);
      setLocationSuggestions([]);
      setSelectedLocationInfo(null);
      setLiveHotelsStatus(
        fallbackHotels.length
          ? "Live hotel search failed from the browser. Showing fallback hotel data instead."
          : "Live hotel search failed. Check internet/API availability."
      );
    } finally {
      if (!signal?.aborted) {
        setLiveHotelsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchLiveHotels(searchTerm, controller.signal);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, fetchLiveHotels]);

  const hotelTypeOptions = useMemo(
    () => [FILTER_ALL_OPTION, ...new Set([...DEFAULT_HOTEL_TYPES, ...liveHotels.map((item) => item.type).filter(Boolean)])],
    [liveHotels]
  );
  const starOptions = useMemo(
    () => [FILTER_ALL_OPTION, ...new Set([...DEFAULT_STAR_OPTIONS, ...liveHotels.map((item) => item.stars).filter(Boolean)])],
    [liveHotels]
  );
  const amenityOptions = useMemo(
    () => [FILTER_ALL_OPTION, ...new Set([...DEFAULT_AMENITIES, ...liveHotels.map((item) => item.amenity).filter(Boolean)])],
    [liveHotels]
  );
  const cityGroups = useMemo(() => {
    const groups = new Map();
    liveHotels.forEach((item) => {
      const key = item.city || "Unknown";
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [liveHotels]);

  const visibleHotels = useMemo(() => {
    const normalizedCityFilter = cityFilter.trim().toLowerCase();
    const filtered = liveHotels.filter((item) => {
      const cityMatches = normalizedCityFilter
        ? item.city.toLowerCase().includes(normalizedCityFilter) || item.name.toLowerCase().includes(normalizedCityFilter)
        : true;
      const cityGroupMatches = selectedCityGroup === FILTER_ALL_OPTION || item.city === selectedCityGroup;
      const hotelTypeMatches = hotelTypeFilter === FILTER_ALL_OPTION || item.type === hotelTypeFilter;
      const starMatches = starFilter === FILTER_ALL_OPTION || item.stars === starFilter;
      const amenityMatches = amenityFilter === FILTER_ALL_OPTION || item.amenity === amenityFilter;

      return cityMatches && cityGroupMatches && hotelTypeMatches && starMatches && amenityMatches;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "z-a") return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });
  }, [liveHotels, cityFilter, selectedCityGroup, hotelTypeFilter, starFilter, amenityFilter, sortBy]);

  const handleWishlist = (hotel) => {
    if (!user?.uid) return;
    const wishlistId = getHotelWishlistKey(hotel);

    setWishlist((prev) => {
      const next = prev.includes(wishlistId)
        ? prev.filter((item) => item !== wishlistId)
        : [...prev, wishlistId];

      saveUserWishlist(user.uid, next);
      return next;
    });
  };

  return (
    <div className="destinations-page">
      <header className="destinations-nav">
        <div className="destinations-nav-inner">
          <Logo className="dest-nav-logo" />
          <nav className="dest-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/hotels">Hotels</Link>
            <Link to="/planner">Planner</Link>
          </nav>
        </div>
      </header>

      <section className="destinations-list">
        <div className="destinations-hero">
          <h1>Explore Hotels</h1>
          <p>Search any city or country and browse live hotels with the same destination-style layout.</p>
        </div>

        <section className="search-panel">
          <div className="city-search-wrap">
            <label htmlFor="hotel-search">City or Country</label>
            <input
              id="hotel-search"
              type="text"
              placeholder="Type a city or country (e.g. Tokyo, Paris, New Zealand)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchTerm.trim().length >= 2 && (
              <div className="city-autocomplete" role="listbox" aria-label="Location suggestions">
                {liveHotelsLoading && <p className="city-autocomplete-status">Loading locations...</p>}
                {!liveHotelsLoading && locationSuggestions.length === 0 && (
                  <p className="city-autocomplete-status">No location suggestions yet.</p>
                )}
                {!liveHotelsLoading && locationSuggestions.length > 0 && (
                  <ul>
                    {locationSuggestions.map((location) => (
                      <li key={location.id}>
                        <button type="button" onClick={() => setSearchTerm(location.name)}>
                          <span>{location.name}</span>
                          <small>
                            {location.country}
                            {location.region !== "Unknown" ? ` - ${location.region}` : ""}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="filter-grid">
            <div className="filter-field">
              <label htmlFor="city-filter">City Filter</label>
              <input
                id="city-filter"
                type="text"
                placeholder="Optional hotel or city keyword"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="hotel-type-filter">Hotel Type</label>
              <select
                id="hotel-type-filter"
                value={hotelTypeFilter}
                onChange={(e) => setHotelTypeFilter(e.target.value)}
              >
                {hotelTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type === FILTER_ALL_OPTION ? "All Hotel Types" : type}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="star-filter">Rating</label>
              <select id="star-filter" value={starFilter} onChange={(e) => setStarFilter(e.target.value)}>
                {starOptions.map((stars) => (
                  <option key={stars} value={stars}>
                    {stars === FILTER_ALL_OPTION ? "All Ratings" : stars}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="amenity-filter">Amenity</label>
              <select id="amenity-filter" value={amenityFilter} onChange={(e) => setAmenityFilter(e.target.value)}>
                {amenityOptions.map((amenity) => (
                  <option key={amenity} value={amenity}>
                    {amenity === FILTER_ALL_OPTION ? "All Amenities" : amenity}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="sort-filter">Sort</label>
              <select id="sort-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="a-z">Hotel Name (A-Z)</option>
                <option value="z-a">Hotel Name (Z-A)</option>
              </select>
            </div>
          </div>
          <p className="city-autocomplete-status">
            Amenity means hotel facilities such as Wi-Fi, parking, breakfast, pool, accessibility, or air conditioning.
          </p>
        </section>

        {searchTerm.trim() === "" && (
          <section className="popular-section">
            <div className="popular-section-head">
              <h2>Popular Hotel Searches</h2>
              <p>Start with the same popular destinations and jump straight into hotel results.</p>
            </div>
            <div className="destinations-grid">
              {featuredSearches.map((item) => (
                <article key={`hotel-feature-${item.id}`} className="dest-card popular-card">
                  <div className="dest-card-image" style={{ backgroundImage: `url(${item.image})` }} />
                  <div className="dest-card-body">
                    <h3>
                      {item.city}, {item.country}
                    </h3>
                    <p className="city-source">Hotel search starter</p>
                    <p className="city-tags">{item.description}</p>
                    <div className="live-card-actions">
                      <button type="button" onClick={() => setSearchTerm(item.city)}>
                        Find Hotels
                      </button>
                      <button type="button" onClick={() => navigate("/planner", { state: { add: `${item.city}, ${item.country}` } })}>
                        Plan Itinerary
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {liveHotelsStatus && <p className="search-status">{liveHotelsStatus}</p>}

        {searchTerm.trim() !== "" && selectedLocationInfo && (
          <div className="active-summary">
            <p>
              Live hotels for <strong>{selectedLocationInfo.name}</strong>
            </p>
            <span>{selectedLocationInfo.country}</span>
            {selectedLocationInfo.region !== "Unknown" && <span>{selectedLocationInfo.region}</span>}
            {selectedCityGroup !== FILTER_ALL_OPTION && <span>{selectedCityGroup}</span>}
            <span>{visibleHotels.length} hotels</span>
          </div>
        )}

        {searchTerm.trim() !== "" && cityGroups.length > 0 && (
          <section className="popular-section">
            <div className="popular-section-head">
              <h2>City Categories</h2>
              <p>Pick a city to show more hotel options for that location.</p>
            </div>
            <div className="live-card-actions">
              <button
                type="button"
                className={selectedCityGroup === FILTER_ALL_OPTION ? "wishlist-btn is-saved" : "wishlist-btn"}
                onClick={() => {
                  setSelectedCityGroup(FILTER_ALL_OPTION);
                  setCityFilter("");
                }}
              >
                All Cities ({liveHotels.length})
              </button>
              {cityGroups.map(([city, count]) => (
                <button
                  key={city}
                  type="button"
                  className={selectedCityGroup === city ? "wishlist-btn is-saved" : "wishlist-btn"}
                  onClick={() => {
                    setSelectedCityGroup(city);
                    setCityFilter(city);
                  }}
                >
                  {city} ({count})
                </button>
              ))}
            </div>
          </section>
        )}

        {visibleHotels.length > 0 && (
          <section className="live-cities-section">
            <h2>Live Hotels</h2>
            <div className="destinations-grid">
              {visibleHotels.map((hotel) => {
                const wishlistId = getHotelWishlistKey(hotel);
                const isSaved = wishlist.includes(wishlistId);

                return (
                  <article key={hotel.id} className="dest-card live-city-card">
                    <div className="dest-card-image" style={{ backgroundImage: `url(${hotel.image})` }} />
                    <div className="dest-card-body">
                      <h3>{hotel.name}</h3>
                      <p className="city-source">
                        {hotel.city}, {hotel.country}
                      </p>
                      <p className="city-tags">
                        {hotel.type} | {hotel.stars} | {hotel.amenity}
                      </p>
                      <p className="city-tags">{hotel.address}</p>
                      <div className="live-card-actions">
                        <a
                          className="dest-view-link"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${hotel.name}, ${hotel.city}, ${hotel.country}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Details
                        </a>
                        <button
                          type="button"
                          onClick={() => navigate("/planner", { state: { add: `${hotel.city}, ${hotel.country}` } })}
                        >
                          Plan Itinerary
                        </button>
                        <button
                          type="button"
                          className={isSaved ? "wishlist-btn is-saved" : "wishlist-btn"}
                          onClick={() => handleWishlist(hotel)}
                        >
                          {isSaved ? "Saved Wishlist" : "Save Wishlist"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!liveHotelsLoading && searchTerm.trim() && liveHotels.length === 0 && !liveHotelsStatus && (
          <p className="no-results">No live hotels found.</p>
        )}
      </section>

      <footer className="destinations-footer">
        <div className="destinations-footer-inner">
          <p>TripPlan Live Hotels</p>
          <p>Search locations, browse live hotel listings, and move straight into itinerary planning.</p>
        </div>
      </footer>
    </div>
  );
}

export default Hotels;
