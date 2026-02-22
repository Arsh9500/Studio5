import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ? { ...currentUser } : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (name, email, password) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name && name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      setUser({ ...cred.user });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const login = async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser({ ...cred.user });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUserName = async (displayName) => {
    const nextName = (displayName || "").trim();
    if (!auth.currentUser || !nextName) return;
    await updateProfile(auth.currentUser, { displayName: nextName });
    setUser((prev) => (prev ? { ...prev, displayName: nextName } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout, updateUserName }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
