import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBKPGFbYjqEacHoU61DiUYq4QJzHENVUE0", // مفتاحك الفعلي الذي أرسلته
  authDomain: "oasis-app-afa66.firebaseapp.com",
  projectId: "oasis-app-afa66",
  storageBucket: "oasis-app-afa66.firebasestorage.app",
  messagingSenderId: "382600269975",
  appId: "1:382600269975:android:d4fbc3e410dc0652cfd9d2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
