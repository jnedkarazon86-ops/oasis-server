import CryptoJS from 'react-native-crypto-js';

const SECRET_KEY = "Oasis_Secure_Key_2026"; 

export const encryptMessage = (message) => {
  if (!message) return ""; // حماية ضد القيم الفارغة
  return CryptoJS.AES.encrypt(String(message), SECRET_KEY).toString();
};

export const decryptMessage = (cipherText) => {
  if (!cipherText) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || "رسالة مشفرة"; 
  } catch (e) { 
    return "رسالة مشفرة"; 
  }
};
