import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 
import { Audio } from 'expo-av'; 
import * as ImagePicker from 'expo-image-picker';

// استيرادات الخدمات البرمجية
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc, where, getDocs } from 'firebase/firestore';
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
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');

  // حالات نافذة المعاينة السريعة
  const [previewUser, setPreviewUser] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // حالات الفويس
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const timerRef = useRef(null);

  const getCurrentTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const changeProfilePicture = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("خطأ", "يجب السماح بالوصول للمعرض لتغيير صورتك");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setUploading(true);
      const uri = result.assets[0].uri;
      const formData = new FormData();
      const fileName = `profile_${user.uid}.jpg`;
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: 'image/jpeg',
      });

      try {
        const response = await fetch(`${SERVER_URL}/api/upload-media`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.status === 'success') {
          await setDoc(doc(db, "users", user.uid), { profilePic: data.url }, { merge: true });
          Alert.alert("نجاح", "تم تحديث صورتك الشخصية!");
        }
      } catch (error) {
        Alert.alert("خطأ", "فشل رفع الصورة للسيرفر");
      } finally {
        setUploading(false);
      }
    }
  };

  useEffect(() => {
    const adTimer = setInterval(() => setAdIndex((prev) => (prev + 1) % PROFIT_LINKS.length), 60000); 
    return () => clearInterval(adTimer);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() }, { merge: true });
        
        onSnapshot(query(collection(db, "users")), (s) => {
          const users = s.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid);
          setAllUsers(users); setFilteredUsers(users);
        });

        // --- الإضافة المطلوبة لربط المكالمات بنظام الهاتف (Offline Call Support) ---
        ZegoUIKitPrebuiltCallService.useSystemCallingUI([ZegoUIKitSignalingPlugin]);
        
        ZegoUIKitPrebuiltCallService.init(
            APP_ID, 
            APP_SIGN, 
            currentUser.uid, 
            currentUser.email.split('@')[0], 
            [ZegoUIKitSignalingPlugin]
        );
      } else { setUser(null); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (selectedUser && user) {
      const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
      const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
      return onSnapshot(query(collection(db, collPath), orderBy("timestamp", "asc")), (snapshot) => setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }
  }, [selectedUser]);

  const addNewContact = async () => {
    if (!newContactEmail.trim()) return;
    const q = query(collection(db, "users"), where("email", "==", newContactEmail.trim().toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      Alert.alert("غير موجود", "هذا المستخدم غير مسجل في واحة Oasis");
    } else {
      const foundUser = querySnapshot.docs[0].data();
      setSelectedUser(foundUser);
      setShowAddModal(false);
      setNewContactEmail('');
    }
  };

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      setRecordTime(0);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err) { Alert.alert('خطأ', 'فشل بدء التسجيل'); }
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecording(null);
    await recording.stopAndUnloadAsync();
    uploadMedia(recording.getURI(), 'audio');
  }

  const uploadMedia = async (uri, type) => {
    const formData = new FormData();
    const fileName = `oasis_${Date.now()}.${type === 'audio' ? 'm4a' : 'jpg'}`;
    formData.append('file', { uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), name: fileName, type: type === 'audio' ? 'audio/m4a' : 'image/jpeg' });
    try {
      const res = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') sendMessage(data.url, type);
    } catch (e) { Alert.alert("خطأ", "فشل الرفع للسيرفر"); }
  };

  const sendMessage = async (content = message, type = 'text') => {
    if ((type === 'text' && !content.trim()) || !selectedUser) return;
    const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
    const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    await addDoc(collection(db, collPath), { text: content, senderId: user.uid, senderName: user.email.split('@')[0], type, timestamp: serverTimestamp(), displayTime: getCurrentTime() });
    setMessage('');
  };

  const AudioBubble = ({ uri }) => {
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    async function togglePlay() {
      if (sound) {
        isPlaying ? await sound.pauseAsync() : await sound.playAsync();
        setIsPlaying(!isPlaying);
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        setSound(newSound); setIsPlaying(true); await newSound.playAsync();
        newSound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) setIsPlaying(false); });
      }
    }
    return (
      <TouchableOpacity onPress={togglePlay} style={{flexDirection: 'row', alignItems: 'center', width: 160}}>
        <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={32} color="white" />
        <View style={{flex:1, height: 3, backgroundColor: '#8596a0', marginLeft: 10}} />
      </TouchableOpacity>
    );
  };

  if (!user) return <View style={styles.authContainer}><Ionicons name="leaf" size={80} color="#25D366" /><Text style={styles.authTitle}>Oasis</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
        <WebView key={adIndex} source={{ uri: PROFIT_LINKS[adIndex] }} incognito={true} />
      </View>

      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}>
            <Text style={styles.headerTitle}>Oasis</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={changeProfilePicture} style={{marginRight: 15}}>
                {uploading ? <ActivityIndicator color="#00a884" size="small" /> : <Ionicons name="settings-outline" size={24} color="white" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddModal(true)} style={{marginRight: 15}}><Ionicons name="person-add-outline" size={24} color="white" /></TouchableOpacity>
              <Ionicons name="camera-outline" size={26} color="white" />
            </View>
          </View>
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <TextInput placeholder="بحث في الدردشات..." placeholderTextColor="#8596a0" style={styles.searchTxt} value={searchText} onChangeText={(t) => {
                setSearchText(t);
                setFilteredUsers(allUsers.filter(u => u.email.toLowerCase().includes(t.toLowerCase())));
              }} />
            </View>
          </View>
          <FlatList data={filteredUsers} renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatRow} onPress={() => setSelectedUser(item)}>
              <TouchableOpacity onPress={() => { setPreviewUser(item); setShowPreview(true); }}>
                <View style={styles.chatAvatar}>
                  {item.profilePic ? <Image source={{ uri: item.profilePic }} style={styles.fullImg} /> : <Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text>}
                </View>
              </TouchableOpacity>
              <View style={styles.chatInfo}><Text style={styles.chatName}>{item.email.split('@')[0]}</Text><Text style={styles.lastMsg}>انقر للمراسلة...</Text></View>
            </TouchableOpacity>
          )} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.whatsappHeader}>
            <View style={styles.callButtonsContainer}>
              <ZegoSendCallInvitationButton invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" width={30} height={30} />
              <ZegoSendCallInvitationButton invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} isVideoCall={false} resourceID={"zegouikit_call"} backgroundColor="transparent" width={30} height={30} />
            </View>
            <TouchableOpacity style={styles.headerInfoSection}>
               <View style={styles.headerTextContainer}>
                 <Text style={styles.chatTitleText}>{selectedUser.email.split('@')[0]}</Text>
                 <Text style={styles.onlineStatusText}>متصل الآن</Text>
               </View>
               <View style={styles.headerAvatarSmall}>
                 {selectedUser.profilePic ? <Image source={{ uri: selectedUser.profilePic }} style={styles.fullImg} /> : <Text style={styles.avatarLetterSmall}>{selectedUser.email[0].toUpperCase()}</Text>}
               </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedUser(null)} style={{marginLeft: 5}}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          </View>

          <ImageBackground source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={{flex: 1}}>
            <FlatList data={chatMessages} renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderId === user.uid ? styles.whatsappMyBubble : styles.whatsappOtherBubble]}>
                {item.type === 'audio' ? <AudioBubble uri={item.text} /> : <Text style={styles.messageText}>{item.text}</Text>}
                <Text style={styles.whatsappMiniTime}>{item.displayTime}</Text>
              </View>
            )} />
          </ImageBackground>

          <View style={styles.whatsappInputBar}>
            <View style={[styles.inputMainCard, isRecording && {backgroundColor: '#233138'}]}>
              {isRecording ? (
                <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                  <MaterialCommunityIcons name="microphone" size={20} color="#ff5252" />
                  <Text style={{color: '#ff5252', marginLeft: 8, fontWeight: 'bold'}}>{formatTime(recordTime)}</Text>
                  <Text style={{color: '#8596a0', marginLeft: 10}}>جاري التسجيل...</Text>
                </View>
              ) : (
                <TextInput style={styles.whatsappTextInput} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
              )}
            </View>
            <TouchableOpacity 
              style={[styles.whatsappAudioBtn, isRecording && {backgroundColor: '#ff5252'}]} 
              onPress={() => message.trim() ? sendMessage() : null}
              onLongPress={startRecording}
              onPressOut={() => isRecording && stopRecording()}
            >
              <MaterialCommunityIcons name={message.trim() ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* نافذة المعاينة السريعة */}
      <Modal visible={showPreview} transparent animationType="fade">
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setShowPreview(false)}>
          <View style={styles.previewCard}>
            <View style={styles.previewImageContainer}>
              {previewUser?.profilePic ? (
                <Image source={{ uri: previewUser.profilePic }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, {backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center'}]}>
                   <Text style={{fontSize: 80, color: 'white'}}>{previewUser?.email[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.previewNameTag}><Text style={styles.previewNameText}>{previewUser?.email.split('@')[0]}</Text></View>
            </View>
            <View style={styles.previewActionBar}>
              <TouchableOpacity onPress={() => { setShowPreview(false); setSelectedUser(previewUser); }}>
                <Ionicons name="chatbox-ellipses-outline" size={26} color="#00a884" />
              </TouchableOpacity>
              <ZegoSendCallInvitationButton invitees={[{ userID: previewUser?.id, userName: previewUser?.email }]} isVideoCall={false} resourceID={"zegouikit_call"} backgroundColor="transparent" width={30} height={30} />
              <ZegoSendCallInvitationButton invitees={[{ userID: previewUser?.id, userName: previewUser?.email }]} isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" width={30} height={30} />
              <TouchableOpacity><Ionicons name="information-circle-outline" size={26} color="#00a884" /></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة جهة اتصال</Text>
            <TextInput style={styles.modalInput} placeholder="إيميل المستخدم" placeholderTextColor="#8596a0" value={newContactEmail} onChangeText={setNewContactEmail} autoCapitalize="none" />
            <View style={{flexDirection: 'row-reverse', marginTop: 20}}>
              <TouchableOpacity style={styles.addBtn} onPress={addNewContact}><Text style={{color: 'white', fontWeight: 'bold'}}>إضافة</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}><Text style={{color: '#8596a0'}}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  whatsappHeader: { height: 65, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, justifyContent: 'space-between' },
  headerInfoSection: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginRight: 10 },
  headerTextContainer: { marginRight: 10, alignItems: 'flex-end' },
  headerAvatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarLetterSmall: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  fullImg: { width: '100%', height: '100%' },
  onlineStatusText: { color: '#00a884', fontSize: 11 },
  callButtonsContainer: { flexDirection: 'row', width: 75, justifyContent: 'space-between' },
  chatTitleText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  whatsappMyBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappOtherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappMiniTime: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  whatsappInputBar: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputMainCard: { flex: 1, flexDirection: 'row', backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, alignItems: 'center', height: 48 },
  whatsappTextInput: { flex: 1, color: 'white', textAlign: 'right' },
  whatsappAudioBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  messageText: { color: 'white', fontSize: 16 },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center' },
  authTitle: { color: 'white', fontSize: 28, marginTop: 10 },
  mainHeader: { height: 60, backgroundColor: '#0b141a', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  chatRow: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  chatAvatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarTxt: { color: 'white', fontSize: 22 },
  chatInfo: { flex: 1, marginRight: 15 },
  chatName: { color: 'white', fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
  lastMsg: { color: '#8596a0', fontSize: 14, textAlign: 'right' },
  searchSection: { paddingHorizontal: 15, marginBottom: 10 },
  searchBar: { backgroundColor: '#202c33', borderRadius: 25, paddingHorizontal: 15, height: 45, justifyContent: 'center' },
  searchTxt: { color: 'white', textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1f2c34', borderRadius: 15, padding: 20 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { backgroundColor: '#2a3942', color: 'white', borderRadius: 10, padding: 12, textAlign: 'left' },
  addBtn: { backgroundColor: '#00a884', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 5, marginLeft: 15 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 10 },
  bubble: { padding: 10, borderRadius: 10, margin: 8, maxWidth: '80%' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  previewCard: { width: 250, backgroundColor: '#1f2c34', borderRadius: 10, overflow: 'hidden' },
  previewImageContainer: { width: 250, height: 250, position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  previewNameTag: { position: 'absolute', top: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', padding: 8 },
  previewNameText: { color: 'white', fontSize: 18, textAlign: 'right' },
  previewActionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, backgroundColor: '#1f2c34' },
});
