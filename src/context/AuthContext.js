import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
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
const googleProvider = new GoogleAuthProvider();
const AuthContext = createContext(null);

function getRole(email) {
  return email === ADMIN_EMAIL ? "admin" : "user";
}

function isPasswordAccount(firebaseUser) {
  return firebaseUser?.providerData?.some((provider) => provider.providerId === "password");
}

function isAllowedSignedInUser(firebaseUser) {
  if (!firebaseUser) return false;
  return !isPasswordAccount(firebaseUser) || firebaseUser.emailVerified;
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
    uid: firebaseUser.uid,
    name: cleanName,
    displayName: cleanName,
    email: firebaseUser.email || "",
    role,
    emailVerified: !!firebaseUser.emailVerified,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

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

      const baseUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "",
        displayName: firebaseUser.displayName || "",
        email: firebaseUser.email || "",
        role: getRole(firebaseUser.email || ""),
        emailVerified: !!firebaseUser.emailVerified,
      };

      try {
        await persistUserProfile(firebaseUser, baseUser.name);
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const mergedUser = {
            ...baseUser,
            name: data.name || baseUser.name,
            displayName: data.name || baseUser.displayName,
            role: data.role || baseUser.role,
            emailVerified: data.emailVerified ?? baseUser.emailVerified,
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

      await persistUserProfile(credential.user, cleanName);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      setUser(null);
      localStorage.removeItem(AUTH_USER);
      return { ok: true, verificationSent: true };
    } catch (error) {
      return { ok: false, error: error.message || "Registration failed." };
    }
  };

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser).catch(() => {});
        await signOut(auth);
        setUser(null);
        localStorage.removeItem(AUTH_USER);
        return {
          ok: false,
          error: "Please verify your email first. A new verification email has been sent.",
        };
      }

      let currentUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "",
        displayName: firebaseUser.displayName || "",
        email: firebaseUser.email || email,
        role: getRole(firebaseUser.email || email),
        emailVerified: !!firebaseUser.emailVerified,
      };

      try {
        await persistUserProfile(firebaseUser, currentUser.name);
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          currentUser = {
            ...currentUser,
            name: data.name || currentUser.name,
            displayName: data.name || currentUser.displayName,
            role: data.role || currentUser.role,
            emailVerified: data.emailVerified ?? currentUser.emailVerified,
          };
        }
      } catch (_) {
        // ignore
      }

      setUser(currentUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(currentUser));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "Invalid email or password." };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const firebaseUser = credential.user;
      const additionalInfo = getAdditionalUserInfo(credential);
      const savedUser = await persistUserProfile(firebaseUser, firebaseUser.displayName || "");
      setUser(savedUser);
      localStorage.setItem(AUTH_USER, JSON.stringify(savedUser));
      return { ok: true, isNewUser: !!additionalInfo?.isNewUser, user: savedUser };
    } catch (error) {
      return { ok: false, error: error.message || "Google sign-in failed." };
    }
  };

  const getAllUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map((entry) => entry.data());
    } catch (error) {
      console.error("getAllUsers failed", error);
      return [];
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
    <AuthContext.Provider value={{ user, register, login, loginWithGoogle, logout, updateUserName, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
