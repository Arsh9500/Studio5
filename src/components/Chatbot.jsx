import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { destinations } from "../data/destinations";
import { loadUserHotelBookings } from "../utils/bookings";
import { loadUserChatHistory, saveUserChatMessage } from "../utils/chatHistory";
import { loadUserTrips } from "../utils/trips";
import { categorizeTrips } from "../utils/tripStatus";
import { sendChatMessage } from "../services/chatService";
import { buildPlaceMapLink } from "../services/placesService";
import "./Chatbot.css";

const BOOKING_CHATBOT_NOTICE_KEY = "hotel_booking_chatbot_notice";
const QUICK_SUGGESTIONS = [
  "Find hotels in Queenstown",
  "Show tourist places in Auckland",
  "Nearby attractions",
  "Best way to go from Auckland to Rotorua",
  "Packing list for my trip",
  "Show my trip timeline",
  "Budget travel ideas",
];
const LOCAL_TRAVEL_GUIDES = {
  auckland: {
    city: "Auckland",
    country: "New Zealand",
    attractions: [
      { name: "Sky Tower", address: "Victoria Street West, Auckland", rating: 4.6 },
      { name: "Auckland War Memorial Museum", address: "Parnell, Auckland", rating: 4.7 },
      { name: "Waiheke Island Ferry Gateway", address: "Downtown Auckland", rating: 4.8 },
    ],
  },
  queenstown: {
    city: "Queenstown",
    country: "New Zealand",
    attractions: [
      { name: "Queenstown Gardens", address: "Park Street, Queenstown", rating: 4.8 },
      { name: "Skyline Queenstown", address: "Brecon Street, Queenstown", rating: 4.7 },
      { name: "Lake Wakatipu Waterfront", address: "Central Queenstown", rating: 4.9 },
    ],
  },
  wellington: {
    city: "Wellington",
    country: "New Zealand",
    attractions: [
      { name: "Te Papa", address: "Cable Street, Wellington", rating: 4.8 },
      { name: "Wellington Cable Car", address: "Lambton Quay, Wellington", rating: 4.6 },
      { name: "Mount Victoria Lookout", address: "Mount Victoria, Wellington", rating: 4.7 },
    ],
  },
  christchurch: {
    city: "Christchurch",
    country: "New Zealand",
    attractions: [
      { name: "Botanic Gardens", address: "Rolleston Avenue, Christchurch", rating: 4.8 },
      { name: "Riverside Market", address: "Oxford Terrace, Christchurch", rating: 4.6 },
      { name: "Canterbury Museum", address: "Rolleston Avenue, Christchurch", rating: 4.5 },
    ],
  },
  rotorua: {
    city: "Rotorua",
    country: "New Zealand",
    attractions: [
      { name: "Te Puia", address: "Hemo Road, Rotorua", rating: 4.7 },
      { name: "Redwoods Forest", address: "Long Mile Road, Rotorua", rating: 4.8 },
      { name: "Polynesian Spa", address: "Hinemoa Street, Rotorua", rating: 4.6 },
    ],
  },
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function buildBookingChatMessage(booking) {
  if (!booking) return "You do not have a confirmed hotel booking yet.";

  return `Payment successful. Your hotel booking is confirmed.
Hotel: ${booking.hotelName}
Destination: ${booking.destination}
Check-in: ${booking.checkInDate}
Check-out: ${booking.checkOutDate}
Guests: ${booking.guests}
Total price: ${formatCurrency(booking.totalPrice)}
Payment method: ${booking.paymentMethod}
Booking reference: ${booking.bookingReference}`;
}

function normalizeStoredMessage(message) {
  return {
    id: `${message.sender}-${message.timestamp}-${message.text}`,
    role: message.sender === "user" ? "user" : "bot",
    text: message.text,
    places: Array.isArray(message.placeResults) ? message.placeResults : [],
    timeline: Array.isArray(message.timeline) ? message.timeline : [],
    relatedSearchType: message.relatedSearchType || "general",
    timestamp: message.timestamp,
  };
}

function extractKnownLocation(text) {
  const normalized = text.toLowerCase();
  const localMatch = Object.keys(LOCAL_TRAVEL_GUIDES).find((key) => normalized.includes(key));
  if (localMatch) return localMatch;

  const destinationMatch = destinations.find(
    (item) =>
      normalized.includes(item.name.toLowerCase()) ||
      normalized.includes(item.city.toLowerCase()) ||
      normalized.includes(item.country.toLowerCase())
  );

  return destinationMatch?.city?.toLowerCase() || null;
}

function extractRoutePlaces(text) {
  const normalized = text.trim();
  const patterns = [
    /(?:from|go from)\s+(.+?)\s+(?:to|2)\s+(.+?)(?:\?|$)/i,
    /(?:between)\s+(.+?)\s+(?:and|&)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        origin: match[1].replace(/\b(best way|travel|transport|route)\b/gi, "").trim(),
        destination: match[2].replace(/\b(by bus|by train|by car|transport|route)\b/gi, "").trim(),
      };
    }
  }

  return { origin: "", destination: "" };
}

