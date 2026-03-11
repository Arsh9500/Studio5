import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { loadUserTrips, saveUserTrips } from "./utils/trips";
import "./Planner.css";

function Planner() {
  const { user } = useAuth();
  const location = useLocation();
  const suggestedDestination = location.state?.add || "";

  const [trips, setTrips] = useState([]);
  const [editingTripId, setEditingTripId] = useState("");
  const [form, setForm] = useState({
    destination: suggestedDestination,
    startDate: "",
    endDate: "",
    budget: "",
    estimatedCost: "",
    notes: "",
  });

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

  useEffect(() => {
    if (suggestedDestination) {
      setForm((prev) => ({ ...prev, destination: suggestedDestination }));
    }
  }, [suggestedDestination]);

  const todayString = new Date().toISOString().slice(0, 10);

  const upcomingTrips = useMemo(() => {
    return [...trips]
      .filter((trip) => trip.startDate >= todayString)
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1));
  }, [todayString, trips]);

  const notifications = useMemo(() => {
    const today = new Date(todayString);
    const list = [];

    upcomingTrips.forEach((trip) => {
      const budget = Number(trip.budget) || 0;
      const estimated = Number(trip.estimatedCost) || 0;
      if (budget > 0 && estimated > budget) {
        list.push({
          id: `budget-${trip.id}`,
          type: "Budget Alert",
          message: `${trip.destination}: estimated cost ($${estimated}) is over budget ($${budget}).`,
        });
      }

      if (trip.startDate) {
        const start = new Date(trip.startDate);
        const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          list.push({
            id: `reminder-${trip.id}`,
            type: "Trip Reminder",
            message: `${trip.destination} starts in ${diffDays} day${diffDays === 1 ? "" : "s"}.`,
          });
        }
      }
    });

    return list;
  }, [todayString, upcomingTrips]);

  const resetForm = () => {
    setForm({
      destination: "",
      startDate: "",
      endDate: "",
      budget: "",
      estimatedCost: "",
      notes: "",
    });
    setEditingTripId("");
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveTripsToDb = (nextTrips) => {
    setTrips(nextTrips);
    saveUserTrips(user?.uid, nextTrips);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.destination.trim() || !form.startDate) return;

    const normalized = {
      destination: form.destination.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      budget: form.budget,
      estimatedCost: form.estimatedCost,
      notes: form.notes.trim(),
    };

    if (editingTripId) {
      const nextTrips = trips.map((trip) =>
        trip.id === editingTripId ? { ...trip, ...normalized } : trip
      );
      saveTripsToDb(nextTrips);
      resetForm();
      return;
    }

    const newTrip = {
      id: `${Date.now()}`,
      ...normalized,
      createdAt: new Date().toISOString(),
    };
    saveTripsToDb([...trips, newTrip]);
    resetForm();
  };

  const onEdit = (trip) => {
    setEditingTripId(trip.id);
    setForm({
      destination: trip.destination || "",
      startDate: trip.startDate || "",
      endDate: trip.endDate || "",
      budget: trip.budget || "",
      estimatedCost: trip.estimatedCost || "",
      notes: trip.notes || "",
    });
  };

  const onDelete = (tripId) => {
    const nextTrips = trips.filter((trip) => trip.id !== tripId);
    saveTripsToDb(nextTrips);
    if (editingTripId === tripId) resetForm();
  };

  return (
    <div className="planner-page">
      <div className="planner-header">
        <h1>Trip Planner</h1>
        <p>Manage your upcoming trips, edit plans, and track alerts.</p>
      </div>

      <section className="planner-form-card">
        <h2>{editingTripId ? "Edit Trip" : "Add New Trip"}</h2>
        <form onSubmit={onSubmit} className="planner-form">
          <input
            name="destination"
            value={form.destination}
            onChange={onChange}
            placeholder="Destination"
            required
          />
          <input name="startDate" type="date" value={form.startDate} onChange={onChange} required />
          <input name="endDate" type="date" value={form.endDate} onChange={onChange} />
          <input
            name="budget"
            type="number"
            min="0"
            value={form.budget}
            onChange={onChange}
            placeholder="Budget (USD)"
          />
          <input
            name="estimatedCost"
            type="number"
            min="0"
            value={form.estimatedCost}
            onChange={onChange}
            placeholder="Estimated Cost (USD)"
          />
          <textarea
            name="notes"
            value={form.notes}
            onChange={onChange}
            placeholder="Notes (optional)"
            rows={3}
          />
          <div className="planner-form-actions">
            <button type="submit">{editingTripId ? "Update Trip" : "Save Trip"}</button>
            {editingTripId && (
              <button type="button" className="planner-cancel-btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="planner-list-card">
        <h2>Upcoming Trips ({upcomingTrips.length})</h2>
        {upcomingTrips.length === 0 ? (
          <p className="planner-empty">No upcoming trips yet.</p>
        ) : (
          <div className="planner-trip-list">
            {upcomingTrips.map((trip) => (
              <article key={trip.id} className="planner-trip-item">
                <h3>{trip.destination}</h3>
                <p>
                  {trip.startDate}
                  {trip.endDate ? ` to ${trip.endDate}` : ""}
                </p>
                <p>Budget: ${trip.budget || 0}</p>
                <p>Estimated: ${trip.estimatedCost || 0}</p>
                {trip.notes && <p>Notes: {trip.notes}</p>}
                <div className="planner-trip-actions">
                  <button type="button" onClick={() => onEdit(trip)}>
                    Edit
                  </button>
                  <button type="button" className="planner-delete-btn" onClick={() => onDelete(trip.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="planner-notifications-card">
        <h2>Notifications ({notifications.length})</h2>
        {notifications.length === 0 ? (
          <p className="planner-empty">No alerts right now.</p>
        ) : (
          <ul className="planner-notification-list">
            {notifications.map((item) => (
              <li key={item.id}>
                <strong>{item.type}:</strong> {item.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/" className="planner-back-link">
        Back to Home
      </Link>
      <Link to="/dashboard" className="planner-back-link">
        Open Dashboard
      </Link>
    </div>
  );
}

export default Planner;
