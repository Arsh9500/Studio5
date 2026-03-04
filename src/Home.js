import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import { loadUserTrips } from "./utils/trips";
import "./Home.css";

function Home() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [trips, setTrips] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);

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
    navigate("/coming-soon?feature=Smart Search");
  };

  useEffect(() => {
    let ignore = false;

    const syncTrips = async () => {
      const savedTrips = await loadUserTrips(user?.uid);
      if (!ignore) setTrips(savedTrips);
    };

    syncTrips();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  const tripAlerts = useMemo(() => {
    const today = new Date();
    const todayString = new Date().toISOString().slice(0, 10);
    const alerts = [];

    trips
      .filter((trip) => trip.startDate >= todayString)
      .forEach((trip) => {
        const budget = Number(trip.budget) || 0;
        const estimated = Number(trip.estimatedCost) || 0;
        if (budget > 0 && estimated > budget) {
          alerts.push(`Budget alert: ${trip.destination} is over budget.`);
        }

        if (trip.startDate) {
          const start = new Date(trip.startDate);
          const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) {
            alerts.push(`Reminder: ${trip.destination} starts in ${diffDays} day${diffDays === 1 ? "" : "s"}.`);
          }
        }
      });

    return alerts;
  }, [trips]);

  const tripSuggestions = useMemo(() => {
    const todayString = new Date().toISOString().slice(0, 10);
    const upcomingTrips = trips
      .filter((trip) => trip.startDate >= todayString)
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
      .slice(0, 3);

    return upcomingTrips.map(
      (trip) => {
        const budget = Number(trip.budget) || 0;
        const estimated = Number(trip.estimatedCost) || 0;
        const budgetTip =
          budget > 0 && estimated > budget
            ? "Reduce optional activities to stay inside budget."
            : "Pre-book transport and top attractions to save time.";

        return `AI Recommendation: For ${trip.destination} (${trip.startDate}${
          trip.endDate ? ` to ${trip.endDate}` : ""
        }), ${budgetTip}`;
      }
    );
  }, [trips]);

  const tripBotMessages = useMemo(() => {
    return [...tripAlerts.map((text) => `Reminder: ${text}`), ...tripSuggestions];
  }, [tripAlerts, tripSuggestions]);

  useEffect(() => {
    if (!user) return;
    if (tripBotMessages.length === 0) {
      if (!chatOpen) setChatBadgeCount(0);
      return;
    }

    setChatMessages((prev) => {
      const existing = new Set(prev.map((m) => `${m.role}:${m.text}`));
      const additions = tripBotMessages
        .filter((text) => !existing.has(`bot:${text}`))
        .map((text) => ({ role: "bot", text }));

      if (!additions.length) return prev;
      if (!chatOpen) setChatBadgeCount((count) => count + additions.length);
      return [...prev, ...additions];
    });
  }, [tripBotMessages, chatOpen, user]);

  useEffect(() => {
    if (chatOpen) setChatBadgeCount(0);
  }, [chatOpen]);

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
      return "Weather alerts page is coming soon. You can still see climate and weather in destination details.";
    }
    if (q.includes("hotel") || q.includes("booking")) {
      return "Hotel booking page is coming soon.";
    }
    if (
      q.includes("alert") ||
      q.includes("reminder") ||
      q.includes("notification") ||
      q.includes("trip status")
    ) {
      if (!user) return "Please login first so I can show your trip reminders and budget alerts.";
      if (tripAlerts.length === 0) return "You have no trip alerts right now.";
      return `Here are your trip alerts: ${tripAlerts.join(" ")}`;
    }
    if (
      q.includes("upcoming") ||
      q.includes("recommend") ||
      q.includes("ai") ||
      q.includes("next trip")
    ) {
      if (!user) return "Please login first so I can recommend upcoming trip actions.";
      if (tripSuggestions.length === 0) {
        return "You have no upcoming trips yet. Add one in Planner or Dashboard and I will recommend next actions.";
      }
      return `Here are AI recommendations for your upcoming trips: ${tripSuggestions.join(" ")}`;
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
              <button
                type="button"
                className="welcome-text welcome-text-link"
                onClick={() => navigate("/dashboard")}
              >
                {welcomeText}, {displayName}
              </button>
            </div>
          )}

          <nav className="nav">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
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
                    ? navigate("/coming-soon?feature=Hotel Bookings")
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
                    ? navigate("/coming-soon?feature=Weather Alerts")
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
        {!chatOpen && chatBadgeCount > 0 && (
          <span className="chatbot-badge">{chatBadgeCount}</span>
        )}
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
