import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadUserBudgets(uid) {
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.budgets) ? data.budgets : [];
  } catch (_) {
    return [];
  }
}

export async function saveUserBudgets(uid, budgets) {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      { budgets, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (_) {}
}
