/**
 * DestinationDetail - Single destination: banner, description, weather, attractions, actions.
 * Add to Itinerary → planner; Estimate Budget → placeholder.
 */
import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { getDestination } from "./data/destinations";
import Logo from "./components/Logo";
import "./DestinationDetail.css";

function DestinationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const dest = getDestination(id);

  if (!dest) {
    return (
      <div className="dest-detail-page">
        <header className="dest-detail-nav">
          <Logo className="dest-nav-logo" />
          <Link to="/destinations">← Destinations</Link>
        </header>
        <p>Destination not found.</p>
        <Link to="/destinations">Back to Destinations</Link>
      </div>
    );
  }

  const handleAddToItinerary = () => {
    if (!user) {
      navigate("/register", { state: { from: `/destinations/${id}` } });
      return;
    }
    navigate("/planner", { state: { add: dest.name } });
  };

  const handleEstimateBudget = () => {
    if (!user) {
      navigate("/register", { state: { from: `/destinations/${id}` } });
      return;
    }
    alert(`Budget estimate for ${dest.name} coming soon.`);
  };

  return (
    <div className="dest-detail-page">
      {/* Navigation Bar */}
      <header className="dest-detail-nav">
        <div className="dest-detail-nav-inner">
          <Logo className="dest-nav-logo" />
          <nav className="dest-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
            <Link to="/destinations">← Back to Destinations</Link>
          </nav>
        </div>
      </header>

      {/* Destination Image Banner */}
      <div className="dest-banner" style={{ backgroundImage: `url(${dest.image})` }} />

      {/* Destination Name + Short Description */}
      <section className="dest-info">
        <h1>{dest.name}</h1>
        <p className="dest-desc">{dest.description}</p>
      </section>

      {/* Weather Info Box */}
      <section className="dest-weather">
        <h3>Weather</h3>
        <p>{dest.weather}</p>
      </section>

      {/* Attractions List */}
      <section className="dest-attractions">
        <h3>Attractions</h3>
        <ul>
          {dest.attractions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </section>

      {/* Action Buttons */}
      <section className="dest-actions">
        <button type="button" className="dest-btn dest-btn-primary" onClick={handleAddToItinerary}>Add to Itinerary</button>
        <button type="button" className="dest-btn dest-btn-secondary" onClick={handleEstimateBudget}>Estimate Budget</button>
      </section>
    </div>
  );
}

export default DestinationDetail;