function inferPreference(text, options) {
  return options.find((option) => text.includes(option.toLowerCase())) || "";
}

function buildPreferenceSummary(message) {
  const text = message.toLowerCase();
  const locationKey = extractKnownLocation(message);
  const destinationMatch = destinations.find(
    (item) =>
      text.includes(item.city.toLowerCase()) ||
      text.includes(item.name.toLowerCase()) ||
      text.includes(item.country.toLowerCase())
  );

  return {
    budget: inferPreference(text, ["Low", "Medium", "High", "Budget", "Affordable", "Luxury"]),
    type: inferPreference(text, ["Adventure", "Beach", "Culture", "City", "Nature", "Food", "Family"]),
    locationKey,
    destination: destinationMatch || null,
  };
}

function scoreDestination(destination, preferences) {
  let score = 0;
  const budget = preferences.budget.toLowerCase();
  const type = preferences.type.toLowerCase();

  if (preferences.destination?.id === destination.id) score += 5;
  if (preferences.locationKey && destination.city.toLowerCase().includes(preferences.locationKey)) score += 4;
  if (budget && destination.budgetLevel.toLowerCase().includes(budget)) score += 3;
  if ((budget === "budget" || budget === "affordable") && destination.budgetLevel !== "High") score += 2;
  if (type && destination.travelType.toLowerCase().includes(type)) score += 3;
  if (type && destination.description.toLowerCase().includes(type)) score += 1;

  return score;
}

