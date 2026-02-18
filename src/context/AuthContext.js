/**
 * AuthContext - Login state and auth actions. Data in localStorage (no backend).
 */
import React, { createContext, useContext, useState, useEffect } from "react";

const AUTH_USER = "trip_user";
const AUTH_USERS = "trip_users";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_USER);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (_) {}
    }
  }, []);

  const register = (name, email, password) => {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: "Email already registered." };
    }
    users.push({ name, email, password });
    localStorage.setItem(AUTH_USERS, JSON.stringify(users));
    const u = { name, email };
    setUser(u);
    localStorage.setItem(AUTH_USER, JSON.stringify(u));
    return { ok: true };
  };

  const login = (email, password) => {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) return { ok: false, error: "Invalid email or password." };
    const u = { name: found.name, email: found.email };
    setUser(u);
    localStorage.setItem(AUTH_USER, JSON.stringify(u));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_USER);
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
