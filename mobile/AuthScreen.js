import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// استيراد الثوابت (مهم جداً للربط مع ZegoCloud لاحقاً)
import { OASIS_KEYS } from './Constants';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // إضافة حالة التحميل لرفع جودة تجربة المستخدم

  const handleAuth = async (type) => {
    if (!email || !password) {
      Alert.alert("خطأ", "يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoading(true);
    try {
      if (type === 'signup') {
        // 1. إنشاء الحساب في Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. إرسال رابط التحقق
        await sendEmailVerification(user);

        // 3. إنشاء نسخة للمستخدم في Firestore (لضمان ظهوره في قائمة جهات الاتصال)
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          id: user.uid,
          userName: user.email.split('@')[0],
          createdAt: serverTimestamp(),
          status: "Offline"
        });

        Alert.alert("تفعيل الحساب", "تم إرسال رابط التفعيل لبريدك. يرجى تفعيله ثم تسجيل الدخول.");
        await signOut(auth); // تسجيل الخروج حتى يتم التفعيل

      } else {
        // عملية تسجيل الدخول
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          Alert.alert("تنبيه", "يرجى تفعيل بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.");
          await signOut(auth);
        } else {
          // تحديث حالة المستخدم عند الدخول بنجاح
          await setDoc(doc(db, "users", user.uid), {
            lastLogin: serverTimestamp(),
            status: "Online"
          }, { merge: true });
        }
      }
    } catch (error) {
      // معالجة الأخطاء بشكل مفصل (حل مشكلة النواقص في الصور)
      let errorMessage = "حدث خطأ غير متوقع";
      if (error.code === 'auth/email-already-in-use') errorMessage = "هذا البريد مسجل بالفعل.";
      if (error.code === 'auth/weak-password') errorMessage = "كلمة المرور ضعيفة جداً.";
      if (error.code === 'auth/user-not-found') errorMessage = "لا يوجد حساب بهذا البريد.";
      if (error.code === 'auth/wrong-password') errorMessage = "كلمة المرور غير صحيحة.";
      
      Alert.alert("فشل العملية", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oasis Messenger</Text>
      
      <TextInput 
        placeholder="البريد الإلكتروني" 
        style={styles.input} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
        keyboardType="email-address"
        placeholderTextColor="#8596a0"
      />
      
      <TextInput 
        placeholder="كلمة المرور" 
        style={styles.input} 
        onChangeText={setPassword} 
        secureTextEntry 
        placeholderTextColor="#8596a0"
      />

      {loading ? (
        <ActivityIndicator size="large" color="#00a884" />
      ) : (
        <>
          <TouchableOpacity style={styles.btn} onPress={() => handleAuth('login')}>
            <Text style={styles.btnText}>دخول</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.btn, {backgroundColor:'#2196F3', marginTop:15}]} 
            onPress={() => handleAuth('signup')}
          >
            <Text style={styles.btnText}>إنشاء حساب جديد</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 25, backgroundColor: '#0b141a' },
  title: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  input: { 
    backgroundColor: '#1f2c34', 
    color: 'white', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15,
    textAlign: 'right' // ليتناسب مع اللغة العربية
  },
  btn: { backgroundColor: '#00a884', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
