Import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 
import { Audio, Video } from 'expo-av'; 
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

const STICKER_LIST = [
  'https://cdn-icons-png.flaticon.com/512/4727/4727266.png',
  'https://cdn-icons-png.flaticon.com/512/4727/4727218.png',
  'https://cdn-icons-png.flaticon.com/512/4727/4727237.png',
  'https://cdn-icons-png.flaticon.com/512/4727/4727222.png',
];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chats'); 
  const [currentFilter, setCurrentFilter] = useState('all'); 
  const [allUsers, setAllUsers] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statuses, setStatuses] = useState([]); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [showStickers, setShowStickers] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [groupName, setGroupName] = useState('');

  const getCurrentTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

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
        const qGroups = query(collection(db, "groups"), where("members", "array-contains", currentUser.uid));
        onSnapshot(qGroups, (s) => {
            const groupsData = s.docs.map(d => ({ id: d.id, ...d.data(), isGroup: true }));
            setAllGroups(groupsData); setFilteredGroups(groupsData);
        });
        onSnapshot(query(collection(db, "statuses"), orderBy("timestamp", "desc")), (s) => setStatuses(s.docs.map(d => d.data())));
        
        // تهيئة خدمة الاتصال
        ZegoUIKitPrebuiltCallService.init(APP_ID, APP_SIGN, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
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

  const uploadMedia = async (uri, type, isStatus = false) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', { uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), name: `oasis_${Date.now()}.jpg`, type: type === 'video' ? 'video/mp4' : 'image/jpeg' });
    try {
      const res = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        if (isStatus) {
            await addDoc(collection(db, "statuses"), { userId: user.uid, userName: user.email.split('@')[0], imageUrl: data.url, type, timestamp: serverTimestamp() });
        } else {
            sendMessage(data.url, 'image');
        }
      }
    } catch (e) { Alert.alert("خطأ", "فشل الرفع"); }
    finally { setUploading(false); }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.5 });
    if (!result.canceled) uploadMedia(result.assets[0].uri, result.assets[0].type, true);
  };

  const openChatCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.5 });
    if (!result.canceled) uploadMedia(result.assets[0].uri, 'image', false);
  };

  const pickDocument = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 });
    if (!result.canceled) uploadMedia(result.assets[0].uri, 'image', false);
  };

  const handleSearch = async (text) => {
    setSearchText(text); const queryText = text.toLowerCase().trim();
    if (!queryText) { setFilteredUsers(allUsers); setFilteredGroups(allGroups); return; }
    const fUsers = allUsers.filter(u => u.email.toLowerCase().includes(queryText));
    if (fUsers.length === 0 && queryText.length > 2) {
        const q = query(collection(db, "users"), where("email", ">=", queryText), where("email", "<=", queryText + '\uf8ff'));
        const snap = await getDocs(q);
        setFilteredUsers(snap.empty ? [] : snap.docs.map(d => d.data()).filter(u => u.id !== user.uid));
    } else { setFilteredUsers(fUsers); }
  };

  const sendMessage = async (content = message, type = 'text') => {
    if ((type === 'text' && !content.trim()) || !selectedUser) return;
    const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
    const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    await addDoc(collection(db, collPath), { text: content, senderId: user.uid, senderName: user.email.split('@')[0], type, timestamp: serverTimestamp(), displayTime: getCurrentTime() });
    setMessage(''); setShowStickers(false);
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
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <TouchableOpacity style={styles.headerIcon}><Ionicons name="ellipsis-vertical" size={22} color="white" /></TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={openCamera}><Ionicons name="camera-outline" size={26} color="white" /></TouchableOpacity>
            </View>
          </View>
          {activeTab === 'chats' && (
              <View style={{flex:1}}>
                  <View style={styles.searchSection}><View style={styles.searchBar}><Ionicons name="search" size={20} color="#8596a0" style={{marginRight: 10}} /><TextInput placeholder="بحث..." placeholderTextColor="#8596a0" style={styles.searchTxt} value={searchText} onChangeText={handleSearch} /></View></View>
                  <FlatList data={filteredUsers} keyExtractor={item => item.id} renderItem={({ item }) => (
                    <TouchableOpacity style={styles.chatRow} onPress={() => setSelectedUser(item)}>
                      <View style={styles.chatAvatar}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                      <View style={styles.chatInfo}><Text style={styles.chatName}>{item.email.split('@')[0]}</Text><Text style={styles.lastMsg}>انقر للمراسلة...</Text></View>
                    </TouchableOpacity>
                  )} />
              </View>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.whatsappHeader}>
            <TouchableOpacity onPress={() => setSelectedUser(null)} style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="arrow-back" size={24} color="white" />
              <View style={styles.smallAvatar}><Text style={{color:'white'}}>{selectedUser.email[0].toUpperCase()}</Text></View>
            </TouchableOpacity>
            <View style={{flex: 1, marginLeft: 10}}>
              <Text style={styles.chatTitleText}>{selectedUser.email.split('@')[0]}</Text>
              <Text style={styles.userStatusText}>متصل الآن</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                {/* زر الفيديو الفعال */}
                <ZegoSendCallInvitationButton 
                  invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
                  isVideoCall={true} 
                  resourceID={"zegouikit_call"} 
                  backgroundColor="transparent" 
                  width={35} height={35}
                />
                {/* زر الصوت الفعال (تم ربطه الآن) */}
                <ZegoSendCallInvitationButton 
                  invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
                  isVideoCall={false} 
                  resourceID={"zegouikit_call"} 
                  backgroundColor="transparent" 
                  width={35} height={35}
                />
                <TouchableOpacity style={{marginLeft: 5}}><Ionicons name="ellipsis-vertical" size={22} color="white" /></TouchableOpacity>
            </View>
          </View>

          <ImageBackground source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={{flex: 1, backgroundColor: '#0b141a'}}>
            <FlatList data={chatMessages} keyExtractor={item => item.id} renderItem={({ item }) => (
              item.type === 'sticker' ? (
                <View style={[styles.stickerMsg, item.senderId === user.uid ? {alignSelf: 'flex-end'} : {alignSelf: 'flex-start'}]}>
                  <Image source={{uri: item.text}} style={{width: 100, height: 100}} />
                  <Text style={styles.miniTime}>{item.displayTime}</Text>
                </View>
              ) : (
                <View style={[styles.bubble, item.senderId === user.uid ? styles.whatsappMyBubble : styles.whatsappOtherBubble]}>
                  <Text style={styles.messageText}>{item.text}</Text>
                  <View style={{flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center'}}>
                    <Text style={styles.whatsappMiniTime}>{item.displayTime}</Text>
                    {item.senderId === user.uid && <Ionicons name="checkmark-done" size={16} color="#53bdeb" />}
                  </View>
                </View>
              )
            )} />
          </ImageBackground>

          {showStickers && (
            <View style={styles.stickerPanel}>
              <FlatList horizontal data={STICKER_LIST} renderItem={({item}) => (
                <TouchableOpacity onPress={() => sendMessage(item, 'sticker')}><Image source={{uri: item}} style={styles.stickerIcon} /></TouchableOpacity>
              )} />
            </View>
          )}
          <View style={styles.whatsappInputBar}>
            <View style={styles.inputMainCard}>
              <TouchableOpacity onPress={() => setShowStickers(!showStickers)}><MaterialCommunityIcons name={showStickers ? "keyboard" : "emoticon-outline"} size={24} color="#8596a0" /></TouchableOpacity>
              <TextInput style={styles.whatsappTextInput} placeholder="مراسلة" value={message} onChangeText={setMessage} onFocus={() => setShowStickers(false)} placeholderTextColor="#8596a0" multiline />
              <TouchableOpacity onPress={pickDocument} style={{marginHorizontal: 10}}><Ionicons name="paperclip" size={24} color="#8596a0" /></TouchableOpacity>
              <TouchableOpacity onPress={openChatCamera}><Ionicons name="camera" size={24} color="#8596a0" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.whatsappAudioBtn} onPress={() => sendMessage()}>
              <MaterialCommunityIcons name={message.trim() ? "send" : "microphone"} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  whatsappHeader: { height: 65, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  chatTitleText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  userStatusText: { color: '#8596a0', fontSize: 12 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  whatsappMyBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', borderTopRightRadius: 0, margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappOtherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', borderTopLeftRadius: 0, margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappMiniTime: { color: '#8596a0', fontSize: 10, marginRight: 4 },
  whatsappInputBar: { flexDirection: 'row', padding: 5, alignItems: 'center', backgroundColor: 'transparent' },
  inputMainCard: { flex: 1, flexDirection: 'row', backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 12, alignItems: 'center', height: 48 },
  whatsappTextInput: { flex: 1, color: 'white', fontSize: 17, paddingHorizontal: 10, textAlign: 'right' },
  whatsappAudioBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 5 },
  stickerPanel: { height: 120, backgroundColor: '#1f2c34', padding: 10 },
  stickerIcon: { width: 60, height: 60, marginHorizontal: 10 },
  stickerMsg: { margin: 10 },
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center' },
  authTitle: { color: 'white', fontSize: 28, marginTop: 10 },
  mainHeader: { height: 60, backgroundColor: '#0b141a', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  chatRow: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  chatAvatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  chatInfo: { flex: 1, marginRight: 15 },
  chatName: { color: 'white', fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
  lastMsg: { color: '#8596a0', fontSize: 14, textAlign: 'right' },
  searchSection: { paddingHorizontal: 15, marginBottom: 10 },
  searchBar: { backgroundColor: '#202c33', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45 },
  searchTxt: { color: 'white', flex: 1, textAlign: 'right' },
});
