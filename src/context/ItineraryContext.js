import React, { createContext, useContext, useMemo, useState } from "react";

const ItineraryContext = createContext(null);

export function ItineraryProvider({ children }) {
  const [itineraryDestination, setItineraryDestination] = useState("");

  const value = useMemo(
    () => ({
      itineraryDestination,
      setItineraryDestination,
    }),
    [itineraryDestination]
  );

  return <ItineraryContext.Provider value={value}>{children}</ItineraryContext.Provider>;
}

export function useItinerary() {
  const context = useContext(ItineraryContext);
  if (!context) {
    throw new Error("useItinerary must be used inside ItineraryProvider");
  }
  return context;
}
