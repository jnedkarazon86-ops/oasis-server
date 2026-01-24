import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// --- (نفس الاستيرادات والمحركات السابقة) ---
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { Audio } from 'expo-av';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  const auth = getAuth();
  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";

  // --- (منطق المراقبة والربط - لم يتغير لضمان القوة) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        ZegoUIKitPrebuiltCallService.init(appID, appSign, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
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

  // --- الواجهة الجديدة (هنا التجميل) ---
  if (!user) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <Ionicons name="leaf" size={70} color="#25D366" />
          <Text style={styles.authTitle}>واحة أوايسس</Text>
          <Text style={styles.authSubtitle}>تواصل بخصوصية وأمان تام</Text>
          
          {!isWaitingVerify ? (
            <>
              <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholderTextColor="#8596a0" autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="كلمة السر" value={password} onChangeText={setPassword} placeholderTextColor="#8596a0" secureTextEntry />
              <TouchableOpacity style={styles.mainBtn} onPress={() => {/* كود التسجيل السابق */}}>
                {authLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>ابدأ الآن</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.waitingText}>رابط التفعيل في الطريق إلى بريدك..</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header احترافي */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
            <View style={styles.avatar}><Text style={{color:'white'}}>O</Text></View>
            <View style={{marginLeft: 10}}>
                <Text style={styles.userName}>غرفة المحادثة العامة</Text>
                <Text style={styles.userStatus}>متصل الآن</Text>
            </View>
        </View>
        <View style={styles.headerIcons}>
          <ZegoSendCallInvitationButton invitees={[{ userID: 'test_1', userName: 'صديق' }]} isVideoCall={true} resourceID={"oasis_video"} backgroundColor="#1f2c34" iconWidth={40} iconHeight={40} />
          <ZegoSendCallInvitationButton invitees={[{ userID: 'test_1', userName: 'صديق' }]} isVideoCall={false} resourceID={"oasis_voice"} backgroundColor="#1f2c34" iconWidth={40} iconHeight={40} />
        </View>
      </View>

      <FlatList 
        data={chatMessages}
        contentContainerStyle={{paddingVertical: 10}}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.timeText}>10:00 PM</Text>
          </View>
        )}
      />

      {/* شريط الإدخال الجديد */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity><Ionicons name="happy-outline" size={24} color="#8596a0" /></TouchableOpacity>
          <TextInput style={styles.textInput} placeholder="مراسلة..." value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" multiline />
          <TouchableOpacity><Ionicons name="attach" size={24} color="#8596a0" style={{transform: [{rotate: '45deg'}]}} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.sendBtn, isRecording && {backgroundColor: '#ff3b30'}]}>
          <MaterialCommunityIcons name={message ? "send" : "microphone"} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authCard: { backgroundColor: '#1f2c34', width: '100%', borderRadius: 25, padding: 30, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  authTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', marginTop: 15 },
  authSubtitle: { color: '#8596a0', fontSize: 14, marginBottom: 30 },
  input: { backgroundColor: '#2a3942', color: 'white', width: '100%', borderRadius: 12, padding: 15, marginBottom: 15, textAlign: 'right' },
  mainBtn: { backgroundColor: '#25D366', width: '100%', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  header: { height: 110, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15, paddingBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  userStatus: { color: '#25D366', fontSize: 12 },
  headerIcons: { flexDirection: 'row' },
  bubble: { padding: 10, borderRadius: 15, marginHorizontal: 15, marginVertical: 5, maxWidth: '80%', elevation: 1 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', borderBottomRightRadius: 2 },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', borderBottomLeftRadius: 2 },
  messageText: { color: 'white', fontSize: 16 },
  timeText: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 5 },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: 'transparent' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50 },
  textInput: { flex: 1, color: 'white', marginHorizontal: 10, textAlign: 'right' },
  sendBtn: { width: 50, height: 50, backgroundColor: '#25D366', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
