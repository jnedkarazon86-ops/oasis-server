import CryptoJS from 'react-native-crypto-js';

// هاد "الملح" بيبقى ثابت في التطبيق لزيادة قوة التشفير
const SALT = "Oasis_Legacy_Secure_#!2026"; 

/**
 * التشفير باستخدام UID المستخدم
 * هاد بيخلي كل مستخدم عنده "خزنة" خاصة فيه مستحيل تنفتح بمفتاح مستخدم تاني
 */
export const encryptMessage = (message, userUid) => {
  if (!message || !userUid) return ""; 
  
  // دمج الـ UID مع الـ SALT لإنشاء مفتاح فريد جداً
  const dynamicKey = userUid + SALT;
  
  return CryptoJS.AES.encrypt(String(message), dynamicKey).toString();
};

/**
 * فك التشفير باستخدام UID المستخدم
 */
export const decryptMessage = (cipherText, userUid) => {
  if (!cipherText || !userUid) return "";
  try {
    const dynamicKey = userUid + SALT;
    const bytes = CryptoJS.AES.decrypt(cipherText, dynamicKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    
    // إذا فشل فك التشفير أو كان النص فارغاً
    return originalText || "رسالة مشفرة"; 
  } catch (e) { 
    return "رسالة مشفرة"; 
  }
};
