// أولاً: يجب التأكد من وجود مكتبة crypto-js في المشروع
import CryptoJS from "crypto-js";

// مفتاح التشفير السري (لا تشاركه مع أحد)
const SECRET_KEY = "oasis_secure_shield_2026_@!";

// وظيفة لتشفير الرسالة قبل الإرسال
const encryptMessage = (text) => {
  if (!text) return "";
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

// وظيفة لفك تشفير الرسالة عند الاستلام لعرضها للمستخدم
const decryptMessage = (ciphertext) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("خطأ في فك التشفير:", error);
    return "رسالة مشفرة";
  }

};
const addNewChatByEmail = async (targetEmail) => {
  // التأكد من أن الإيميل صالح
  if (!targetEmail.includes('@')) {
    alert("يرجى إدخال بريد إلكتروني صحيح");
    return;
  }

  try {
    // إرسال طلب للسيرفر لإنشاء غرفة دردشة جديدة
    const response = await fetch("https://oasis-server-e6sc.onrender.com/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants: [user.id, targetEmail],
        is_group: false
      })
    });
    
    const data = await response.json();
    console.log("تمت إضافة المحادثة بنجاح:", data);
  } catch (error) {
    console.error("فشل في إضافة المحادثة:", error);
  }
};
