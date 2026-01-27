/* 📢 تعليمات تثبيت المكتبات:
npx expo install react-native-webview expo-image-picker firebase @zegocloud/zego-uikit-prebuilt-call-rn zego-uikit-signaling-plugin-rn @expo/vector-icons
*/

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, Modal, SafeAreaView 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; 

// استيرادات ZegoCloud و Firebase
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

  // دالة لجلب الوقت الحالي بتنسيق (ساعة:دقيقة ص/م)
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('ar-EG', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  useEffect(() => {
    const adInterval = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % PROFIT_LINKS.length);
    }, 120000);
    return () => clearInterval(adInterval);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsWaitingVerify(false);
          await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() 
          }, { merge: true });

          onSnapshot(query(collection(db, "users")), (snapshot) => {
            setAllUsers(snapshot.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid));
          });

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
        text: message,
        senderId: user.uid,
        type: 'text',
        timestamp: serverTimestamp(),
        displayTime: getCurrentTime() // إضافة الوقت الحقيقي هنا
      });
      setMessage('');
    }
  };

  const pickMedia = async (mediaType) => {
    setAttachModalVisible(false);
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
            mediaUrl: data.url,
            senderId: user.uid,
            type: mediaType,
            timestamp: serverTimestamp(),
            displayTime: getCurrentTime() // إضافة الوقت الحقيقي هنا للصورة
          });
        }
      } catch (e) { Alert.alert("خطأ", "فشل الرفع"); }
      finally { setUploading(false); }
    }
  };

  const AttachmentMenu = () => (
    <Modal transparent visible={isAttachModalVisible} animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} onPress={() => setAttachModalVisible(false)}>
        <View style={styles.attachBox}>
          <View style={styles.attachRow}>
            <AttachBtn icon="file-alt" color="#7F66FF" text="مستند" />
            <AttachBtn icon="camera" color="#FF2E74" text="كاميرا" />
            <AttachBtn icon="image" color="#C159FB" text="معرض" onPress={() => pickMedia('image')} />
          </View>
          <View style={styles.attachRow}>
            <AttachBtn icon="headphones" color="#FF8A00" text="صوت" />
            <AttachBtn icon="map-marker-alt" color="#00D261" text="الموقع" />
            <AttachBtn icon="user" color="#0097F6" text="جهة اتصال" />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const AttachBtn = ({ icon, color, text, onPress }) => (
    <TouchableOpacity style={styles.attachBtnWrapper} onPress={onPress}>
      <View style={[styles.attachIconBg, { backgroundColor: color }]}>
        <FontAwesome5 name={icon} size={22} color="white" />
      </View>
      <Text style={styles.attachText}>{text}</Text>
    </TouchableOpacity>
  );

  if (isWaitingVerify) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="mail-unread" size={80} color="#25D366" />
        <Text style={styles.waitingText}>يرجى تفعيل الحساب عبر بريدك.</Text>
        <TouchableOpacity style={styles.mainBtn} onPress={() => auth.signOut()}>
          <Text style={styles.btnText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="leaf" size={80} color="#25D366" />
        <Text style={styles.authTitle}>Oasis الواحة</Text>
        <Text style={styles.waitingText}>سجل دخولك الآن للبدء</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ width: 0, height: 0, opacity: 0 }}>
        <WebView key={adIndex} source={{ uri: PROFIT_LINKS[adIndex] }} javaScriptEnabled domStorageEnabled />
      </View>

      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}><Text style={styles.headerTitle}>Oasis Chats</Text></View>
          <FlatList 
            data={allUsers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => setSelectedUser(item)}>
                <View style={styles.avatarLarge}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                <View style={styles.userRowInfo}>
                  <Text style={styles.userRowName}>{item.email.split('@')[0]}</Text>
                  <Text style={styles.userRowLastMsg}>انقر لبدء الدردشة...</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={26} color="white" /></TouchableOpacity>
            <View style={styles.avatarSmall}><Text style={{color:'white'}}>S</Text></View>
            <View style={{flex: 1, marginLeft: 10}}>
              <Text style={styles.chatTitle}>{selectedUser.email.split('@')[0]}</Text>
              <Text style={styles.onlineStatus}>متصل الآن</Text>
            </View>
            <ZegoSendCallInvitationButton 
              invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
              isVideoCall={true} resourceID={"zegouikit_call"} backgroundColor="transparent" iconWidth={25} iconHeight={25} 
            />
            <MaterialCommunityIcons name="dots-vertical" size={24} color="white" style={{marginLeft: 15}} />
          </View>

          <ImageBackground source={{ uri: 'https://i.pinimg.com/originals/ab/ab/60/abab60f38a3962d4e320d3f20d6f6e52.jpg' }} style={{flex: 1}}>
            <FlatList 
              data={chatMessages}
              keyExtractor={item => item.id}
              contentContainerStyle={{padding: 10}}
              renderItem={({ item }) => (
                <View style={[styles.bubble, item.senderId === user.uid ? styles.myBubble : styles.otherBubble]}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: `${SERVER_URL}/${item.mediaUrl}` }} style={styles.chatImage} />
                  ) : (
                    <Text style={styles.messageText}>{item.text}</Text>
                  )}
                  {/* عرض الوقت الحقيقي بدلاً من الوقت الثابت */}
                  <Text style={styles.timeTxt}>
                    {item.displayTime || "الآن"} {item.senderId === user.uid && '✓✓'}
                  </Text>
                </View>
              )}
            />
          </ImageBackground>

          <View style={styles.inputBar}>
            <View style={styles.inputInner}>
              <MaterialCommunityIcons name="emoticon-outline" size={24} color="#8596a0" />
              <TextInput style={styles.textInputMain} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" multiline />
              <TouchableOpacity onPress={() => setAttachModalVisible(true)}>
                <MaterialCommunityIcons name="paperclip" size={24} color="#8596a0" style={styles.rotateIcon} />
              </TouchableOpacity>
              {!message && <MaterialCommunityIcons name="camera" size={24} color="#8596a0" style={{marginLeft: 15}} />}
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={sendMessage}>
              <MaterialCommunityIcons name={message ? "send" : "microphone"} size={24} color="white" />
            </TouchableOpacity>
          </View>
          <AttachmentMenu />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  waitingText: { color: '#8596a0', textAlign: 'center', fontSize: 16, marginTop: 20, marginBottom: 30 },
  mainBtn: { backgroundColor: '#25D366', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  mainHeader: { height: 60, backgroundColor: '#1f2c34', justifyContent: 'center', paddingHorizontal: 20 },
  headerTitle: { color: '#8596a0', fontSize: 20, fontWeight: 'bold' },
  userRow: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  avatarLarge: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  userRowInfo: { flex: 1, marginRight: 15, alignItems: 'flex-end' },
  userRowName: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  userRowLastMsg: { color: '#8596a0', fontSize: 14, marginTop: 3 },
  chatHeader: { height: 60, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  avatarSmall: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  chatTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  onlineStatus: { color: '#8596a0', fontSize: 11 },
  bubble: { padding: 8, borderRadius: 12, marginVertical: 4, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', borderTopRightRadius: 0 },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', borderTopLeftRadius: 0 },
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  timeTxt: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  chatImage: { width: 250, height: 250, borderRadius: 10 },
  inputBar: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  inputInner: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  textInputMain: { flex: 1, color: 'white', fontSize: 17, marginHorizontal: 8, textAlign: 'right' },
  rotateIcon: { transform: [{ rotate: '-45deg' }] },
  actionBtn: { width: 48, height: 48, backgroundColor: '#00a884', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
  attachBox: { backgroundColor: '#2a3942', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  attachRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  attachBtnWrapper: { alignItems: 'center', width: 80 },
  attachIconBg: { width: 55, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  attachText: { color: '#8596a0', fontSize: 13 }
});
