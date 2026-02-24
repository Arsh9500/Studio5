import React, { createContext, useContext, useState, useEffect } from "react";

const AUTH_USER = "trip_user";
const AUTH_USERS = "trip_users";
const ADMIN_EMAIL = "admin123@gmail.com";
const ADMIN_PASSWORD = "Admin@123";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_USER);
    if (saved) {
      try {
        const savedUser = JSON.parse(saved);
        // If saved user lacks a role, try to recover it from stored users
        try {
          const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
          const match = users.find((u) => u.email === savedUser.email);
          if (match && match.role && !savedUser.role) {
            const patched = { ...savedUser, role: match.role };
            setUser(patched);
            localStorage.setItem(AUTH_USER, JSON.stringify(patched));
          } else if (!savedUser.role && savedUser.email === ADMIN_EMAIL) {
            // fallback: if email matches admin constant, grant admin role
            const patched = { ...savedUser, role: "admin" };
            setUser(patched);
            localStorage.setItem(AUTH_USER, JSON.stringify(patched));
          } else {
            setUser(savedUser);
          }
        } catch (_) {
          setUser(savedUser);
        }
      } catch (_) {}
    }
    // Ensure admin account exists in stored users so admin can login after first load
    try {
      const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
      const hasAdmin = users.some((u) => u.email === ADMIN_EMAIL);
      if (!hasAdmin) {
        users.push({ name: "Administrator", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" });
        localStorage.setItem(AUTH_USERS, JSON.stringify(users));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const register = (name, email, password) => {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: "Email already registered." };
    }
    const role = email === ADMIN_EMAIL && password === ADMIN_PASSWORD ? "admin" : "user";
    users.push({ name, email, password, role });
    localStorage.setItem(AUTH_USERS, JSON.stringify(users));
    const newUser = { name, displayName: name, email, role };
    setUser(newUser);
    localStorage.setItem(AUTH_USER, JSON.stringify(newUser));
    return { ok: true };
  };

  const login = (email, password) => {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) return { ok: false, error: "Invalid email or password." };
    const role = found.role || (found.email === ADMIN_EMAIL && password === ADMIN_PASSWORD ? "admin" : "user");
    const u = { name: found.name, displayName: found.name, email: found.email, role };
    setUser(u);
    localStorage.setItem(AUTH_USER, JSON.stringify(u));
    return { ok: true };
  };

  const getAllUsers = () => {
    return JSON.parse(localStorage.getItem(AUTH_USERS) || "[]");
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
    <AuthContext.Provider value={{ user, register, login, logout, updateUserName, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
