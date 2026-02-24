import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import "./About.css";

function Admin() {
  const { user, logout, getAllUsers } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  // Block non-admins
  if (!user || user.role !== "admin") {
    return (
      <div style={{ padding: 40 }}>
        <h2>Access denied</h2>
        <p>This area is for administrators only.</p>
        <Link to="/">Return home</Link>
      </div>
    );
  }

  const users = getAllUsers();

  return (
    <div className="about-page">
      <header className="about-nav">
        <div className="about-nav-inner">
          <Logo className="about-logo" />
          <nav className="about-nav-links">
            <Link to="/">Home</Link>
            <Link to="/planner">Planner</Link>
            <Link to="/about">About</Link>
            <Link to="/admin">Admin</Link>
            <button type="button" className="about-login about-logout" onClick={() => logout()}>Logout</button>
          </nav>
        </div>
      </header>

      <section className="about-main" style={{ padding: 24 }}>
        <h1>Admin Dashboard</h1>
        <p>Welcome, {user.displayName || user.name}. Use the panel to view registered users.</p>

        <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
          <div style={{ flex: 1 }}>
            <h3>Registered Users</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {users.map((u, i) => (
                <li key={i} style={{ padding: 8, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>{u.name || "(no name)"}</strong>
                    <div style={{ fontSize: 12, color: "#666" }}>{u.email}</div>
                  </div>
                  <div>
                    <button onClick={() => setSelected(u)} style={{ marginRight: 8 }}>View</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ width: 360 }}>
            <h3>User Details</h3>
            {selected ? (
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 6 }}>
                <p><strong>Name:</strong> {selected.name}</p>
                <p><strong>Email:</strong> {selected.email}</p>
                <p><strong>Role:</strong> {selected.role || 'user'}</p>
              </div>
            ) : (
              <p>Select a user to view details.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Admin;
