import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ضع معلوماتك الحقيقية هنا من إعدادات مشروع Firebase (Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSy... ضع مفتاحك هنا",
  authDomain: "oasis-app.firebaseapp.com",
  projectId: "oasis-app",
  storageBucket: "oasis-app.appspot.com",
  messagingSenderId: "ضع الرقم هنا",
  appId: "ضع الرقم هنا"
};

// تشغيل Firebase
const app = initializeApp(firebaseConfig);

// تصدير قاعدة البيانات (Firestore) فقط لأننا نستخدمها للنصوص وروابط الصوت
export const db = getFirestore(app);
