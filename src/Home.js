/**
 * Home - Landing: hero, popular destinations, features. Search/links need login.
 */
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Home.css";

function Home() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const welcomeType = location.state?.welcomeType;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Traveler";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const welcomeText = welcomeType === "back" ? "Welcome back" : "Welcome";
  const onSearchGo = () => { if (!user) navigate("/register", { state: { from: "/" } }); };

  return (
    <div className="home-page">
      {/* Nav */}
      <header className="header">
        <div className="header-inner">
          {user ? (
            <div className="welcome-user">
              <div className="avatar">{avatarLetter}</div>
              <p className="welcome-text">{welcomeText}, {displayName}</p>
            </div>
          ) : (
            <Link to="/" className="logo">LOGO</Link>
          )}
          <nav className="nav">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/about">About</Link>
            {user ? (
              <button type="button" className="nav-login nav-logout" onClick={() => { logout(); }}>Logout</button>
            ) : (
              <Link to="/login" className="nav-login">Login</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">Plan Your Trip Smartly & Easily</h1>
        <div className="hero-search">
          <input type="text" placeholder="Search Destination" />
          <button type="button" onClick={onSearchGo}>Go</button>
        </div>
      </section>

      {/* Destinations grid */}
      <section className="destinations">
        <h2>Popular Destinations</h2>
        <div className="destination-cards">
          <Link to="/destinations/paris" className="dest-card">
            <div className="dest-image" style={{ backgroundImage: "url(https://picsum.photos/300/200?random=1)" }} />
            <span>Paris</span>
          </Link>
          <Link to="/destinations/tokyo" className="dest-card">
            <div className="dest-image" style={{ backgroundImage: "url(https://picsum.photos/300/200?random=2)" }} />
            <span>Tokyo</span>
          </Link>
          <Link to="/destinations/bali" className="dest-card">
            <div className="dest-image" style={{ backgroundImage: "url(https://picsum.photos/300/200?random=3)" }} />
            <span>Bali</span>
          </Link>
          <Link to="/destinations/newyork" className="dest-card">
            <div className="dest-image" style={{ backgroundImage: "url(https://picsum.photos/300/200?random=4)" }} />
            <span>New York</span>
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Why Choose Us</h2>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">💰</div>
            <h3>Budget Planning</h3>
            <p>Plan your trip within your budget with smart cost estimates.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">📋</div>
            <h3>Itinerary Builder</h3>
            <p>Create day-by-day plans and keep everything organized.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🌤️</div>
            <h3>Weather Info</h3>
            <p>Check weather forecasts before you travel.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <p>© {new Date().getFullYear()} Travel Website. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
