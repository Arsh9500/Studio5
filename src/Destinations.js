/**
 * Destinations - List of destination cards (from data/destinations). Links to detail page.
 */
import React from "react";
import { Link } from "react-router-dom";
import { destinations } from "./data/destinations";
import "./Destinations.css";

function Destinations() {
  return (
    <div className="destinations-page">
      <header className="destinations-nav">
        <div className="destinations-nav-inner">
          <Link to="/" className="dest-nav-logo">LOGO</Link>
          <nav className="dest-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
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
