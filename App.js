import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// الاستيرادات الأساسية
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { Audio } from 'expo-av';

// إعدادات الروابط والمفاتيح
const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';
const appID = 1773421291; 
const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  
  const [allUsers, setAllUsers] = useState([]); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);

  // 1. إدارة جلسة المستخدم وجلب قائمة الأصدقاء
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsWaitingVerify(false);
          
          // تحديث بيانات المستخدم في Firestore ليكون متاحاً للآخرين
          await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, 
            id: currentUser.uid,
            lastSeen: serverTimestamp() 
          }, { merge: true });

          // جلب قائمة الأصدقاء (كل المستخدمين ما عدا أنا)
          const qUsers = query(collection(db, "users"));
          onSnapshot(qUsers, (snapshot) => {
            setAllUsers(snapshot.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid));
          });

          // تهيئة خدمة الاتصال
          ZegoUIKitPrebuiltCallService.init(
            appID, appSign, currentUser.uid, currentUser.email.split('@')[0], 
            [ZegoUIKitSignalingPlugin]
          );
        } else {
          setIsWaitingVerify(true);
        }
      } else {
        setUser(null);
        ZegoUIKitPrebuiltCallService.uninit();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. توليد معرف الغرفة الخاصة (Unique Chat ID)
  const getChatId = (uid1, uid2) => (uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`);

  // 3. جلب رسائل المحادثة المختارة فقط
  useEffect(() => {
    if (user && selectedUser) {
      const chatId = getChatId(user.uid, selectedUser.id);
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [selectedUser]);

  // 4. منطق تسجيل الدخول / التسجيل
  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await sendEmailVerification(cred.user);
          setIsWaitingVerify(true);
          Alert.alert("واحة أوايسس", "أرسلنا رابط تفعيل لبريدك الإلكتروني.");
        } catch (e) { Alert.alert("خطأ", e.message); }
      } else { Alert.alert("خطأ", error.message); }
    }
    setAuthLoading(false);
  };

  // 5. إرسال رسالة نصية خاصة
  const sendMessage = async () => {
    if (message.trim() && selectedUser) {
      const chatId = getChatId(user.uid, selectedUser.id);
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: message,
          senderId: user.uid,
          type: 'text',
          timestamp: serverTimestamp()
        });
        setMessage('');
      } catch (e) { Alert.alert("خطأ", "فشل الإرسال"); }
    }
  };

  // 6. التعامل مع البصمات الصوتية (Recording & Upload)
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("فشل التسجيل", err.message); }
  }

  async function stopRecording() {
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: `voice_${Date.now()}.m4a` });
      formData.append('user', user.email);

      const response = await fetch(`${SERVER_URL}/api/upload-audio`, { method: 'POST', body: formData });
      const result = await response.json();

      if (result.status === 'success') {
        const chatId = getChatId(user.uid, selectedUser.id);
        await addDoc(collection(db, "chats", chatId, "messages"), {
          audioUrl: result.url,
          senderId: user.uid,
          type: 'audio',
          timestamp: serverTimestamp()
        });
      }
    } catch (err) { Alert.alert("خطأ", "فشل رفع الصوت للسيرفر"); }
  }

  async function playVoice(url) {
    try {
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${SERVER_URL}/${url}` });
      setSound(newSound);
      await newSound.playAsync();
    } catch (e) { Alert.alert("خطأ", "لا يمكن تشغيل الصوت"); }
  }

  // --- واجهات المستخدم ---

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <Ionicons name="leaf" size={70} color="#25D366" />
          <Text style={styles.authTitle}>واحة أوايسس</Text>
          {!isWaitingVerify ? (
            <>
              <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#8596a0" />
              <TextInput style={styles.input} placeholder="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#8596a0" />
              <TouchableOpacity style={styles.mainBtn} onPress={handleAuth}>
                {authLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>دخول / تسجيل جديد</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{alignItems: 'center'}}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.waitingText}>يرجى تفعيل بريدك الإلكتروني ثم تسجيل الدخول</Text>
              <TouchableOpacity onPress={() => auth.signOut()}><Text style={{color: '#25D366', marginTop: 20}}>الرجوع للخلف</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // واجهة اختيار الصديق
  if (!selectedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.userName}>قائمة الأصدقاء في واحة</Text></View>
        <FlatList 
          data={allUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => setSelectedUser(item)}>
              <View style={styles.avatar}><Text style={{color:'white'}}>{item.email[0].toUpperCase()}</Text></View>
              <View style={{flex: 1, alignItems: 'flex-end'}}>
                <Text style={styles.messageText}>{item.email}</Text>
                <Text style={{color: '#8596a0', fontSize: 12}}>انقر لبدء دردشة خاصة</Text>
              </View>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={{padding: 20, alignItems: 'center'}} onPress={() => auth.signOut()}>
            <Text style={{color: '#ff3b30'}}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // واجهة الدردشة الخاصة
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={28} color="white" /></TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.userName}>{selectedUser.email.split('@')[0]}</Text>
            <Text style={{color: '#25D366', fontSize: 10}}>دردشة خاصة مشفرة</Text>
        </View>
        <View style={styles.headerIcons}>
          <ZegoSendCallInvitationButton 
            invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
            isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="#1f2c34" iconWidth={30} iconHeight={30} 
          />
        </View>
      </View>

      <FlatList 
        data={chatMessages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
            {item.type === 'audio' ? (
              <TouchableOpacity onPress={() => playVoice(item.audioUrl)} style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="play-circle" size={30} color="white" />
                <Text style={styles.messageText}> بصمة صوتية</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput style={styles.textInput} placeholder="مراسلة..." value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
        </View>
        <TouchableOpacity 
            style={[styles.sendBtn, isRecording && {backgroundColor: '#ff3b30'}]} 
            onPress={message ? sendMessage : (isRecording ? stopRecording : startRecording)}
        >
          <MaterialCommunityIcons name={message ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authCard: { backgroundColor: '#1f2c34', width: '100%', borderRadius: 25, padding: 30, alignItems: 'center' },
  authTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', marginVertical: 20 },
  input: { backgroundColor: '#2a3942', color: 'white', width: '100%', borderRadius: 12, padding: 15, marginBottom: 15, textAlign: 'right' },
  mainBtn: { backgroundColor: '#25D366', width: '100%', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingText: { color: '#ffcc00', marginTop: 20, textAlign: 'center' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  userCard: { flexDirection: 'row-reverse', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#2a3942', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  bubble: { padding: 12, borderRadius: 15, marginHorizontal: 15, marginVertical: 5, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: '#0b141a' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, height: 50, justifyContent: 'center' },
  textInput: { color: 'white', textAlign: 'right' },
  sendBtn: { width: 50, height: 50, backgroundColor: '#25D366', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
