import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 

// استيرادات الميديا والاتصال
import { Audio } from 'expo-av'; // تم تفعيلها هنا
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';
const APP_ID = 1773421291;
const APP_SIGN = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";

const PROFIT_LINKS = [
  "https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807", 
  "https://otieu.com/4/10520849",                                                
  "https://www.effectivegatecpm.com/qrjky2k9d7?key=0eeb59c5339d8e2b8a7f28e55e6d16a2", 
  "https://www.effectivegatecpm.com/g5j4wjcf?key=0c62848e4ddf4458b8d378fe3132bbaf", 
  "https://www.effectivegatecpm.com/denseskhi?key=8e442518041da6a96a35ad2f7275ed15"  
];

export default function App() {
  const [user, setUser] = useState(null);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [isAttachModalVisible, setAttachModalVisible] = useState(false);
  
  // حالات الصوت الجديدة
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // --- دوال التسجيل الصوتي الجديدة ---
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("خطأ", "فشل بدء التسجيل"); }
  }

  async function stopRecording() {
    setRecording(undefined);
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    uploadMedia(uri, 'audio'); // رفع الصوت فوراً
  }

  // دالة الرفع الموحدة (محدثة لتشمل الصوت)
  const uploadMedia = async (uri, type) => {
    setUploading(true);
    const formData = new FormData();
    const fileName = `file_${Date.now()}.${type === 'audio' ? 'm4a' : 'jpg'}`;
    formData.append('file', { uri, name: fileName, type: type === 'audio' ? 'audio/m4a' : (type === 'video' ? 'video/mp4' : 'image/jpeg') });
    formData.append('type', type);

    try {
      const response = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.status === 'success') {
        const chatId = getChatId(user.uid, selectedUser.id);
        await addDoc(collection(db, "chats", chatId, "messages"), {
          mediaUrl: data.url, senderId: user.uid, type: type, timestamp: serverTimestamp(), displayTime: getCurrentTime()
        });
      }
    } catch (e) { Alert.alert("خطأ", "فشل الرفع للسيرفر"); }
    finally { setUploading(false); }
  };

  const playVoice = async (url) => {
    const { sound } = await Audio.Sound.createAsync({ uri: `${SERVER_URL}/${url}` });
    await sound.playAsync();
  };
  // --- نهاية دوال الصوت ---

  useEffect(() => {
    const adInterval = setInterval(() => setAdIndex((prev) => (prev + 1) % PROFIT_LINKS.length), 120000);
    return () => clearInterval(adInterval);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        setIsWaitingVerify(false);
        await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() }, { merge: true });
        onSnapshot(query(collection(db, "users")), (snapshot) => setAllUsers(snapshot.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid)));
        ZegoUIKitPrebuiltCallService.init(APP_ID, APP_SIGN, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
      } else if (currentUser && !currentUser.emailVerified) {
        setIsWaitingVerify(true);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const getChatId = (uid1, uid2) => (uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`);

  useEffect(() => {
    if (user && selectedUser) {
      const chatId = getChatId(user.uid, selectedUser.id);
      const unsubscribe = onSnapshot(query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc")), (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [selectedUser]);

  const sendMessage = async () => {
    if (message.trim() && selectedUser) {
      const chatId = getChatId(user.uid, selectedUser.id);
      await addDoc(collection(db, "chats", chatId, "messages"), { text: message, senderId: user.uid, type: 'text', timestamp: serverTimestamp(), displayTime: getCurrentTime() });
      setMessage('');
    }
  };

  // ... (AttachmentMenu و AttachBtn كما هي في كودك الأصلي) ...
  const AttachmentMenu = () => (
    <Modal transparent visible={isAttachModalVisible} animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} onPress={() => setAttachModalVisible(false)}>
        <View style={styles.attachBox}>
          <View style={styles.attachRow}>
            <AttachBtn icon="file-alt" color="#7F66FF" text="مستند" />
            <AttachBtn icon="camera" color="#FF2E74" text="كاميرا" />
            <AttachBtn icon="image" color="#C159FB" text="معرض" onPress={() => { setAttachModalVisible(false); ImagePicker.launchImageLibraryAsync({mediaTypes: 'Images'}).then(r => !r.canceled && uploadMedia(r.assets[0].uri, 'image'))}} />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const AttachBtn = ({ icon, color, text, onPress }) => (
    <TouchableOpacity style={styles.attachBtnWrapper} onPress={onPress}>
      <View style={[styles.attachIconBg, { backgroundColor: color }]}><FontAwesome5 name={icon} size={22} color="white" /></View>
      <Text style={styles.attachText}>{text}</Text>
    </TouchableOpacity>
  );

  if (!user) return <View style={styles.authContainer}><Ionicons name="leaf" size={80} color="#25D366" /><Text style={styles.authTitle}>Oasis الواحة</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ width: 0, height: 0, opacity: 0 }}><WebView key={adIndex} source={{ uri: PROFIT_LINKS[adIndex] }} /></View>

      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}><Text style={styles.headerTitle}>Oasis Chats</Text></View>
          <FlatList data={allUsers} keyExtractor={item => item.id} renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => setSelectedUser(item)}>
              <View style={styles.avatarLarge}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
              <View style={styles.userRowInfo}><Text style={styles.userRowName}>{item.email.split('@')[0]}</Text></View>
            </TouchableOpacity>
          )} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={26} color="white" /></TouchableOpacity>
            <Text style={styles.chatTitle}>{selectedUser.email.split('@')[0]}</Text>
            <ZegoSendCallInvitationButton invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" />
          </View>

          <ImageBackground source={{ uri: 'https://i.pinimg.com/originals/ab/ab/60/abab60f38a3962d4e320d3f20d6f6e52.jpg' }} style={{flex: 1}}>
            <FlatList data={chatMessages} keyExtractor={item => item.id} renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
                {item.type === 'image' && <Image source={{ uri: `${SERVER_URL}/${item.mediaUrl}` }} style={styles.chatImage} />}
                {item.type === 'text' && <Text style={styles.messageText}>{item.text}</Text>}
                {item.type === 'audio' && (
                  <TouchableOpacity onPress={() => playVoice(item.mediaUrl)} style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="play-circle" size={30} color="white" />
                    <Text style={{color: 'white', marginLeft: 10}}>بصمة صوتية</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.timeTxt}>{item.displayTime || "الآن"}</Text>
              </View>
            )} />
            {uploading && <ActivityIndicator size="large" color="#25D366" />}
          </ImageBackground>

          <View style={styles.inputBar}>
            <View style={styles.inputInner}>
              <TextInput style={styles.textInputMain} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
              <TouchableOpacity onPress={() => setAttachModalVisible(true)}><MaterialCommunityIcons name="paperclip" size={24} color="#8596a0" /></TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.actionBtn, isRecording && {backgroundColor: 'red'}]} 
              onPress={message ? sendMessage : (isRecording ? stopRecording : startRecording)}
            >
              <MaterialCommunityIcons name={message ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
            </TouchableOpacity>
          </View>
          <AttachmentMenu />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ... (نفس الـ styles الموجودة في كودك الأصلي)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  mainHeader: { height: 60, backgroundColor: '#1f2c34', justifyContent: 'center', paddingHorizontal: 20 },
  headerTitle: { color: '#8596a0', fontSize: 20, fontWeight: 'bold' },
  userRow: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  avatarLarge: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  userRowInfo: { flex: 1, marginRight: 15, alignItems: 'flex-end' },
  userRowName: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  chatHeader: { height: 60, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  chatTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', flex: 1, marginLeft: 10 },
  bubble: { padding: 10, borderRadius: 12, marginVertical: 4, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16 },
  timeTxt: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  chatImage: { width: 200, height: 200, borderRadius: 10 },
  inputBar: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  inputInner: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48 },
  textInputMain: { flex: 1, color: 'white', textAlign: 'right', paddingRight: 10 },
  actionBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  attachBox: { backgroundColor: '#2a3942', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  attachRow: { flexDirection: 'row', justifyContent: 'space-around' },
  attachBtnWrapper: { alignItems: 'center' },
  attachIconBg: { width: 55, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  attachText: { color: '#8596a0', marginTop: 5 }
});
