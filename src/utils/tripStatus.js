function toDateOnly(dateValue) {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 10);
}

export function getTripStatus(trip, todayString) {
  const startDate = toDateOnly(trip?.startDate);
  const endDate = toDateOnly(trip?.endDate);

  if (!startDate) return "upcoming";
  if (startDate > todayString) return "upcoming";

  if (!endDate) return "ongoing";
  if (endDate < todayString) return "completed";
  return "ongoing";
}

export function categorizeTrips(trips, todayString) {
  const upcoming = [];
  const ongoing = [];
  const completed = [];

  trips.forEach((trip) => {
    const status = getTripStatus(trip, todayString);
    if (status === "upcoming") upcoming.push(trip);
    else if (status === "ongoing") ongoing.push(trip);
    else completed.push(trip);
  });

  return { upcoming, ongoing, completed };
}
