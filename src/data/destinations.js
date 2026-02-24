/** Destination list and getter for detail page */
export const destinations = [
  { id: "paris", name: "Paris", image: "https://picsum.photos/1200/400?random=1", description: "The City of Light. Famous for art, culture, and cuisine.", weather: "Sunny, 22°C", attractions: ["Eiffel Tower", "Louvre Museum", "Notre-Dame Cathedral"] },
  { id: "tokyo", name: "Tokyo", image: "https://picsum.photos/1200/400?random=2", description: "A blend of tradition and cutting-edge technology.", weather: "Partly cloudy, 18°C", attractions: ["Senso-ji Temple", "Shibuya Crossing", "Tokyo Skytree"] },
  { id: "bali", name: "Bali", image: "https://picsum.photos/1200/400?random=3", description: "Island of temples, beaches, and lush rice terraces.", weather: "Warm & humid, 28°C", attractions: ["Ubud Monkey Forest", "Tanah Lot", "Tegallalang Rice Terraces"] },
  { id: "newyork", name: "New York", image: "https://picsum.photos/1200/400?random=4", description: "The city that never sleeps. Culture, food, and skyline.", weather: "Clear, 15°C", attractions: ["Statue of Liberty", "Central Park", "Times Square"] },
];

export function getDestination(id) {
  return destinations.find((d) => d.id === id) || null;
}
