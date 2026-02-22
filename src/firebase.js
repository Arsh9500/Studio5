// firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBUUGg5YTwyE0wdaBxShAW0ArtJqfIJLx4",
  authDomain: "travel-website-a6f0d.firebaseapp.com",
  projectId: "travel-website-a6f0d",
  storageBucket: "travel-website-a6f0d.firebasestorage.app",
  messagingSenderId: "1072172420630",
  appId: "1:1072172420630:web:ee54ffda454c0ea34d6f37"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
