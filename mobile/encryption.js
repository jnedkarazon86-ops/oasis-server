import CryptoJS from 'react-native-crypto-js';

const SECRET_KEY = "Oasis_Secure_Key_2026"; // مفتاح التشفير الخاص بك

export const encryptMessage = (message) => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
};

export const decryptMessage = (cipherText) => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) { return "رسالة مشفرة"; }
};
