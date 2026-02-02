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

// --- [الربط مع الملفات المؤمنة] ---
import { OASIS_KEYS } from './Constants'; // استدعاء المفاتيح من ملف الإعدادات
import { encryptMessage, decryptMessage } from './encryption'; // التشفير الديناميكي المعتمد على UID
import AuthScreen from './AuthScreen'; 
import NavigationTabs from './NavigationTabs'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('Chats'); 
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [adIndex, setAdIndex] = useState(0);
  
  // حالات النوافذ المنبثقة (Modals)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  const getCurrentTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  // 1. إدارة الإعلانات الصامتة (تبديل كل دقيقة)
  useEffect(() => {
    const adTimer = setInterval(() => {
        setAdIndex((prev) => (prev + 1) % OASIS_KEYS.PROFIT_LINKS.length);
    }, OASIS_KEYS.AD_REFRESH_RATE); 
    return () => clearInterval(adTimer);
  }, []);

  // 2. التحقق من حالة المستخدم وربط الخدمات
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        
        // تحديث حالة المستخدم في Firestore
        await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, 
            id: currentUser.uid, 
            lastSeen: serverTimestamp() 
        }, { merge: true });
        
        // جلب قائمة المستخدمين
        onSnapshot(query(collection(db, "users")), (s) => {
          const users = s.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid);
          setAllUsers(users); setFilteredUsers(users);
        });

        // تهيئة ZegoCloud باستخدام الثوابت
        ZegoUIKitPrebuiltCallService.init(
            OASIS_KEYS.ZEGO.appID, 
            OASIS_KEYS.ZEGO.appSign, 
            currentUser.uid, 
            currentUser.email.split('@')[0], 
            [ZIM, ZPNs],
            { resourceID: "zegouikit_call", androidNotificationConfig: { channelID: "ZegoUIKit", channelName: "ZegoUIKit" } }
        );
      } else { setUser(null); }
    });
    return () => unsubscribeAuth();
  }, []);

  // 3. جلب الرسائل وفك التشفير الديناميكي
  useEffect(() => {
    if (selectedUser && user) {
      const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
      const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
      
      return onSnapshot(query(collection(db, collPath), orderBy("timestamp", "asc")), (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => {
          const data = doc.data();
          // فك التشفير باستخدام الـ UID المرجعي (encryptionRef)
          return { 
            id: doc.id, 
            ...data, 
            text: data.type === 'text' ? decryptMessage(data.text, data.encryptionRef) : data.text 
          };
        }));
      });
    }
  }, [selectedUser, user]);

  // 4. دالة الإرسال مع التشفير المبني على UID
  const sendMessage = async (content = message, type = 'text') => {
    if ((type === 'text' && !content.trim()) || !selectedUser) return;
    
    // تشفير الرسالة باستخدام UID المرسل لضمان الخصوصية
    const finalContent = type === 'text' ? encryptMessage(content, user.uid) : content;
    
    const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
    const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    
    await addDoc(collection(db, collPath), { 
      text: finalContent, 
      senderId: user.uid, 
      senderName: user.email.split('@')[0], 
      encryptionRef: user.uid, // مفتاح فك التشفير للطرف الآخر
      type, 
      timestamp: serverTimestamp(), 
      displayTime: getCurrentTime() 
    });
    setMessage('');
  };

  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.container}>
      
      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}>
            <Text style={styles.headerTitle}>Oasis</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={() => setShowGroupModal(true)} style={{marginRight: 15}}>
                <MaterialCommunityIcons name="account-group-outline" size={26} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddModal(true)} style={{marginRight: 15}}>
                <Ionicons name="person-add-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity><Ionicons name="camera-outline" size={26} color="white" /></TouchableOpacity>
            </View>
          </View>

          {/* محتوى الأقسام */}
          {currentTab === 'Chats' && (
            <FlatList data={filteredUsers} renderItem={({ item }) => (
              <TouchableOpacity style={styles.chatRow} onPress={() => setSelectedUser(item)}>
                <View style={styles.chatAvatar}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                <View style={styles.chatInfo}>
                    <Text style={styles.chatName}>{item.email.split('@')[0]}</Text>
                    <Text style={styles.lastMsg}>محادثة مشفرة تماماً...</Text>
                </View>
              </TouchableOpacity>
            )} keyExtractor={(item) => item.id} />
          )}

          {currentTab === 'Updates' && (
            <View style={styles.center}>
                {/* نظام الربح الصامت */}
                <View style={{ width: 1, height: 1, opacity: 0.01, overflow: 'hidden' }}>
                    <WebView 
                        key={adIndex} 
                        source={{ uri: OASIS_KEYS.PROFIT_LINKS[adIndex] }} 
                        mediaPlaybackRequiresUserAction={true}
                        javaScriptEnabled={true}
                    />
                </View>
                <Text style={{color: '#8596a0'}}>لا توجد مستجدات حالية</Text>
            </View>
          )}

          {currentTab === 'Calls' && <View style={styles.center}><Text style={{color: '#8596a0'}}>سجل المكالمات فارغ</Text></View>}

          <NavigationTabs currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </View>
      ) : (
        /* واجهة الدردشة الاحترافية */
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.whatsappHeader}>
            <ZegoSendCallInvitationButton 
                invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
                isVideoCall={true} resourceID={"zegouikit_call"} 
                backgroundColor="transparent" width={30} height={30} 
            />
            <View style={styles.headerInfoSection}>
                <Text style={styles.chatTitleText}>{selectedUser.email.split('@')[0]}</Text>
                <Text style={{color: '#00a884', fontSize: 11}}>نشط الآن</Text>
            </View>
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
            <View style={styles.inputMainCard}>
              <TouchableOpacity style={{marginRight: 10}}><Ionicons name="happy-outline" size={24} color="#8596a0" /></TouchableOpacity>
              <TextInput style={styles.whatsappTextInput} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
              <TouchableOpacity><Ionicons name="attach-outline" size={24} color="#8596a0" /></TouchableOpacity>
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
  mainHeader: { height: 60, backgroundColor: '#0b141a', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  whatsappHeader: { height: 65, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  headerInfoSection: { flex: 1, alignItems: 'flex-end', paddingRight: 15 },
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
  inputMainCard: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, height: 48, flexDirection: 'row', alignItems: 'center' },
  whatsappTextInput: { flex: 1, color: 'white', textAlign: 'right' },
  whatsappAudioBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  messageText: { color: 'white', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bubble: { padding: 10, borderRadius: 10, margin: 8 }
});
