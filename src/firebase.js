import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBTz4liFMT17uQeCVaZo1RGIj1AK3-iiY",
  authDomain: "devin-booker-card-collection.firebaseapp.com",
  projectId: "devin-booker-card-collection",
  storageBucket: "devin-booker-card-collection.firebasestorage.app",
  messagingSenderId: "18422522654",
  appId: "1:18422522654:web:88b5d71d01d5c106e95f0f",
  measurementId: "G-YZBD0HM044"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
