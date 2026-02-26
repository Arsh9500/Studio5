import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AUTH_USER = "trip_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem(AUTH_USER);
        return;
      }

      const baseUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "",
        displayName: firebaseUser.displayName || "",
        email: firebaseUser.email || "",
      };

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const mergedUser = {
            ...baseUser,
            name: data.name || baseUser.name,
            displayName: data.name || baseUser.displayName,
          };
          setUser(mergedUser);
          localStorage.setItem(AUTH_USER, JSON.stringify(mergedUser));
        } else {
          setUser(baseUser);
          localStorage.setItem(AUTH_USER, JSON.stringify(baseUser));
        }
      } catch (_) {
        setUser(baseUser);
        localStorage.setItem(AUTH_USER, JSON.stringify(baseUser));
      }

    });

    return () => unsubscribe();
  }, []);

  const register = async (name, email, password) => {
    try {
      const cleanName = (name || "").trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (cleanName) {
        await updateProfile(credential.user, { displayName: cleanName });
      }

      await setDoc(
        doc(db, "users", credential.user.uid),
        {
          uid: credential.user.uid,
          name: cleanName,
          email: credential.user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const newUser = {
        uid: credential.user.uid,
        name: cleanName,
        displayName: cleanName,
        email: credential.user.email || email,
      };
      setUser(newUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(newUser));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "Registration failed." };
    }
  };

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;
      const u = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "",
        displayName: firebaseUser.displayName || "",
        email: firebaseUser.email || email,
      };
      setUser(u);
      localStorage.setItem(AUTH_USER, JSON.stringify(u));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "Invalid email or password." };
    }
  };

  const updateUserName = async (name) => {
    if (!user) return { ok: false, error: "Not logged in." };
    const cleanName = (name || "").trim();
    if (!cleanName) return { ok: false, error: "Name is required." };

    try {
      await updateProfile(auth.currentUser, { displayName: cleanName });
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: cleanName,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      return { ok: false, error: error.message || "Could not update name." };
    }

    const updatedUser = { ...user, name: cleanName, displayName: cleanName };
    setUser(updatedUser);
    localStorage.setItem(AUTH_USER, JSON.stringify(updatedUser));
    return { ok: true, user: updatedUser };
  };

  const logout = async () => {
    await signOut(auth);
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
