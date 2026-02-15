// mobile/Constants.js

/**
 * ملف الإعدادات المركزية للمشروع (Oasis App)
 * تم تنظيفه بالكامل من شركات الإعلانات السابقة ودمج Start.io
 */

export const OASIS_KEYS = {
  // إعدادات قاعدة البيانات والتنبيهات من Firebase (باقية كما هي لضمان عمل التطبيق)
  FIREBASE: {
    apiKey: "AIzaSyBKPGFbYjqEacHoU61DiUYq4QJzHENVUE0",
    authDomain: "oasis-app-afa66.firebaseapp.com",
    projectId: "oasis-app-afa66",
    storageBucket: "oasis-app-afa66.firebasestorage.app",
    messagingSenderId: "382600269975",
    appId: "1:382600269975:android:d4fbc3e410dc0652cfd9d2"
  },

  // إعدادات ZegoCloud للمكالمات الصوتية والمرئية (باقية كما هي لضمان عمل الاتصال)
  ZEGO: {
    appID: 1773421291,
    appSign: "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7",
    serverSecret: "48167f05ad6fff1777e0aec0e17a00ef",
    resourceID: "zegouikit_call",
  },

  // إعدادات الإعلانات الجديدة (Start.io) - تم حذف الروابط القديمة نهائياً
  ADS: {
    STARTAPP_ID: "201405341",
    AD_REFRESH_RATE: 45000, // تحديث تلقائي كل 45 ثانية لزيادة الربح بذكاء
    BANNER_HEIGHT: 55,      // الارتفاع المناسب للمستطيل الصغير
    HEADER_HEIGHT: 75       // مساحة الاسم الواسعة التي اتفقنا عليها
  }
};
