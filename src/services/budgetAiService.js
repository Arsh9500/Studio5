const TRAVEL_API_BASE_URL = process.env.REACT_APP_TRAVEL_API_BASE_URL || "http://127.0.0.1:5000";

export async function requestBudgetPlan({ destination, days, totalBudget, currency = "USD" }) {
  const response = await fetch(`${TRAVEL_API_BASE_URL}/chat/budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination, days, totalBudget, currency }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Budget AI service is unavailable right now.");
  }

  return data;
}
