import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserChatHistory(uid) {
  if (!uid) return [];

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];

    const data = snap.data();
    return Array.isArray(data.chatHistory) ? data.chatHistory : [];
  } catch (_) {
    return [];
  }
}

export async function saveUserChatMessage(uid, message) {
  if (!uid || !message) return;

  const payload = {
    userId: uid,
    text: message.text || "",
    sender: message.role || "bot",
    timestamp: message.timestamp || new Date().toISOString(),
    relatedSearchType: message.relatedSearchType || "general",
    placeResults: Array.isArray(message.places) ? message.places.slice(0, 6) : [],
  };

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        chatHistory: arrayUnion(payload),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {}
}
