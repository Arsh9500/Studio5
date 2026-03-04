import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./Profile.css";

function Profile() {
  const { user, updateUserName } = useAuth();
  const storageKey = useMemo(() => `profile_${user?.uid || user?.email || "guest"}`, [user]);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({
    fullName: "",
    email: user?.email || "",
    phone: "",
    nationality: "",
    travelStyle: "",
  });

  useEffect(() => {
    if (!user) return;
    const baseProfile = {
      fullName: user.displayName || "",
      email: user.email || "",
      phone: "",
      nationality: "",
      travelStyle: "",
    };

    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const fromDb = {
            fullName: data.fullName || data.name || baseProfile.fullName,
            email: data.email || baseProfile.email,
            phone: data.phone || "",
            nationality: data.nationality || "",
            travelStyle: data.travelStyle || "",
          };
          setProfile(fromDb);
          localStorage.setItem(storageKey, JSON.stringify(fromDb));
          return;
        }
      } catch (_) {}

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setProfile({ ...baseProfile, ...parsed });
          return;
        } catch (_) {}
      }

      setProfile(baseProfile);
    };

    loadProfile();
  }, [storageKey, user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const cleanName = profile.fullName.trim();
      if (user && cleanName && cleanName !== user.displayName) {
        await updateUserName(cleanName);
      }

      const profileToSave = { ...profile, fullName: cleanName };
      if (user?.uid) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            name: cleanName,
            fullName: cleanName,
            email: profileToSave.email,
            phone: profileToSave.phone,
            nationality: profileToSave.nationality,
            travelStyle: profileToSave.travelStyle,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      localStorage.setItem(storageKey, JSON.stringify(profileToSave));
      setProfile(profileToSave);
      setMessage(`Welcome ${cleanName || "traveler"}, your profile was updated and saved to Firestore.`);
    } catch (error) {
      setMessage("Could not save profile right now. Please try again.");
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1>Traveler Profile</h1>
        <p className="profile-subtitle">Update your details and preferences.</p>

        <form onSubmit={onSubmit} className="profile-form">
          <label>Full Name</label>
          <input name="fullName" value={profile.fullName} onChange={onChange} placeholder="Your full name" required />

          <label>Email</label>
          <input name="email" type="email" value={profile.email} onChange={onChange} placeholder="Your email" required />

          <label>Phone</label>
          <input name="phone" value={profile.phone} onChange={onChange} placeholder="+1 555 123 4567" />

          <label>Nationality</label>
          <input name="nationality" value={profile.nationality} onChange={onChange} placeholder="e.g. New Zealand" />

          <label>Travel Style</label>
          <select name="travelStyle" value={profile.travelStyle} onChange={onChange} required>
            <option value="">Select style</option>
            <option value="Budget">Budget</option>
            <option value="Mid-range">Mid-range</option>
            <option value="Luxury">Luxury</option>
            <option value="Adventure">Adventure</option>
          </select>

          <button type="submit">Save Profile</button>
          {message && <p className="profile-message">{message}</p>}
        </form>

        <div className="profile-saved">
          <h2>Saved Details</h2>
          <p><strong>Name:</strong> {profile.fullName || "-"}</p>
          <p><strong>Email:</strong> {profile.email || "-"}</p>
          <p><strong>Phone:</strong> {profile.phone || "-"}</p>
          <p><strong>Nationality:</strong> {profile.nationality || "-"}</p>
          <p><strong>Travel Style:</strong> {profile.travelStyle || "-"}</p>
        </div>

        <Link to="/" className="profile-back-link">Back to Home</Link>
      </div>
    </div>
  );
}

export default Profile;
