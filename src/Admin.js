import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import "./Admin.css";

function Admin() {
  const { user, logout, getAllUsers, updateUserRole } = useAuth();
  const [selected, setSelected] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      const result = await getAllUsers();
      if (cancelled) return;
      if (!result.ok) {
        setUsers([]);
        setStatus(result.error || "Could not load users.");
        setLoading(false);
        return;
      }
      const allUsers = result.data || [];
      const sorted = [...allUsers].sort((a, b) => {
        const nameA = (a.name || a.email || "").toLowerCase();
        const nameB = (b.name || b.email || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setUsers(sorted);
      setStatus("");
      if (sorted.length && !selected) {
        setSelected(sorted[0]);
      }
      setLoading(false);
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [getAllUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.role].some((field) => String(field || "").toLowerCase().includes(q))
    );
  }, [search, users]);

  const adminsCount = users.filter((u) => (u.role || "user") === "admin").length;

  const setRoleForSelected = async (nextRole) => {
    if (!selected?.uid && !selected?.id) return;
    const targetUid = selected.uid || selected.id;

    if ((selected.role || "user") === nextRole) return;

    const result = await updateUserRole(targetUid, nextRole);
    if (!result.ok) {
      setStatus(result.error || "Failed to update role.");
      return;
    }

    setUsers((prev) =>
      prev.map((entry) => {
        const entryUid = entry.uid || entry.id;
        return entryUid === targetUid ? { ...entry, role: nextRole } : entry;
      })
    );
    setSelected((prev) => (prev ? { ...prev, role: nextRole } : prev));
    setStatus(`Updated role to ${nextRole}.`);
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="admin-guard">
        <h2>Access denied</h2>
        <p>This area is for administrators only.</p>
        <Link to="/">Return home</Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-nav">
        <div className="admin-nav-inner">
          <Logo className="admin-logo" />
          <nav className="admin-nav-links">
            <Link to="/">Home</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/admin">Admin</Link>
            <button type="button" className="admin-logout" onClick={() => logout()}>
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-hero">
          <h1>Admin User Management</h1>
          <p>Welcome, {user.displayName || user.name || user.email}. Manage registered users and permissions.</p>
          {status && <p className="admin-status">{status}</p>}
        </section>

        <section className="admin-metrics">
          <article>
            <h3>{users.length}</h3>
            <p>Total Users</p>
          </article>
          <article>
            <h3>{adminsCount}</h3>
            <p>Admins</p>
          </article>
          <article>
            <h3>{Math.max(users.length - adminsCount, 0)}</h3>
            <p>Regular Users</p>
          </article>
        </section>

        <section className="admin-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>Registered Users</h2>
              <input
                type="text"
                placeholder="Search by name, email, role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="admin-empty">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="admin-empty">No users found.</p>
            ) : (
              <ul className="admin-user-list">
                {filteredUsers.map((u) => {
                  const key = u.uid || u.id || u.email;
                  const isSelected = (selected?.uid || selected?.id) === (u.uid || u.id);
                  return (
                    <li key={key} className={isSelected ? "selected" : ""}>
                      <button type="button" onClick={() => setSelected(u)}>
                        <div>
                          <strong>{u.name || "(no name)"}</strong>
                          <span>{u.email || "no-email"}</span>
                        </div>
                        <span className={`role role-${(u.role || "user").toLowerCase()}`}>
                          {u.role || "user"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="admin-card admin-details">
            <h2>User Details</h2>
            {selected ? (
              <div className="admin-details-box">
                <p><strong>Name:</strong> {selected.name || "-"}</p>
                <p><strong>Email:</strong> {selected.email || "-"}</p>
                <p>
                  <strong>Role:</strong>{" "}
                  <span className={`role role-${(selected.role || "user").toLowerCase()}`}>
                    {selected.role || "user"}
                  </span>
                </p>
                <p><strong>UID:</strong> {selected.uid || selected.id || "-"}</p>

                <div className="admin-actions">
                  <button type="button" onClick={() => setRoleForSelected("user")}>
                    Set as User
                  </button>
                  <button type="button" className="promote" onClick={() => setRoleForSelected("admin")}>
                    Set as Admin
                  </button>
                </div>

              </div>
            ) : (
              <p className="admin-empty">Select a user to view details.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Admin;
