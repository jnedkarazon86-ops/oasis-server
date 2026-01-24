import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// 1. استيرادات المحركات (Zego + Firebase + Audio)
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Audio } from 'expo-av'; // مكتبة الصوت

export default function App() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);

  // 🔑 مفاتيحك الخاصة (ZegoCloud)
  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";
  
  // ☁️ مفاتيح Cloudinary الخاصة بك
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

  // ✉️ إرسال النص
  const sendMessage = async () => {
    if (message.trim().length > 0) {
      const textToSend = message.trim();
      setMessage('');
      try {
        await addDoc(collection(db, "messages"), {
          text: textToSend,
          senderId: userID,
          senderName: userName,
          timestamp: serverTimestamp(),
          type: 'text'
        });
      } catch (error) { Alert.alert("خطأ", "فشل الاتصال بـ Firebase"); }
    }
  };

  // 🎙️ وظائف التسجيل والرفع لـ Cloudinary
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("خطأ", "تأكد من إذن الميكروفون"); }
  }

  async function stopRecording() {
    setIsRecording(false);
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    uploadAudioToCloudinary(uri);
  }

  const uploadAudioToCloudinary = async (fileUri) => {
    try {
      let formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'audio/m4a',
        name: `voice_${Date.now()}.m4a`,
      });
      formData.append('upload_preset', UPLOAD_PRESET);

      let response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData,
      });

      let data = await response.json();
      
      if (data.secure_url) {
        await addDoc(collection(db, "messages"), {
          audioUrl: data.secure_url,
          senderId: userID,
          senderName: userName,
          timestamp: serverTimestamp(),
          type: 'audio'
        });
      }
    } catch (e) { Alert.alert("خطأ", "فشل رفع الصوت لـ Cloudinary"); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <TouchableOpacity><Ionicons name="arrow-forward" size={24} color="white" /></TouchableOpacity>
          <View style={styles.avatar} />
          <View><Text style={styles.userName}>صديقي</Text><Text style={styles.status}>متصل الآن</Text></View>
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
              <View style={styles.audioRow}>
                <Ionicons name="mic" size={20} color="white" />
                <Text style={styles.messageText}> بصمة صوتية</Text>
              </View>
            ) : (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
            <Text style={styles.timeText}>
              {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.chatList}
      />

      <View style={styles.bottomBar}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity><Ionicons name="happy-outline" size={24} color="#8596a0" /></TouchableOpacity>
          <TextInput style={styles.input} placeholder="الرسالة" placeholderTextColor="#8596a0" value={message} onChangeText={setMessage} multiline />
          <TouchableOpacity><Ionicons name="attach" size={24} color="#8596a0" style={{transform: [{rotate: '45deg'}]}} /></TouchableOpacity>
        </View>
        
        {/* الزر الذكي: ضغطة واحدة للإرسال، ضغطة مطولة للتسجيل */}
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3d4b55', marginHorizontal: 10 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  status: { color: '#8596a0', fontSize: 12 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  chatList: { padding: 15 },
  bubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', borderTopRightRadius: 2 },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', borderTopLeftRadius: 2 },
  messageText: { color: 'white', fontSize: 16 },
  audioRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  bottomBar: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#1f2c34', borderRadius: 25, alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, color: 'white', fontSize: 17, paddingHorizontal: 10, textAlign: 'right' },
  actionBtn: { width: 48, height: 48, backgroundColor: '#25D366', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
});
