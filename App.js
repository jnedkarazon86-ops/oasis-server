import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// المحركات الأساسية
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { Audio } from 'expo-av';

export default function App() {
  // حالات المستخدم والتسجيل
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);

  // حالات الشات والصوت
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);

  // 🔑 مفاتيحك البرمجية
  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";
  const CLOUD_NAME = "dvcnccegi"; 
  const UPLOAD_PRESET = "صوت أوايسس"; 

  const auth = getAuth();

  // --- 1. منطق مراقبة حالة المستخدم ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        initZego(currentUser.uid, currentUser.email.split('@')[0]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- 2. منطق الشات (يظهر فقط بعد تسجيل الدخول) ---
  useEffect(() => {
    if (user) {
      const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
      const unsubscribeChat = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChatMessages(msgs);
      });
      return () => unsubscribeChat();
    }
  }, [user]);

  const initZego = (id, name) => {
    ZegoUIKitPrebuiltCallService.init(appID, appSign, id, name, [ZegoUIKitSignalingPlugin]);
  };

  // --- 3. وظيفة إنشاء الحساب والتحقق بالرابط ---
  const handleSignUp = async () => {
    if (!email || !password) return Alert.alert("خطأ", "أدخل البيانات أولاً");
    setAuthLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      setIsWaitingVerify(true);
      setAuthLoading(false);
      
      // فحص التفعيل كل 3 ثوانٍ
      const timer = setInterval(async () => {
        await cred.user.reload();
        if (cred.user.emailVerified) {
          clearInterval(timer);
          setUser(cred.user);
          Alert.alert("نجاح", "تم تفعيل حسابك!");
        }
      }, 3000);
    } catch (e) {
      setAuthLoading(false);
      Alert.alert("فشل", "البريد مستخدم أو كلمة السر ضعيفة");
    }
  };

  // --- 4. وظائف الصوت والشات (نفس الكود السابق) ---
  const playSound = async (url) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      await sound.playAsync();
    } catch (e) { Alert.alert("خطأ", "فشل تشغيل الصوت"); }
  };

  const sendMessage = async () => {
    if (message.trim()) {
      const t = message; setMessage('');
      await addDoc(collection(db, "messages"), { text: t, senderId: user.uid, timestamp: serverTimestamp(), type: 'text' });
    }
  };

  async function startRecording() {
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status === "granted") {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording); setIsRecording(true);
    }
  }

  async function stopRecording() {
    setIsRecording(false); if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI(); setRecording(null);
    let fd = new FormData();
    fd.append('file', { uri, type: 'audio/m4a', name: `v_${Date.now()}.m4a` });
    fd.append('upload_preset', UPLOAD_PRESET);
    try {
      let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
      let data = await res.json();
      if (data.secure_url) {
        await addDoc(collection(db, "messages"), { audioUrl: data.secure_url, senderId: user.uid, timestamp: serverTimestamp(), type: 'audio' });
      }
    } catch (e) { Alert.alert("خطأ", "فشل الرفع"); }
  }

  // --- الواجهات ---
  if (!user) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="leaf" size={80} color="#25D366" />
        <Text style={styles.title}>واحة أوايسس</Text>
        {!isWaitingVerify ? (
          <View style={{width: '100%'}}>
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholderTextColor="#8596a0" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="كلمة السر" value={password} onChangeText={setPassword} placeholderTextColor="#8596a0" secureTextEntry />
            <TouchableOpacity style={styles.mainBtn} onPress={handleSignUp}>
              {authLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>إنشاء حساب جديد</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{alignItems: 'center'}}>
            <ActivityIndicator size="large" color="#25D366" />
            <Text style={styles.waitingText}>بانتظار ضغطك على رابط التفعيل في بريدك...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {/* واجهة الشات والمكالمات */}
      <View style={styles.header}>
        <Text style={styles.userName}>أوايسس شات</Text>
        <View style={styles.headerIcons}>
          <ZegoSendCallInvitationButton invitees={[{ userID: 'test_1', userName: 'صديق' }]} isVideoCall={true} resourceID={"oasis_video"} />
          <ZegoSendCallInvitationButton invitees={[{ userID: 'test_1', userName: 'صديق' }]} isVideoCall={false} resourceID={"oasis_voice"} />
        </View>
      </View>

      <FlatList 
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
            {item.type === 'audio' ? (
              <TouchableOpacity style={styles.audioRow} onPress={() => playSound(item.audioUrl)}>
                <Ionicons name="play-circle" size={32} color="white" />
                <Text style={{color: 'white', marginLeft: 10}}>بصمة صوتية</Text>
              </TouchableOpacity>
            ) : <Text style={styles.messageText}>{item.text}</Text>}
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        <TextInput style={styles.inputBox} placeholder="الرسالة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
        <TouchableOpacity 
          onLongPress={!message ? startRecording : null} 
          onPressOut={!message && isRecording ? stopRecording : null}
          onPress={message ? sendMessage : null}
          style={[styles.actionBtn, isRecording && {backgroundColor: 'red'}]}
        >
          <MaterialCommunityIcons name={message ? "send" : "microphone"} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 30 },
  container: { flex: 1, backgroundColor: '#0b141a' },
  title: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
  input: { backgroundColor: '#1f2c34', color: 'white', width: '100%', borderRadius: 12, padding: 15, marginBottom: 15, textAlign: 'right' },
  mainBtn: { backgroundColor: '#25D366', width: '100%', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingText: { color: 'white', textAlign: 'center', marginTop: 20 },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  bubble: { padding: 12, borderRadius: 15, margin: 10, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white' },
  audioRow: { flexDirection: 'row', alignItems: 'center' },
  bottomBar: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputBox: { flex: 1, backgroundColor: '#1f2c34', color: 'white', borderRadius: 25, paddingHorizontal: 20, height: 45, textAlign: 'right' },
  actionBtn: { width: 45, height: 45, backgroundColor: '#25D366', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});
