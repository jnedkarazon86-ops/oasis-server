import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { auth } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (type) => {
    try {
      if (type === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // إغلاق سلك التحقق: إرسال الرابط فوراً
        await sendEmailVerification(userCredential.user);
        Alert.alert("تفعيل الحساب", "تم إرسال رابط التفعيل لبريدك. يرجى تفعيله ثم تسجيل الدخول.");
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          Alert.alert("تنبيه", "يرجى تفعيل بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.");
          auth.signOut();
        }
      }
    } catch (error) { Alert.alert("خطأ", error.message); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oasis Login</Text>
      <TextInput placeholder="Email" style={styles.input} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput placeholder="Password" style={styles.input} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={() => handleAuth('login')}><Text style={{color:'white'}}>دخول</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, {backgroundColor:'#2196F3', marginTop:10}]} onPress={() => handleAuth('signup')}><Text style={{color:'white'}}>إنشاء حساب جديد</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0b141a' },
  input: { backgroundColor: '#1f2c34', color: 'white', padding: 15, borderRadius: 10, marginBottom: 10 },
  title: { color: 'white', fontSize: 24, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#00a884', padding: 15, borderRadius: 10, alignItems: 'center' }
});
