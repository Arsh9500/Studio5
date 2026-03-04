import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { destinations } from "./data/destinations";
import Logo from "./components/Logo";
import { useAuth } from "./context/AuthContext";
import { loadUserWishlist, saveUserWishlist } from "./utils/wishlist";
import "./Destinations.css";

function Destinations() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("All");
  const [climateFilter, setClimateFilter] = useState("All");
  const [travelTypeFilter, setTravelTypeFilter] = useState("All");
  const [wishlist, setWishlist] = useState([]);

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

  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      const q = searchTerm.trim().toLowerCase();
      const searchMatch =
        q === "" ||
        d.city.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q);

      const budgetMatch = budgetFilter === "All" || d.budgetLevel === budgetFilter;
      const climateMatch = climateFilter === "All" || d.climate === climateFilter;
      const travelTypeMatch = travelTypeFilter === "All" || d.travelType === travelTypeFilter;

      return searchMatch && budgetMatch && climateMatch && travelTypeMatch;
    });
  }, [searchTerm, budgetFilter, climateFilter, travelTypeFilter]);

  const toggleWishlist = (id) => {
    if (!user?.uid) return;
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
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
            <Link to="/planner">Planner</Link>
          </nav>
        </div>
      </header>

      <section className="destinations-list">
        <h1>Explore Destinations</h1>

        <div className="dest-filters">
          <input
            type="text"
            placeholder="Search by city or country"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)}>
            <option value="All">All Budgets</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>

          <select value={climateFilter} onChange={(e) => setClimateFilter(e.target.value)}>
            <option value="All">All Climates</option>
            <option value="Tropical">Tropical</option>
            <option value="Mild">Mild</option>
            <option value="Cold">Cold</option>
          </select>

          <select value={travelTypeFilter} onChange={(e) => setTravelTypeFilter(e.target.value)}>
            <option value="All">All Travel Types</option>
            <option value="Beach">Beach</option>
            <option value="Adventure">Adventure</option>
            <option value="Culture">Culture</option>
            <option value="City">City</option>
          </select>
        </div>

        <p className="wishlist-count">Wishlist saved: {wishlist.length}</p>

        {searchTerm.trim() !== "" && (
          <p className="search-status">
            Results for city/country: <strong>{searchTerm.trim()}</strong>
          </p>
        )}

        <div className="destinations-grid">
          {filteredDestinations.map((d) => {
            const inWishlist = wishlist.includes(d.id);
            const totalPerDay =
              d.estimatedCosts.hotelPerNight +
              d.estimatedCosts.foodPerDay +
              d.estimatedCosts.localTransportPerDay;

            return (
              <div key={d.id} className="dest-card">
                <Link to={`/destinations/${d.id}`} className="dest-card-link">
                  <div className="dest-card-image" style={{ backgroundImage: `url(${d.image})` }} />
                </Link>

                <div className="dest-card-body">
                  <h3>{d.name}</h3>
                  <p>
                    {d.city}, {d.country}
                  </p>
                  <p>
                    {d.budgetLevel} budget | {d.climate} climate | {d.travelType}
                  </p>
                  <p>Estimated daily cost: ${totalPerDay}</p>

                  <div className="dest-card-actions">
                    <Link to={`/destinations/${d.id}`} className="dest-view-link">
                      View details
                    </Link>
                    <button type="button" onClick={() => toggleWishlist(d.id)}>
                      {inWishlist ? "Remove Wishlist" : "Save Wishlist"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredDestinations.length === 0 && (
          <p className="no-results">No destinations found for this city/country and filter combination.</p>
        )}
      </section>
    </div>
  );
}

export default Destinations;