function buildPersonalizedAttractionReply(message) {
  const preferences = buildPreferenceSummary(message);
  const ranked = [...destinations]
    .map((destination) => ({ destination, score: scoreDestination(destination, preferences) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const usefulRanked = ranked.some((item) => item.score > 0)
    ? ranked
    : destinations.slice(0, 3).map((destination) => ({ destination, score: 0 }));

  const preferenceText = [
    preferences.budget ? `budget: ${preferences.budget}` : "",
    preferences.type ? `type: ${preferences.type}` : "",
    preferences.destination ? `location: ${preferences.destination.name}` : "",
  ].filter(Boolean);

  const lines = usefulRanked.map(({ destination }, index) => {
    const cost = destination.estimatedCosts;
    return `${index + 1}. ${destination.name}: ${destination.attractions.join(", ")}. Best for ${destination.travelType.toLowerCase()} travel; typical local transport is about ${formatCurrency(cost.localTransportPerDay)} per day.`;
  });

  return {
    reply: `Here are AI-style attraction suggestions${preferenceText.length ? ` for ${preferenceText.join(", ")}` : ""}:\n${lines.join("\n")}\n\nFor tighter results, ask with budget, type, and location, for example: "medium budget culture attractions in Paris".`,
    places: usefulRanked.flatMap(({ destination }) =>
      destination.attractions.slice(0, 2).map((name) => ({
        name,
        address: `${destination.city}, ${destination.country}`,
        rating: null,
      }))
    ),
    searchType: "personalized_attractions",
  };
}

function buildTransportReply(message) {
  const { origin, destination } = extractRoutePlaces(message);
  const routeLabel = origin && destination ? `${origin} to ${destination}` : "your route";

  return {
    reply: `For ${routeLabel}, compare these transport options:\n1. Public transport: usually best for lower budgets and city-to-city travel. Check bus or train departures first because schedules can change.\n2. Car or rideshare: best when you have luggage, late arrivals, or stops between places.\n3. Shuttle or transfer: best for airport trips, groups, and predictable door-to-door timing.\n\nMy quick pick: choose public transport for cost, a car for flexibility, and a shuttle for the easiest experience. You can open the Transport page for a full AI route plan with time, comfort, and budget details.`,
    places: [],
    searchType: "transport",
  };
}

function buildPackingReply(message) {
  const text = message.toLowerCase();
  const isBeach = text.includes("beach") || text.includes("tropical") || text.includes("bali") || text.includes("goa");
  const isCold = text.includes("cold") || text.includes("winter") || text.includes("london") || text.includes("new york");
  const isAdventure = text.includes("adventure") || text.includes("hike") || text.includes("mountain");

  const essentials = ["Passport or ID", "Booking confirmations", "Phone charger and adapter", "Daily medication", "Reusable water bottle"];
  const clothing = isCold
    ? ["Warm jacket", "Layered tops", "Comfortable waterproof shoes"]
    : ["Comfortable walking shoes", "Light layers", "Sleepwear"];
  const extras = [
    isBeach ? "Swimwear and sunscreen" : "Compact rain jacket",
    isAdventure ? "Day pack and first-aid basics" : "Small day bag",
    "Toiletries in travel-size containers",
  ];

  return {
    reply: `AI packing suggestions:\nEssentials: ${essentials.join(", ")}.\nClothing: ${clothing.join(", ")}.\nTrip extras: ${extras.join(", ")}.\n\nTip: keep documents, medication, one outfit, and chargers in your carry-on so delays do not break the first day of your trip.`,
    places: [],
    searchType: "packing",
  };
}

function buildTimelineItems(trips, bookings) {
  const tripItems = trips.map((trip) => ({
    date: trip.startDate || "Date not set",
    title: trip.destination || "Saved trip",
    detail: trip.endDate ? `${trip.startDate} to ${trip.endDate}` : "Trip date saved",
  }));

  const bookingItems = bookings.map((booking) => ({
    date: booking.checkInDate || booking.createdAt || "Date not set",
    title: booking.hotelName || "Hotel booking",
    detail: `${booking.destination || "Destination"}${booking.checkOutDate ? `, checkout ${booking.checkOutDate}` : ""}`,
  }));

  return [...tripItems, ...bookingItems]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, 8);
}

function buildTimelineReply(trips, bookings) {
  const timeline = buildTimelineItems(trips, bookings);

  if (!timeline.length) {
    return {
      reply: "Your trip timeline is empty right now. Add trips in the Planner or book a hotel, then I can show your schedule here.",
      places: [],
      searchType: "timeline",
      timeline: [],
    };
  }

  return {
    reply: "Here is your trip timeline view based on saved trips and hotel bookings.",
    places: [],
    searchType: "timeline",
    timeline,
  };
}

function buildMapSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildLocalPlaceCards(items, fallbackLocation) {
  return items.map((item) => ({
    placeId: `${fallbackLocation}-${item.name}`.toLowerCase().replace(/\s+/g, "-"),
    name: item.name,
    address: item.address,
    rating: item.rating,
    coordinates: {},
    photoUrl: "",
    mapsUrl: buildMapSearchUrl(`${item.name}, ${item.address}`),
  }));
}

function buildLocalHotelCards(locationKey) {
  const guide = LOCAL_TRAVEL_GUIDES[locationKey];
  const city = guide?.city || "the city";
  const country = guide?.country || "";
  const label = country ? `${city}, ${country}` : city;

  return [
    { name: `${city} Central Hotel`, address: `Central ${city}`, rating: 4.4 },
    { name: `${city} Lakeview Suites`, address: `${city} waterfront district`, rating: 4.6 },
    { name: `${city} Budget Stay`, address: `${city} city centre`, rating: 4.1 },
  ].map((item) => ({
    placeId: `${locationKey}-${item.name}`.toLowerCase().replace(/\s+/g, "-"),
    name: item.name,
    address: `${item.address}, ${label}`,
    rating: item.rating,
    coordinates: {},
    photoUrl: "",
    mapsUrl: buildMapSearchUrl(`${item.name}, ${label}`),
  }));
}

function Chatbot({ user }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [trips, setTrips] = useState([]);
  const [hotelBookings, setHotelBookings] = useState([]);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadChatContext = async () => {
      if (!user?.uid) {
        if (!ignore) {
          setTrips([]);
          setHotelBookings([]);
          setChatMessages([]);
        }
        return;
      }

      const [savedTrips, savedBookings, savedHistory] = await Promise.all([
        loadUserTrips(user.uid),
        loadUserHotelBookings(user.uid),
        loadUserChatHistory(user.uid),
      ]);

      if (ignore) return;
      setTrips(savedTrips);
      setHotelBookings(
        [...savedBookings].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      );
      setChatMessages(savedHistory.map(normalizeStoredMessage));
    };

    loadChatContext();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  const todayString = currentDate.toISOString().slice(0, 10);
  const latestHotelBooking = hotelBookings[0] || null;

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

    return targets.map((trip) => {
      const budget = Number(trip.budget) || 0;
      const estimated = Number(trip.estimatedCost) || 0;
      const budgetTip =
        budget > 0 && estimated > budget
          ? "Reduce optional activities to stay inside budget."
          : "Pre-book transport and top attractions to save time.";

      return `AI Recommendation: For ${trip.destination} (${trip.startDate}${
        trip.endDate ? ` to ${trip.endDate}` : ""
      }), ${budgetTip}`;
    });
  }, [ongoingTrips, upcomingTrips]);

  const tripBotMessages = useMemo(() => {
    if (!user) return [];

    const summary = `Trip status: ${upcomingTrips.length} upcoming, ${ongoingTrips.length} ongoing.`;
    return [summary, ...tripSuggestions];
  }, [ongoingTrips.length, tripSuggestions, upcomingTrips.length, user]);

  useEffect(() => {
    if (!tripBotMessages.length) return;

    setChatMessages((prev) => {
      const existingTexts = new Set(prev.filter((message) => message.auto).map((message) => message.text));
      const nextAutoMessages = tripBotMessages
        .filter((text) => !existingTexts.has(text))
        .map((text) => ({
          id: `auto-${text}`,
          role: "bot",
          text,
          auto: true,
          relatedSearchType: "trip_status",
        }));

      if (!nextAutoMessages.length) return prev;
      if (!chatOpen) setChatBadgeCount((count) => count + nextAutoMessages.length);
      return [...prev, ...nextAutoMessages];
    });
  }, [chatOpen, tripBotMessages]);

  useEffect(() => {
    if (chatOpen) setChatBadgeCount(0);
  }, [chatOpen]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const rawNotice = window.localStorage.getItem(BOOKING_CHATBOT_NOTICE_KEY);
    if (!rawNotice) return;

    try {
      const notice = JSON.parse(rawNotice);
      if (notice?.userId !== user.uid) return;

      const message = {
        id: `booking-${notice.bookingReference}`,
        role: "bot",
        text: buildBookingChatMessage(notice),
        relatedSearchType: "booking_confirmation",
        timestamp: notice.createdAt || new Date().toISOString(),
      };

      setChatMessages((prev) => {
        if (prev.some((entry) => entry.id === message.id)) return prev;
        return [...prev, message];
      });

      if (!chatOpen) setChatBadgeCount((count) => count + 1);
      window.localStorage.removeItem(BOOKING_CHATBOT_NOTICE_KEY);
    } catch (_) {
      window.localStorage.removeItem(BOOKING_CHATBOT_NOTICE_KEY);
    }
  }, [chatOpen, user]);

  const buildChatContext = () => ({
    latestBooking: latestHotelBooking,
    tripSummary: {
      upcomingTrips: upcomingTrips.length,
      ongoingTrips: ongoingTrips.length,
    },
  });

  const getLocalFallbackReply = (message) => {
    const text = message.toLowerCase();
    const locationKey = extractKnownLocation(text);
    const localGuide = locationKey ? LOCAL_TRAVEL_GUIDES[locationKey] : null;

    if (text.includes("timeline") || text.includes("schedule") || text.includes("trip plan view")) {
      return buildTimelineReply(sortedTrips, hotelBookings);
    }

    if (text.includes("packing") || text.includes("pack ") || text.includes("pack for")) {
      return buildPackingReply(message);
    }

    if (
      text.includes("transport") ||
      text.includes("best way") ||
      text.includes("route") ||
      text.includes("go from") ||
      text.includes("travel from")
    ) {
      return buildTransportReply(message);
    }

    if (
      (text.includes("suggest") || text.includes("recommend") || text.includes("personal")) &&
      (text.includes("attraction") || text.includes("places to visit") || text.includes("things to do"))
    ) {
      return buildPersonalizedAttractionReply(message);
    }

    if (text.includes("receipt") || text.includes("latest booking") || text.includes("booking confirmation")) {
      return {
        reply: buildBookingChatMessage(latestHotelBooking),
        places: [],
        searchType: "booking_confirmation",
      };
    }

    if (text.includes("wishlist")) {
      return {
        reply: user
          ? "You can still save destinations and hotels to your Firebase-backed wishlist from the main pages."
          : "Please login first so your wishlist and chat history can be saved.",
        places: [],
        searchType: "wishlist",
      };
    }

    if (text.includes("planner") || text.includes("itinerary")) {
      return {
        reply: "Use the Planner page to organize your itinerary, budget, and trip notes.",
        places: [],
        searchType: "planner",
      };
    }

    if (text.includes("dashboard") || text.includes("profile")) {
      return {
        reply: "Your Dashboard shows trips, confirmed hotel bookings, and saved wishlist items. Your Profile stores your traveler details.",
        places: [],
        searchType: "profile",
      };
    }

    if (text.includes("hotel") || text.includes("stay") || text.includes("accommodation")) {
      if (locationKey && localGuide) {
        return {
          reply: `I could not reach live hotel search right now, but here are some fallback hotel ideas for ${localGuide.city}. You can also open the Hotels page for the full hotel search view.`,
          places: buildLocalHotelCards(locationKey),
          searchType: "hotels",
        };
      }

      return {
        reply: "I could not reach live hotel search right now. Try the Hotels page for local search and filters, or ask for a city like Queenstown or Auckland.",
        places: [],
        searchType: "hotels",
      };
    }

    if (
      text.includes("tourist place") ||
      text.includes("attraction") ||
      text.includes("things to do") ||
      text.includes("places to visit")
    ) {
      if (locationKey && localGuide) {
        return {
          reply: `I could not reach live place search right now, but here are some popular spots in ${localGuide.city}.`,
          places: buildLocalPlaceCards(localGuide.attractions, locationKey),
          searchType: "attractions",
        };
      }

      return {
        reply: "I could not reach live place search right now. Try asking for Auckland, Queenstown, Wellington, Christchurch, or Rotorua.",
        places: [],
        searchType: "attractions",
      };
    }

    if (text.includes("near my hotel") || text.includes("nearby")) {
      if (latestHotelBooking?.destination) {
        const bookingLocation = extractKnownLocation(latestHotelBooking.destination);
        const bookingGuide = bookingLocation ? LOCAL_TRAVEL_GUIDES[bookingLocation] : null;

        if (bookingGuide) {
          return {
            reply: `I could not reach live nearby search right now, but here are some likely nearby attractions around your hotel area in ${bookingGuide.city}.`,
            places: buildLocalPlaceCards(bookingGuide.attractions, bookingLocation),
            searchType: "nearby",
          };
        }
      }

      return {
        reply: "I can suggest nearby places once you have a hotel booking saved, or you can ask for attractions in a city like Queenstown or Auckland.",
        places: [],
        searchType: "nearby",
      };
    }

    if (text.includes("budget") || text.includes("cheap") || text.includes("affordable")) {
      if (text.includes("new zealand")) {
        return {
          reply: "For budget-friendly New Zealand travel, Rotorua is great for geothermal attractions and moderate hotel prices, Christchurch is usually easier on the budget than Queenstown, and Wellington gives you a strong mix of culture and transport access.",
          places: [],
          searchType: "budget",
        };
      }

      const matchedDestination = destinations.find(
        (item) => text.includes(item.city.toLowerCase()) || text.includes(item.name.toLowerCase())
      );
      if (matchedDestination) {
        return {
          reply: `${matchedDestination.name} is usually a ${matchedDestination.budgetLevel.toLowerCase()} budget destination in our planner, with hotel estimates around ${formatCurrency(matchedDestination.estimatedCosts.hotelPerNight)} per night and food around ${formatCurrency(matchedDestination.estimatedCosts.foodPerDay)} per day.`,
          places: [],
          searchType: "budget",
        };
      }

      return {
        reply: "For budget travel ideas, try Rotorua, Christchurch, or Wellington in New Zealand, and use the Planner page to compare expected hotel and food costs.",
        places: [],
        searchType: "budget",
      };
    }

    if (text.includes("destination") || text.includes("visit")) {
      const matchedDestination = destinations.find(
        (item) => text.includes(item.city.toLowerCase()) || text.includes(item.name.toLowerCase())
      );
      if (matchedDestination) {
        return {
          reply: `${matchedDestination.name} is great for ${matchedDestination.travelType.toLowerCase()} travel. Popular highlights include ${matchedDestination.attractions.join(", ")}.`,
          places: buildLocalPlaceCards(
            matchedDestination.attractions.map((name) => ({
              name,
              address: `${matchedDestination.city}, ${matchedDestination.country}`,
              rating: null,
            })),
            matchedDestination.city.toLowerCase()
          ),
          searchType: "destination",
        };
      }

      return {
        reply: "You can explore destinations from the Destinations page, or ask me for budget ideas, attractions, or hotels in a specific city.",
        places: [],
        searchType: "destination",
      };
    }

    return {
      reply:
        "I could not reach the live AI service right now, but I can still help with hotels, attractions, destination ideas, booking receipts, and trip planning. Try asking for a city like Auckland or Queenstown.",
      places: [],
      searchType: "general",
    };
  };

  const appendMessage = async (message) => {
    setChatMessages((prev) => [...prev, message]);
    if (user?.uid && !message.auto) {
      await saveUserChatMessage(user.uid, {
        role: message.role,
        text: message.text,
        timestamp: message.timestamp,
        relatedSearchType: message.relatedSearchType,
        places: message.places,
        timeline: message.timeline,
      });
    }
  };

  const shouldAnswerLocally = (message) => {
    const text = message.toLowerCase();
    return (
      text.includes("timeline") ||
      text.includes("schedule") ||
      text.includes("packing") ||
      text.includes("pack for") ||
      text.includes("best way") ||
      text.includes("route") ||
      text.includes("go from") ||
      text.includes("travel from") ||
      text.includes("transport options") ||
      ((text.includes("suggest") || text.includes("recommend") || text.includes("personal")) &&
        (text.includes("attraction") || text.includes("places to visit") || text.includes("things to do")))
    );
  };

  const handleSendMessage = async (presetText) => {
    const text = (presetText || chatInput).trim();
    if (!text) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
      relatedSearchType: "user_message",
      places: [],
    };

    setChatInput("");
    await appendMessage(userMessage);
    setIsLoading(true);

    try {
      const result = shouldAnswerLocally(text)
        ? getLocalFallbackReply(text)
        : await sendChatMessage({
            message: text,
            context: buildChatContext(),
          });

      const botMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: result.reply,
        places: Array.isArray(result.places) ? result.places : [],
        timeline: Array.isArray(result.timeline) ? result.timeline : [],
        relatedSearchType: result.searchType || "general",
        timestamp: new Date().toISOString(),
      };

      await appendMessage(botMessage);
    } catch (_) {
      const fallback = getLocalFallbackReply(text);
      const botMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: fallback.reply,
        places: fallback.places,
        timeline: fallback.timeline || [],
        relatedSearchType: fallback.searchType,
        timestamp: new Date().toISOString(),
      };

      await appendMessage(botMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chatbot-toggle"
        aria-label={chatOpen ? "Close travel chatbot" : "Open travel chatbot"}
        onClick={() => setChatOpen((prev) => !prev)}
      >
        <span className="chatbot-toggle-icon" aria-hidden="true">
          {chatOpen ? "x" : "AI"}
        </span>
        <span>{chatOpen ? "Close Chat" : "Chat"}</span>
        {!chatOpen && chatBadgeCount > 0 && (
          <span className="chatbot-badge">{chatBadgeCount}</span>
        )}
      </button>

      {chatOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span className="chatbot-header-avatar" aria-hidden="true">AI</span>
            <div>
              <span>Travel Chatbot</span>
              <small>Hotels, places, budgets, and trips</small>
            </div>
          </div>

          <div className="chatbot-suggestions">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chatbot-suggestion-btn"
                onClick={() => handleSendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="chatbot-messages">
            {chatMessages.length === 0 && (
              <div className="chatbot-empty">
                <span className="chatbot-empty-icon" aria-hidden="true">AI</span>
                Ask about hotels, attractions, destinations, budgets, or nearby places.
              </div>
            )}

            {chatMessages.map((message) => (
              <div key={message.id} className="chatbot-message-wrap">
                <div className={`chatbot-message ${message.role === "user" ? "chat-user" : "chat-bot"}`}>
                  {message.role === "bot" && (
                    <span className="chatbot-message-icon" aria-hidden="true">AI</span>
                  )}
                  {message.text}
                </div>

                {message.role === "bot" && Array.isArray(message.places) && message.places.length > 0 && (
                  <div className="chatbot-place-list">
                    {message.places.map((place, index) => (
                      <article key={`${place.placeId || place.name}-${index}`} className="chatbot-place-card">
                        {place.photoUrl ? (
                          <div
                            className="chatbot-place-photo"
                            style={{ backgroundImage: `url(${place.photoUrl})` }}
                          />
                        ) : (
                          <div className="chatbot-place-photo chatbot-place-photo-fallback">
                            {place.name}
                          </div>
                        )}
                        <div className="chatbot-place-body">
                          <h4>{place.name}</h4>
                          <p>{place.address}</p>
                          <p>
                            {place.rating ? `Rating: ${place.rating}` : "Rating unavailable"}
                            {place.coordinates?.lat && place.coordinates?.lng
                              ? ` - ${place.coordinates.lat}, ${place.coordinates.lng}`
                              : ""}
                          </p>
                          <div className="chatbot-place-actions">
                            <a href={buildPlaceMapLink(place)} target="_blank" rel="noreferrer">
                              View on Map
                            </a>
                            <button type="button" onClick={() => navigate("/hotels")}>
                              Search Hotels
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {message.role === "bot" && Array.isArray(message.timeline) && message.timeline.length > 0 && (
                  <div className="chatbot-timeline" aria-label="Trip timeline">
                    {message.timeline.map((item, index) => (
                      <article key={`${item.date}-${item.title}-${index}`} className="chatbot-timeline-item">
                        <span className="chatbot-timeline-date">{item.date}</span>
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && <div className="chatbot-loading">Travel assistant is thinking...</div>}
          </div>

          <div className="chatbot-input-row">
            <input
              type="text"
              placeholder="Ask about hotels, attractions, destinations..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleSendMessage();
              }}
            />
            <button type="button" onClick={() => handleSendMessage()} disabled={isLoading}>
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Chatbot;
