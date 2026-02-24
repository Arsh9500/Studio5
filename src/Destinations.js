/**
 * Destinations - List of destination cards (from data/destinations). Links to detail page.
 */
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { destinations } from "./data/destinations";
import Logo from "./components/Logo";
import "./Destinations.css";

function Destinations() {
  const { user } = useAuth();
  return (
    <div className="destinations-page">
      <header className="destinations-nav">
        <div className="destinations-nav-inner">
          <Logo className="dest-nav-logo" />
          <nav className="dest-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
          </nav>
        </div>
      </header>

      <section className="destinations-list">
        <h1>Popular Destinations</h1>
        <div className="destinations-grid">
          {destinations.map((d) => (
            <Link key={d.id} to={`/destinations/${d.id}`} className="dest-card-link">
              <div className="dest-card-image" style={{ backgroundImage: `url(${d.image})` }} />
              <span>{d.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Destinations;
