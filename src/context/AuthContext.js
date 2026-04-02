import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AUTH_USER = "trip_user";
const ADMIN_EMAIL = "admin123@gmail.com";
const GOOGLE_REDIRECT_FLAG = "google_auth_redirect";
const googleProvider = new GoogleAuthProvider();
const AuthContext = createContext(null);

function getFriendlyAuthError(error, fallbackMessage) {
  const code = error?.code || "";
  const host = typeof window !== "undefined" ? window.location.origin : "this site";

  switch (code) {
    case "auth/network-request-failed":
      return `Firebase Auth could not be reached from ${host}. Open the app from http://localhost:3000 or add this domain in Firebase Authorized Domains.`;
    case "auth/unauthorized-domain":
      return `This domain is not authorized for Firebase sign-in. Add ${host} in Firebase Authentication > Settings > Authorized domains.`;
    case "auth/configuration-not-found":
      return "Firebase Authentication is not configured for this project. Enable the sign-in provider in the Firebase console.";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled in Firebase. Enable it in the Firebase console.";
    default:
      return error?.message || fallbackMessage;
  }
}

function getRole(email) {
  return email === ADMIN_EMAIL ? "admin" : "user";
}

function isAllowedSignedInUser(firebaseUser) {
  return !!firebaseUser;
}

function buildBaseUser(firebaseUser, fallbackName = "") {
  const cleanName = (firebaseUser.displayName || fallbackName || "").trim();

  return {
    uid: firebaseUser.uid,
    name: cleanName,
    displayName: cleanName,
    email: firebaseUser.email || "",
    role: getRole(firebaseUser.email || ""),
    emailVerified: !!firebaseUser.emailVerified,
  };
}

async function persistUserProfile(firebaseUser, fallbackName = "") {
  const cleanName = (firebaseUser.displayName || fallbackName || "").trim();
  const role = getRole(firebaseUser.email || "");
  const payload = {
    uid: firebaseUser.uid,
    name: cleanName,
    email: firebaseUser.email || "",
    role,
    provider: firebaseUser.providerData?.[0]?.providerId || "password",
    emailVerified: !!firebaseUser.emailVerified,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", firebaseUser.uid), payload, { merge: true });

  return {
    ...buildBaseUser(firebaseUser, fallbackName),
    role,
  };
}

async function syncStoredUser(firebaseUser, fallbackName = "") {
  const baseUser = buildBaseUser(firebaseUser, fallbackName);

  try {
    await persistUserProfile(firebaseUser, fallbackName);
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));

    if (!snap.exists()) {
      return baseUser;
    }

    const data = snap.data();
    return {
      ...baseUser,
      name: data.name || baseUser.name,
      displayName: data.name || baseUser.displayName,
      role: data.role || baseUser.role,
      emailVerified: data.emailVerified ?? baseUser.emailVerified,
    };
  } catch (error) {
    console.warn("User profile sync failed", error);
    return baseUser;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error("Google redirect sign-in failed", error);
      sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem(AUTH_USER);
        return;
      }

      if (!isAllowedSignedInUser(firebaseUser)) {
        await signOut(auth);
        setUser(null);
        localStorage.removeItem(AUTH_USER);
        return;
      }
      const syncedUser = await syncStoredUser(firebaseUser, firebaseUser.displayName || "");
      setUser(syncedUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(syncedUser));
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

      const registeredUser = await syncStoredUser(credential.user, cleanName);
      setUser(registeredUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(registeredUser));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: getFriendlyAuthError(error, "Registration failed.") };
    }
  };

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;
      const currentUser = await syncStoredUser(firebaseUser, firebaseUser.displayName || "");

      setUser(currentUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(currentUser));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: getFriendlyAuthError(error, "Invalid email or password.") };
    }
  };

  const loginWithGoogle = async () => {
    try {
      sessionStorage.setItem(GOOGLE_REDIRECT_FLAG, "1");
      await signInWithRedirect(auth, googleProvider);
      return { ok: true, redirecting: true };
    } catch (error) {
      sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);
      return { ok: false, error: getFriendlyAuthError(error, "Google sign-in failed.") };
    }
  };

  const getAllUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      return {
        ok: true,
        data: snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
      };
    } catch (error) {
      console.error("getAllUsers failed", error);
      return {
        ok: false,
        data: [],
        error: error?.message || "Could not load users from Firestore.",
      };
    }
  };

  const updateUserRole = async (uid, role) => {
    if (!user || user.role !== "admin") {
      return { ok: false, error: "Admin access required." };
    }

    if (!uid || !["user", "admin"].includes(role)) {
      return { ok: false, error: "Invalid role update request." };
    }

    try {
      await updateDoc(doc(db, "users", uid), {
        role,
        updatedAt: serverTimestamp(),
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "Could not update role." };
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
    <AuthContext.Provider value={{ user, register, login, loginWithGoogle, logout, updateUserName, getAllUsers, updateUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
