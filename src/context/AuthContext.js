import React, { createContext, useContext, useState, useEffect } from "react";

const AUTH_USER = "trip_user";
const AUTH_USERS = "trip_users";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    const newUser = { name, displayName: name, email };
    setUser(newUser);
    localStorage.setItem(AUTH_USER, JSON.stringify(newUser));
    return { ok: true };
  };

  const login = (email, password) => {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) return { ok: false, error: "Invalid email or password." };
    const u = { name: found.name, displayName: found.name, email: found.email };
    setUser(u);
    localStorage.setItem(AUTH_USER, JSON.stringify(u));
    return { ok: true };
  };

  const updateUserName = (name) => {
    if (!user) return { ok: false, error: "Not logged in." };
    const cleanName = (name || "").trim();
    if (!cleanName) return { ok: false, error: "Name is required." };

    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    const updatedUsers = users.map((u) =>
      u.email === user.email ? { ...u, name: cleanName } : u
    );
    localStorage.setItem(AUTH_USERS, JSON.stringify(updatedUsers));

    const updatedUser = { ...user, name: cleanName, displayName: cleanName };
    setUser(updatedUser);
    localStorage.setItem(AUTH_USER, JSON.stringify(updatedUser));
    return { ok: true, user: updatedUser };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_USER);
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout, updateUserName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
