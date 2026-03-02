import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserWishlist(uid) {
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.wishlist) ? data.wishlist : [];
  } catch (_) {
    return [];
  }
}

export async function saveUserWishlist(uid, wishlist) {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      { wishlist, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (_) {}
}
