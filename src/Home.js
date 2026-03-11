import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import { loadUserTrips } from "./utils/trips";
import { categorizeTrips } from "./utils/tripStatus";
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
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const welcomeType = location.state?.welcomeType;
  const displayName =
    user?.displayName || user?.name || user?.email?.split("@")[0] || "Traveler";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const welcomeText = welcomeType === "back" ? "Welcome back" : "Welcome";
  const goToDestinations = () => {
    if (user) {
      navigate("/destinations");
      return;
    }
    navigate("/register", { state: { from: "/destinations" } });
  };

  const handleSearchGo = () => {
    if (!user) {
      navigate("/register", { state: { from: "/" } });
      return;
    }
    navigate("/destinations");
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  const todayString = currentDate.toISOString().slice(0, 10);

  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      if (a.startDate === b.startDate) return (a.destination || "").localeCompare(b.destination || "");
      return (a.startDate || "").localeCompare(b.startDate || "");
    });
  }, [trips]);

  const { upcoming: upcomingTrips, ongoing: ongoingTrips } = useMemo(() => {
    return categorizeTrips(sortedTrips, todayString);
  }, [sortedTrips, todayString]);

  const tripSuggestions = useMemo(() => {
    const targets = [...ongoingTrips, ...upcomingTrips].slice(0, 4);

    return targets.map(
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
  }, [ongoingTrips, upcomingTrips]);

  const tripStatusSummary = useMemo(() => {
    return `Trip status: ${upcomingTrips.length} upcoming, ${ongoingTrips.length} ongoing.`;
  }, [ongoingTrips.length, upcomingTrips.length]);

  const tripBotMessages = useMemo(() => {
    return [
      tripStatusSummary,
      ...tripSuggestions,
    ];
  }, [tripSuggestions, tripStatusSummary]);

  useEffect(() => {
    if (!user) {
      setChatMessages((prev) => prev.filter((m) => !m.auto));
      return;
    }
    if (tripBotMessages.length === 0) {
      if (!chatOpen) setChatBadgeCount(0);
      return;
    }

    setChatMessages((prev) => {
      const previousAutoTexts = prev.filter((m) => m.auto).map((m) => m.text).join("||");
      const nextAutoTexts = tripBotMessages.join("||");
      if (previousAutoTexts === nextAutoTexts) return prev;

      const manualMessages = prev.filter((m) => !m.auto);
      const nextAutoMessages = tripBotMessages.map((text) => ({ role: "bot", text, auto: true }));
      if (!chatOpen) setChatBadgeCount(nextAutoMessages.length);
      return [...manualMessages, ...nextAutoMessages];
    });
  }, [tripBotMessages, chatOpen, user]);

  useEffect(() => {
    if (chatOpen) setChatBadgeCount(0);
  }, [chatOpen]);

  const travelKeywords = [
    "travel",
    "trip",
    "destination",
    "city",
    "country",
    "itinerary",
    "budget",
    "cost",
    "flight",
    "hotel",
    "food",
    "transport",
    "weather",
    "visa",
    "booking",
    "planner",
    "plan",
    "tour",
    "vacation",
    "holiday",
  ];

  const budgetPresets = {
    paris: { flight: "$500-$800", hotel: "$120-$220/night", food: "$40-$60/day", transport: "$10-$20/day" },
    tokyo: { flight: "$700-$1200", hotel: "$90-$180/night", food: "$35-$70/day", transport: "$12-$25/day" },
    sydney: { flight: "$650-$1100", hotel: "$110-$210/night", food: "$40-$70/day", transport: "$12-$22/day" },
    london: { flight: "$550-$900", hotel: "$130-$260/night", food: "$45-$75/day", transport: "$12-$25/day" },
  };

  const typicalWeather = {
    paris: "Paris is usually mild: cool winters, warm summers, and occasional rain.",
    tokyo: "Tokyo is humid in summer, mild in spring/autumn, and cool in winter.",
    sydney: "Sydney is generally mild to warm, with pleasant winters and sunny summers.",
    london: "London is mild and often cloudy, with light rain possible year-round.",
  };

  const isTravelQuestion = (q) => travelKeywords.some((keyword) => q.includes(keyword));

  const findKnownPlace = (q) => {
    return Object.keys(budgetPresets).find((place) => q.includes(place)) || null;
  };

  const estimateBudgetReply = (q) => {
    const place = findKnownPlace(q);
    const preset = place ? budgetPresets[place] : null;
    const daysMatch = q.match(/(\d+)\s*(day|days)/);
    const days = daysMatch ? Number(daysMatch[1]) : 3;
    const placeLabel = place ? `${place.charAt(0).toUpperCase()}${place.slice(1)}` : "your destination";
    const base = preset || {
      flight: "$450-$900",
      hotel: "$80-$180/night",
      food: "$30-$60/day",
      transport: "$10-$25/day",
    };

    return `Estimated budget for ${placeLabel} (${days} days):
Flight: ${base.flight}
Hotel: ${base.hotel}
Food: ${base.food}
Local transport: ${base.transport}`;
  };

  const getBotReply = (text) => {
    const q = text.toLowerCase();
    if ((q.includes("plan") && q.includes("destination")) || q.includes("plan destination")) {
      return "Opening Destinations page so you can plan your destination.";
    }
    if (!isTravelQuestion(q)) {
      return "I can only help with travel planning, but I am happy to help with your trip.";
    }
    if (q.includes("budget") || q.includes("cost") || q.includes("price")) {
      return estimateBudgetReply(q);
    }
    if (q.includes("destination") || q.includes("city") || q.includes("country")) {
      return "Check the Destinations page. I can also estimate budget and itinerary tips for you.";
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
      const place = findKnownPlace(q);
      if (place && typicalWeather[place]) {
        return `${typicalWeather[place]} You can also check the Weather section for live weather.`;
      }
      return "Please check the Weather section for live weather. I can also share typical weather for popular cities.";
    }
    if (q.includes("hotel") || q.includes("booking")) {
      return "Hotel booking page is coming soon.";
    }
    if (
      q.includes("alert") ||
      q.includes("reminder") ||
      q.includes("notification") ||
      q.includes("trip status") ||
      q.includes("ongoing") ||
      q.includes("completed")
    ) {
      if (!user) return "Please login first so I can show your trip status and AI recommendations.";
      return `${tripStatusSummary} ${tripSuggestions.join(" ")}`.trim();
    }
    if (
      q.includes("upcoming") ||
      q.includes("recommend") ||
      q.includes("ai") ||
      q.includes("next trip")
    ) {
      if (!user) return "Please login first so I can recommend upcoming trip actions.";
      if (tripSuggestions.length === 0) {
        return "You have no active trips yet. Add one in Planner or Dashboard and I will recommend next actions.";
      }
      return `Here are AI recommendations for your upcoming trips: ${tripSuggestions.join(" ")}`;
    }
    return "I can help with destinations, budget, weather, and trip planning.";
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    const q = text.toLowerCase();
    const shouldNavigateToDestinations =
      (q.includes("plan") && q.includes("destination")) || q.includes("plan destination");

    const userMessage = { role: "user", text };
    const botMessage = { role: "bot", text: getBotReply(text) };

    setChatMessages((prev) => [...prev, userMessage, botMessage]);
    setChatInput("");
    if (shouldNavigateToDestinations) goToDestinations();
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
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
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
                onClick={() => navigate("/weather")}
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
