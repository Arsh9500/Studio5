import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserWishlist(uid) {
  if (!uid) return [];
  try {
    // Primary location: users/{uid}.wishlist
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const userWishlist = Array.isArray(userData.wishlist) ? userData.wishlist : [];
      if (userWishlist.length > 0) return userWishlist;
    }

    // Backward-compatible fallback: wishlists/{uid}.items
    const wishlistSnap = await getDoc(doc(db, "wishlists", uid));
    if (wishlistSnap.exists()) {
      const wishlistData = wishlistSnap.data();
      const wishlistItems = Array.isArray(wishlistData.items) ? wishlistData.items : [];
      if (wishlistItems.length > 0) {
        // Keep users/{uid}.wishlist populated for your current console view.
        await setDoc(
          doc(db, "users", uid),
          { wishlist: wishlistItems, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      return wishlistItems;
    }

    return [];
  } catch (_) {
    return [];
  }
}

export async function saveUserWishlist(uid, wishlist) {
  if (!uid) return;
  try {
    // Save into users/{uid}.wishlist (requested location).
    await setDoc(
      doc(db, "users", uid),
      { wishlist, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Also mirror to wishlists/{uid}.items for compatibility.
    await setDoc(
      doc(db, "wishlists", uid),
      { uid, items: wishlist, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (_) {}
}
