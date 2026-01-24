import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // جهزناه للصوت لاحقاً

// هذه المعلومات تجدها في إعدادات مشروعك بـ Firebase (Project Settings)
const firebaseConfig = {
  apiKey: "ضغ_هنا_API_KEY",
  authDomain: "oasis-app.firebaseapp.com",
  projectId: "oasis-app",
  storageBucket: "oasis-app.appspot.com",
  messagingSenderId: "ضغ_هنا_ID",
  appId: "ضغ_هنا_APP_ID"
};

// تشغيل Firebase
const app = initializeApp(firebaseConfig);

// تصدير الأدوات لاستخدامها في الكود الكبير
export const db = getFirestore(app);
export const storage = getStorage(app);
