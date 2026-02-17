import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./About.css";

function About() {
  const { user, logout } = useAuth();

  return (
    <div className="about-page">
      {/* Navigation Bar */}
      <header className="about-nav">
        <div className="about-nav-inner">
          <Link to="/" className="about-logo">LOGO</Link>
          <nav className="about-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            <Link to="/about">About</Link>
            {user ? (
              <button type="button" className="about-login about-logout" onClick={() => logout()}>Logout</button>
            ) : (
              <Link to="/login" className="about-login">Login</Link>
            )}
          </nav>
        </div>
      </header>

      {/* About Us Title */}
      <section className="about-hero">
        <h1>About Us</h1>
      </section>

      {/* Short Introduction */}
      <section className="about-intro">
        <p className="about-mission">Our mission is to simplify travel planning.</p>
        <p>We help you discover destinations, plan your itinerary, and manage your budget—all in one place.</p>
      </section>

      {/* Vision Section */}
      <section className="about-vision">
        <h2>Vision</h2>
        <p>To be the go-to platform for stress-free trip planning, so you can focus on enjoying your journey.</p>
      </section>

      {/* Features Overview */}
      <section className="about-features">
        <h2>Features Overview</h2>
        <ul>
          <li><strong>Destination Search</strong> — Find and explore places you want to visit.</li>
          <li><strong>Budget Planner</strong> — Plan your trip within your budget.</li>
          <li><strong>Itinerary Builder</strong> — Create day-by-day plans for your trip.</li>
        </ul>
      </section>

      {/* Contact Information */}
      <section className="about-contact">
        <h2>Contact Information</h2>
        <p>Email: contact@tripplanner.com</p>
        <p>Phone: +1 (555) 123-4567</p>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-inner">
          <p>© {new Date().getFullYear()} Trip Planner. All rights reserved.</p>
          <div className="about-footer-links">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default About;
