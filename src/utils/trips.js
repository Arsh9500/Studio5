import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserTrips(uid) {
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.trips) ? data.trips : [];
  } catch (_) {
    return [];
  }
}

export async function saveUserTrips(uid, trips) {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      { trips, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (_) {}
}
