// mobile/Constants.js

/**
 * ملف الإعدادات المركزية للمشروع (Oasis App)
 * يحتوي على مفاتيح Firebase و ZegoCloud اللازمة للتشغيل
 */

export const OASIS_KEYS = {
  // إعدادات قاعدة البيانات والتنبيهات من Firebase
  FIREBASE: {
    apiKey: "AIzaSyBKPGFbYjqEacHoU61DiUYq4QJzHENVUE0",
    authDomain: "oasis-app-afa66.firebaseapp.com",
    projectId: "oasis-app-afa66",
    storageBucket: "oasis-app-afa66.firebasestorage.app",
    messagingSenderId: "382600269975",
    appId: "1:382600269975:android:d4fbc3e410dc0652cfd9d2"
  },

  // إعدادات ZegoCloud للمكالمات الصوتية والمرئية (Mobile SDK)
  ZEGO: {
    appID: 1773421291, // مستخرج من تحليل الصور
    appSign: "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7", // مستخرج من تحليل الصور
    serverSecret: "48167f05ad6fff1777e0aec0e17a00ef", // القيمة التي زودتني بها الآن
    resourceID: "zegouikit_call", // المعرف اللازم لتفعيل واجهة الاتصال والتنبيهات
  },

  // إعدادات الإعلانات والربح
  AD_REFRESH_RATE: 60000, 
  PROFIT_LINKS: [
    "https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807", 
    "https://otieu.com/4/10520849",                                                
    "https://www.effectivegatecpm.com/qrjky2k9d7?key=0eeb59c5339d8e2b8a7f28e55e6d16a2", 
    "https://www.effectivegatecpm.com/g5j4wjcf?key=0c62848e4ddf4458b8d378fe3132bbaf", 
    "https://www.effectivegatecpm.com/denseskhi?key=8e442518041da6a96a35ad2f7275ed15"  
  ]
};
