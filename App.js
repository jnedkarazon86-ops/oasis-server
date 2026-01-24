import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// المحركات
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Audio } from 'expo-av';

export default function App() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);

  // 🔑 مفاتيحك (تأكد من مطابقتها لحساباتك)
  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";
  const CLOUD_NAME = "dvcnccegi"; 
  const UPLOAD_PRESET = "صوت أوايسس"; 

  const userID = "oasis_user_123"; 
  const userName = "مستخدم_أوايسس";

  useEffect(() => {
    ZegoUIKitPrebuiltCallService.init(appID, appSign, userID, userName, [ZegoUIKitSignalingPlugin]);

    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  // --- وظيفة تشغيل الصوت المستلم ---
  const playSound = async (url) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      await sound.playAsync();
    } catch (error) {
      Alert.alert("خطأ", "عذراً، تعذر تشغيل الصوت");
    }
  };

  // --- إرسال نص ---
  const sendMessage = async () => {
    if (message.trim().length > 0) {
      const txt = message.trim();
      setMessage('');
      await addDoc(collection(db, "messages"), { text: txt, senderId: userID, timestamp: serverTimestamp(), type: 'text' });
    }
  };

  // --- محرك الميكروفون (تسجيل + رفع) ---
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("خطأ", "الميكروفون غير مفعل"); }
  }

  async function stopRecording() {
    setIsRecording(false);
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    
    // الرفع لـ Cloudinary
    let formData = new FormData();
    formData.append('file', { uri, type: 'audio/m4a', name: `voice_${Date.now()}.m4a` });
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
      let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
      let data = await res.json();
      if (data.secure_url) {
        await addDoc(collection(db, "messages"), { audioUrl: data.secure_url, senderId: userID, timestamp: serverTimestamp(), type: 'audio' });
      }
    } catch (e) { Alert.alert("خطأ", "فشل رفع البصمة"); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <View style={styles.avatar} />
          <Text style={styles.userName}>صديقي</Text>
        </View>
        <View style={styles.headerIcons}>
          <ZegoSendCallInvitationButton invitees={[{ userID: 'friend_1', userName: 'صديقي' }]} isVideoCall={true} resourceID={"oasis_video"} />
          <ZegoSendCallInvitationButton invitees={[{ userID: 'friend_1', userName: 'صديقي' }]} isVideoCall={false} resourceID={"oasis_voice"} />
        </View>
      </View>

      <FlatList 
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === userID ? styles.myBubble : styles.otherBubble]}>
            {item.type === 'audio' ? (
              <TouchableOpacity style={styles.audioRow} onPress={() => playSound(item.audioUrl)}>
                <Ionicons name="play-circle" size={35} color="white" />
                <View style={{marginLeft: 8}}>
                  <Text style={styles.messageText}>بصمة صوتية</Text>
                  <Text style={{color: '#8596a0', fontSize: 10}}>إضغط للاستماع</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
          </View>
        )}
        contentContainerStyle={{ padding: 15 }}
      />

      <View style={styles.bottomBar}>
        <View style={styles.inputWrapper}>
          <TextInput style={styles.input} placeholder="الرسالة" placeholderTextColor="#8596a0" value={message} onChangeText={setMessage} />
        </View>
        <TouchableOpacity 
          onLongPress={!message ? startRecording : null} 
          onPressOut={!message && isRecording ? stopRecording : null}
          onPress={message ? sendMessage : null}
          style={[styles.actionBtn, isRecording && {backgroundColor: '#ff4444'}]}
        >
          <MaterialCommunityIcons name={message ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3d4b55', marginRight: 10 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  bubble: { padding: 10, borderRadius: 15, marginBottom: 10, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16 },
  audioRow: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  bottomBar: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, height: 48, justifyContent: 'center', paddingHorizontal: 15 },
  input: { color: 'white', textAlign: 'right' },
  actionBtn: { width: 48, height: 48, backgroundColor: '#25D366', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
});
