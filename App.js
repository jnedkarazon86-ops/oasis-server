import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 
import { Audio, Video } from 'expo-av'; 
import * as ImagePicker from 'expo-image-picker';

// استيرادات الخدمات
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

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
  const [activeTab, setActiveTab] = useState('chats'); 
  const [allUsers, setAllUsers] = useState([]);
  const [statuses, setStatuses] = useState([]); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const getCurrentTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  // نظام تدوير الإعلانات (تبديل كل 60 ثانية لضمان دورة 5 دقائق كاملة)
  useEffect(() => {
    const adTimer = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % PROFIT_LINKS.length);
    }, 60000); // 60 ثانية
    return () => clearInterval(adTimer);
  }, []);

  // مراقبة حالة المصادقة والبيانات
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() }, { merge: true });
        
        onSnapshot(query(collection(db, "users")), (s) => setAllUsers(s.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid)));
        onSnapshot(query(collection(db, "statuses"), orderBy("timestamp", "desc")), (s) => setStatuses(s.docs.map(d => d.data())));

        ZegoUIKitPrebuiltCallService.init(APP_ID, APP_SIGN, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
      } else { setUser(null); }
    });
    return () => unsubscribeAuth();
  }, []);

  // منطق شريط التقدم للحالة
  useEffect(() => {
    let interval;
    if (viewingStatus) {
      setProgress(0);
      const duration = viewingStatus.type === 'video' ? 30000 : 5000; 
      const step = 100 / (duration / 100);

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setViewingStatus(null);
            return 0;
          }
          return prev + step;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [viewingStatus]);

  // رفع الميديا (صور/فيديو/صوت)
  const uploadMedia = async (uri, type, isStatus = false) => {
    setUploading(true);
    const formData = new FormData();
    const ext = type === 'video' ? 'mp4' : (type === 'audio' ? 'm4a' : 'jpg');
    formData.append('file', { uri, name: `file_${Date.now()}.${ext}`, type: type === 'video' ? 'video/mp4' : (type === 'audio' ? 'audio/m4a' : 'image/jpeg') });
    formData.append('type', type);

    try {
      const res = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        if (isStatus) {
          await addDoc(collection(db, "statuses"), { userId: user.uid, userName: user.email.split('@')[0], imageUrl: data.url, type: type, timestamp: serverTimestamp() });
          Alert.alert("نجاح", "تم نشر الحالة");
        } else {
          const chatId = (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
          await addDoc(collection(db, "chats", chatId, "messages"), { mediaUrl: data.url, senderId: user.uid, type, timestamp: serverTimestamp(), displayTime: getCurrentTime() });
        }
      }
    } catch (e) { Alert.alert("خطأ", "فشل الرفع للسيرفر"); }
    finally { setUploading(false); }
  };

  const openCameraForStatus = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return Alert.alert("خطأ", "نحتاج إذن الكاميرا");
    let result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: true, quality: 0.5, videoMaxDuration: 30 });
    if (!result.canceled) {
      const type = result.assets[0].type === 'video' ? 'video' : 'image';
      uploadMedia(result.assets[0].uri, type, true);
    }
  };

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (e) { Alert.alert("خطأ", "تعذر التسجيل"); }
  }

  async function stopRecording() {
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    uploadMedia(recording.getURI(), 'audio');
  }

  const sendMessage = async () => {
    if (message.trim() && selectedUser) {
      const chatId = (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
      await addDoc(collection(db, "chats", chatId, "messages"), { text: message, senderId: user.uid, type: 'text', timestamp: serverTimestamp(), displayTime: getCurrentTime() });
      setMessage('');
    }
  };

  if (!user) return <View style={styles.authContainer}><Ionicons name="leaf" size={80} color="#25D366" /><Text style={styles.authTitle}>Oasis</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* محرك الإعلانات المخفي المطور */}
      <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
        <WebView 
          key={adIndex} 
          source={{ uri: PROFIT_LINKS[adIndex] }} 
          incognito={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
        />
      </View>

      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}><Text style={styles.headerTitle}>Oasis</Text></View>

          {activeTab === 'chats' && (
            <FlatList data={allUsers} keyExtractor={item => item.id} renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => setSelectedUser(item)}>
                <View style={styles.avatarLarge}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                <View style={styles.userRowInfo}><Text style={styles.userRowName}>{item.email.split('@')[0]}</Text></View>
              </TouchableOpacity>
            )} />
          )}

          {activeTab === 'updates' && (
            <View style={{ flex: 1 }}>
              <ScrollView>
                <Text style={styles.sectionTitle}>الحالة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingHorizontal: 15}}>
                  <TouchableOpacity style={styles.statusCard} onPress={openCameraForStatus}>
                    <View style={styles.myStatusCircle}><Ionicons name="add" size={24} color="white" /></View>
                    <Text style={styles.statusName}>إضافة حالة</Text>
                  </TouchableOpacity>
                  {statuses.map((st, i) => (
                    <TouchableOpacity key={i} style={styles.statusCard} onPress={() => setViewingStatus(st)}>
                      <Image source={{ uri: `${SERVER_URL}/${st.imageUrl}` }} style={styles.friendStatusImg} />
                      <Text style={styles.statusName}>{st.userName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.sectionTitle}>القنوات</Text>
              </ScrollView>
              <View style={styles.floatingContainer}>
                <TouchableOpacity style={styles.fabSmall} onPress={() => Alert.alert("واحة", "قريباً")}><MaterialCommunityIcons name="pencil" size={22} color="white" /></TouchableOpacity>
                <TouchableOpacity style={styles.fabLarge} onPress={openCameraForStatus}><Ionicons name="camera" size={28} color="black" /></TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('chats')}><Ionicons name="chatbubbles" size={24} color={activeTab === 'chats' ? '#25D366' : '#8596a0'} /><Text style={{color: activeTab === 'chats' ? '#25D366' : '#8596a0', fontSize: 12}}>الدردشات</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('updates')}><MaterialCommunityIcons name="circle-slice-8" size={24} color={activeTab === 'updates' ? '#25D366' : '#8596a0'} /><Text style={{color: activeTab === 'updates' ? '#25D366' : '#8596a0', fontSize: 12}}>التحديثات</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('calls')}><Ionicons name="call" size={24} color={activeTab === 'calls' ? '#25D366' : '#8596a0'} /><Text style={{color: activeTab === 'calls' ? '#25D366' : '#8596a0', fontSize: 12}}>المكالمات</Text></TouchableOpacity>
          </View>
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
                {item.type === 'audio' && <TouchableOpacity onPress={async () => { const { sound } = await Audio.Sound.createAsync({ uri: `${SERVER_URL}/${item.mediaUrl}` }); await sound.playAsync(); }} style={{flexDirection: 'row', alignItems: 'center'}}><Ionicons name="play" size={24} color="white" /><Text style={{color: 'white', marginLeft: 10}}>بصمة صوتية</Text></TouchableOpacity>}
                <Text style={styles.timeTxt}>{item.displayTime || "الآن"}</Text>
              </View>
            )} />
          </ImageBackground>
          <View style={styles.inputBar}>
             <TextInput style={styles.textInputMain} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
             <TouchableOpacity style={[styles.actionBtn, isRecording && {backgroundColor: 'red'}]} onPress={message ? sendMessage : (isRecording ? stopRecording : startRecording)}>
                <MaterialCommunityIcons name={message ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
             </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!viewingStatus} transparent animationType="fade">
        <View style={styles.fullStatusBg}>
          <View style={styles.progressBarContainer}><View style={[styles.progressBarFill, { width: `${progress}%` }]} /></View>
          <TouchableOpacity style={{ flex: 1, justifyContent: 'center' }} activeOpacity={1} onPress={() => setViewingStatus(null)}>
            {viewingStatus && (viewingStatus.type === 'video' ? <Video source={{ uri: `${SERVER_URL}/${viewingStatus.imageUrl}` }} rate={1.0} volume={1.0} isMuted={false} resizeMode="contain" shouldPlay isLooping style={{ width: '100%', height: '80%' }} /> : <Image source={{ uri: `${SERVER_URL}/${viewingStatus.imageUrl}` }} style={styles.fullStatusImg} />)}
            {viewingStatus && <View style={styles.statusFooter}><Text style={styles.statusFooterName}>{viewingStatus.userName}</Text><Text style={styles.statusFooterTime}>منذ قليل</Text></View>}
          </TouchableOpacity>
        </View>
      </Modal>

      {uploading && <View style={styles.loader}><ActivityIndicator size="large" color="#25D366" /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  mainHeader: { height: 60, backgroundColor: '#1f2c34', justifyContent: 'center', paddingHorizontal: 20 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row-reverse', height: 70, backgroundColor: '#0b141a', borderTopWidth: 0.5, borderTopColor: '#1f2c34', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', margin: 15, textAlign: 'right' },
  statusCard: { alignItems: 'center', marginRight: 15 },
  myStatusCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1f2c34', borderStyle: 'dashed', borderWidth: 1, borderColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  friendStatusImg: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#25D366' },
  statusName: { color: 'white', fontSize: 12, marginTop: 5 },
  floatingContainer: { position: 'absolute', bottom: 90, left: 20, alignItems: 'center' },
  fabLarge: { width: 55, height: 55, borderRadius: 16, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  fabSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1f2c34', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
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
  timeTxt: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end' },
  chatImage: { width: 200, height: 200, borderRadius: 10 },
  inputBar: { flexDirection: 'row', padding: 8, alignItems: 'center', backgroundColor: '#0b141a' },
  textInputMain: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, color: 'white', paddingHorizontal: 15, height: 45, textAlign: 'right' },
  actionBtn: { width: 45, height: 45, backgroundColor: '#00a884', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  fullStatusBg: { flex: 1, backgroundColor: 'black' },
  progressBarContainer: { position: 'absolute', top: 50, left: 10, right: 10, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, zIndex: 20 },
  progressBarFill: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  fullStatusImg: { width: '100%', height: '80%', resizeMode: 'contain' },
  statusFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  statusFooterName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statusFooterTime: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center' },
  authTitle: { color: 'white', fontSize: 28, marginTop: 10 }
});
