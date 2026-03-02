import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import "./Home.css";

function Home() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hi, I am your travel assistant. Ask about destinations, budget, or weather.",
    },
  ]);

  const welcomeType = location.state?.welcomeType;
  const displayName =
    user?.displayName || user?.name || user?.email?.split("@")[0] || "Traveler";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const welcomeText = welcomeType === "back" ? "Welcome back" : "Welcome";

  const handleSearchGo = () => {
    if (!user) {
      navigate("/register", { state: { from: "/" } });
      return;
    }
    // TODO: do search when logged in
  };

  const getBotReply = (text) => {
    const q = text.toLowerCase();
    if (q.includes("destination") || q.includes("city") || q.includes("country")) {
      return "Use the Destinations page to search by city or country and filter by budget, climate, and travel type.";
    }
    if (q.includes("budget") || q.includes("cost") || q.includes("price")) {
      return "Open a destination to see estimated costs for flight, hotel, food, and local transport.";
    }
    if (q.includes("wishlist") || q.includes("save")) {
      return user
        ? "You can save trips to wishlist on Destinations and Detail pages. They are saved to your Firebase profile."
        : "Please login or register first, then you can save wishlist trips to your account.";
    }
    if (q.includes("planner") || q.includes("plan")) {
      return "Use the Planner page to organize your itinerary and trip plan.";
    }
    if (q.includes("weather")) {
      return "Destination cards include climate and each destination detail page includes weather info.";
    }
    return "I can help with destinations, budget, weather, wishlist, and trip planning.";
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMessage = { role: "user", text };
    const botMessage = { role: "bot", text: getBotReply(text) };

    setChatMessages((prev) => [...prev, userMessage, botMessage]);
    setChatInput("");
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <Logo className="logo" />

          {user && (
            <div className="welcome-user">
              <span className="avatar">{avatarLetter}</span>
              <p className="welcome-text">
                {welcomeText}, {displayName}
              </p>
            </div>
          )}

          <nav className="nav">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            {user && <Link to="/profile">Profile</Link>}
            <Link to="/about">About</Link>
            {user ? (
              <button
                type="button"
                className="nav-login nav-logout"
                onClick={() => {
                  logout();
                }}
              >
                Logout
              </button>
            ) : (
              <Link to="/login" className="nav-login">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section with background image */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">Plan Your Trip Smartly & Easily</h1>
          <div className="hero-search">
            <input
              type="text"
              placeholder="Search the site: profile, About, destinations, and more"
            />
            <button type="button" onClick={handleSearchGo}>
              Go
            </button>
          </div>
        </div>
      </section>

      {/* Cards section: Destination Search + Budget, Hotel, Weather */}
      <section className="home-cards-section">
        <h2 className="home-cards-heading">Where would you like to go?</h2>
        <div className="home-cards-grid">
          {/* Destination Search card */}
          <div className="home-card home-card-destination">
            <div
              className="home-card-image"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600)",
              }}
            />
            <div className="home-card-body">
              <h3>Destination Search</h3>
              <p>
                Discover where you want to travel. Explore places, compare
                destinations, and find your next adventure.
              </p>
              <button
                type="button"
                className="home-card-cta"
                onClick={() =>
                  user
                    ? navigate("/destinations")
                    : navigate("/register", { state: { from: "/" } })
                }
              >
                Explore destinations
              </button>
            </div>
          </div>

          {/* Budget Planning card */}
          <div className="home-card home-card-budget">
            <div
              className="home-card-image"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600)",
              }}
            />
            <div className="home-card-body">
              <h3>Budget Planning</h3>
              <p>
                Set your trip budget, track expenses, and get smart cost
                estimates for flights, stays, and activities.
              </p>
              <button
                type="button"
                className="home-card-cta"
                onClick={() =>
                  user
                    ? navigate("/planner")
                    : navigate("/register", { state: { from: "/" } })
                }
              >
                Plan my budget
              </button>
            </div>
          </div>

          {/* Hotel Bookings card */}
          <div className="home-card home-card-hotel">
            <div
              className="home-card-image"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600)",
              }}
            />
            <div className="home-card-body">
              <h3>Hotel Bookings</h3>
              <p>
                Find and book hotels that fit your budget. Compare prices, read
                reviews, and reserve your stay.
              </p>
              <button
                type="button"
                className="home-card-cta"
                onClick={() =>
                  user
                    ? navigate("/planner")
                    : navigate("/register", { state: { from: "/" } })
                }
              >
                Find hotels
              </button>
            </div>
          </div>

          {/* Weather Check card */}
          <div className="home-card home-card-weather">
            <div
              className="home-card-image"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=600)",
              }}
            />
            <div className="home-card-body">
              <h3>Weather Check</h3>
              <p>
                Check forecasts for your destination. Pack right and plan outdoor
                activities with up-to-date conditions.
              </p>
              <button
                type="button"
                className="home-card-cta"
                onClick={() =>
                  user
                    ? navigate("/planner")
                    : navigate("/register", { state: { from: "/" } })
                }
              >
                Check weather
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <p>&copy; {new Date().getFullYear()} Travel Website. All rights reserved.</p>
        </div>
      </footer>

      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setChatOpen((prev) => !prev)}
      >
        {chatOpen ? "Close Chat" : "Chat"}
      </button>

      {chatOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">Travel Chatbot</div>

          <div className="chatbot-messages">
            {chatMessages.map((m, index) => (
              <div
                key={`${m.role}-${index}`}
                className={`chatbot-message ${m.role === "user" ? "chat-user" : "chat-bot"}`}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="chatbot-input-row">
            <input
              type="text"
              placeholder="Ask something..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
            />
            <button type="button" onClick={handleSendMessage}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
