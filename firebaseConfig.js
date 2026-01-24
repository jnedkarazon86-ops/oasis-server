import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // أضفنا هذا السطر

const firebaseConfig = {
  apiKey: "AIzaSy...", // مفتاحك هنا
  authDomain: "oasis-app.firebaseapp.com",
  projectId: "oasis-app",
  storageBucket: "oasis-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// تشغيل Firebase
const app = initializeApp(firebaseConfig);

// تصدير قاعدة البيانات
export const db = getFirestore(app);

// تصدير نظام المصادقة (مهم جداً للتحقق بالإيميل)
export const auth = getAuth(app); 
