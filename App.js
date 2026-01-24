import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// الاستيرادات الأساسية
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { sendEmailVerification, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { Audio } from 'expo-av';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  
  // منطق الصوت
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);

  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";
  const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsWaitingVerify(false);
          ZegoUIKitPrebuiltCallService.init(appID, appSign, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
        } else {
          setIsWaitingVerify(true);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
      const unsubscribeChat = onSnapshot(q, (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribeChat();
    }
  }, [user]);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await sendEmailVerification(userCredential.user);
          setIsWaitingVerify(true);
          Alert.alert("واحة أوايسس", "أرسلنا رابط تفعيل لبريدك الإلكتروني، يرجى تفعيله.");
        } catch (err) { Alert.alert("خطأ", err.message); }
      } else { Alert.alert("خطأ", error.message); }
    }
    setAuthLoading(false);
  };

  // --- تشغيل الرسالة الصوتية عند الضغط عليها ---
  async function playVoiceMessage(url) {
    try {
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${SERVER_URL}/${url}` });
      setSound(newSound);
      await newSound.playAsync();
    } catch (e) { Alert.alert("خطأ", "لا يمكن تشغيل الصوت حالياً"); }
  }

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("فشل بدء التسجيل", err.message); }
  }

  async function stopRecording() {
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(undefined);

      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: `voice_${Date.now()}.m4a` });
      formData.append('user', user.email);

      const response = await fetch(`${SERVER_URL}/api/upload-audio`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = await response.json();
      if (result.status === 'success') {
        await addDoc(collection(db, "messages"), {
          audioUrl: result.url,
          senderId: user.uid,
          type: 'audio',
          timestamp: serverTimestamp(),
        });
      }
    } catch (err) { Alert.alert("عذراً", "فشل إرسال الصوت، تأكد من اتصال الخادم"); }
  }

  const sendMessage = async () => {
    if (message.trim().length > 0) {
      await addDoc(collection(db, "messages"), {
        text: message,
        senderId: user.uid,
        type: 'text',
        timestamp: serverTimestamp(),
      });
      setMessage('');
    }
  };

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <Ionicons name="leaf" size={70} color="#25D366" />
          <Text style={styles.authTitle}>واحة أوايسس</Text>
          {!isWaitingVerify ? (
            <>
              <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholderTextColor="#8596a0" />
              <TextInput style={styles.input} placeholder="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#8596a0" />
              <TouchableOpacity style={styles.mainBtn} onPress={handleAuth}>
                {authLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>دخول / تسجيل</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{alignItems: 'center'}}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.waitingText}>يرجى تفعيل بريدك الإلكتروني ثم المحاولة مجدداً</Text>
              <TouchableOpacity onPress={() => auth.signOut()}><Text style={{color: '#25D366', marginTop: 20}}>الرجوع</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
            <View style={styles.avatar}><Text style={{color:'white'}}>O</Text></View>
            <View style={{marginLeft: 10, alignItems: 'flex-start'}}>
                <Text style={styles.userName}>غرفة واحة العامة</Text>
                <Text style={styles.userStatus}>متصل الآن</Text>
            </View>
        </View>
        <View style={styles.headerIcons}>
          <ZegoSendCallInvitationButton invitees={[{ userID: 'global', userName: 'Oasis' }]} isVideoCall={true} resourceID={"oasis_video"} backgroundColor="#1f2c34" iconWidth={30} iconHeight={30} />
          <ZegoSendCallInvitationButton invitees={[{ userID: 'global', userName: 'Oasis' }]} isVideoCall={false} resourceID={"oasis_voice"} backgroundColor="#1f2c34" iconWidth={30} iconHeight={30} />
        </View>
      </View>

      <FlatList 
        data={chatMessages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
            {item.type === 'audio' ? (
              <TouchableOpacity onPress={() => playVoiceMessage(item.audioUrl)} style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="play-circle" size={30} color="white" />
                <Text style={styles.messageText}> رسالة صوتية</Text>
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
  waitingText: { color: 'white', marginTop: 20, textAlign: 'center' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  userStatus: { color: '#25D366', fontSize: 12 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  bubble: { padding: 10, borderRadius: 15, marginHorizontal: 15, marginVertical: 5, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50 },
  textInput: { flex: 1, color: 'white', textAlign: 'right' },
  sendBtn: { width: 50, height: 50, backgroundColor: '#25D366', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
