import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserHotelBookings(uid) {
  if (!uid) return [];

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];

    const data = snap.data();
    return Array.isArray(data.hotelBookings) ? data.hotelBookings : [];
  } catch (_) {
    return [];
  }
}

export async function saveUserHotelBooking(uid, booking) {
  if (!uid || !booking) return;

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        hotelBookings: arrayUnion(booking),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {}
}
