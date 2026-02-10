// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// استيراد الإعدادات المركزية من ملف Constants لضمان التنسيق ومنع التكرار
import { OASIS_KEYS } from './Constants'; 

/**
 * تهيئة Firebase باستخدام المفاتيح الموحدة.
 * ملاحظة: تم سحب الإعدادات من OASIS_KEYS.FIREBASE لتجنب 
 * وجود قيم مكتوبة يدوياً (Hardcoded) كما هو مطلوب في تحليل المشروع.
 */
const firebaseConfig = OASIS_KEYS.FIREBASE;

// بدء تشغيل تطبيق Firebase
const app = initializeApp(firebaseConfig);

// تصدير قواعد البيانات وخدمة التوثيق لاستخدامها في بقية التطبيق
export const db = getFirestore(app);
export const auth = getAuth(app);
