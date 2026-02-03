import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, 
  Alert, KeyboardAvoidingView, Platform, Image, ImageBackground, SafeAreaView, ActivityIndicator, PermissionsAndroid
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av'; 
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// استيرادات ZegoCloud و Firebase
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZIM from 'zego-zim-react-native';
import * as ZPNs from 'zego-zpns-react-native';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

// الربط مع ملفاتك الثابتة
import { OASIS_KEYS } from './Constants'; 
import { encryptMessage, decryptMessage } from './encryption'; 
import AuthScreen from './AuthScreen'; 
import NavigationTabs from './NavigationTabs'; 

const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('Chats'); 
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef();

  // 1. إعداد قناة الإشعارات يدوياً للأندرويد (لحل مشكلة الفراغ في لوحة التحكم)
  const setupNotificationChannel = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('zego_video_call', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  };

  const requestAppPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ]);
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        await requestAppPermissions();
        await setupNotificationChannel();

        // جلب توكن الجهاز
        const tokenData = await Notifications.getDevicePushTokenAsync();
        const deviceToken = tokenData.data;

        // تهيئة ZegoCloud مع إعدادات القناة الافتراضية
        ZegoUIKitPrebuiltCallService.init(
            1773421291, 
            "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7", 
            currentUser.uid, 
            currentUser.email.split('@')[0], 
            [ZIM, ZPNs],
            { 
              resourceID: "zegouikit_call", 
              androidNotificationConfig: { 
                // نستخدم المعرف الذي أنشأناه يدوياً ليتطابق مع "فراغ" لوحة التحكم
                channelID: "zego_video_call", 
                channelName: "Incoming Calls" 
              } 
            }
        ).then(() => {
            ZPNs.setPushConfig({ enable: true, includeDetails: true });
            ZPNs.registerPush({ 
                token: deviceToken, 
                provider: Platform.OS === 'ios' ? 'apns' : 'fcm' 
            });
        });

        await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, id: currentUser.uid, lastSeen: serverTimestamp() 
        }, { merge: true });
        
        onSnapshot(query(collection(db, "users")), (s) => {
          const users = s.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid);
          setAllUsers(users); setFilteredUsers(users);
        });

      } else { 
        ZegoUIKitPrebuiltCallService.uninit();
        setUser(null); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // ... (بقية دوال المراسلة والرفع تبقى كما هي لضمان استقرار الوظائف)
  useEffect(() => {
    if (selectedUser && user) {
      const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
      const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
      return onSnapshot(query(collection(db, collPath), orderBy("timestamp", "asc")), (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, text: data.type === 'text' ? decryptMessage(data.text, data.encryptionRef) : data.text };
        }));
      });
    }
  }, [selectedUser, user]);

  const sendMessage = async (content = message, type = 'text') => {
    if ((type === 'text' && !content.trim()) || !selectedUser) return;
    const finalContent = type === 'text' ? encryptMessage(content, user.uid) : content;
    const chatId = selectedUser.isGroup ? selectedUser.id : (user.uid < selectedUser.id ? `${user.uid}_${selectedUser.id}` : `${selectedUser.id}_${user.uid}`);
    const collPath = selectedUser.isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    
    await addDoc(collection(db, collPath), { 
      text: finalContent, senderId: user.uid, senderName: user.email.split('@')[0], 
      encryptionRef: user.uid, type, timestamp: serverTimestamp(), 
      displayTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
    });
    setMessage('');
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) uploadToOasisServer(result.assets[0].uri, 'image');
  };

  const uploadToOasisServer = async (uri, type) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: type === 'image' ? 'image/jpeg' : 'audio/m4a',
        name: `oasis_${Date.now()}`
      });
      const response = await fetch(`${SERVER_URL}/api/upload-media`, {
        method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = await response.json();
      if (result.url) sendMessage(result.url, type);
    } catch (error) { Alert.alert("خطأ", "فشل رفع الملف"); } finally { setUploading(false); }
  };

  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.container}>
      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mainHeader}>
            <Text style={styles.headerTitle}>Oasis</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity><MaterialCommunityIcons name="account-group-outline" size={26} color="white" /></TouchableOpacity>
              <TouchableOpacity style={{marginHorizontal: 15}}><Ionicons name="person-add-outline" size={24} color="white" /></TouchableOpacity>
              <TouchableOpacity onPress={pickImage}><Ionicons name="camera-outline" size={26} color="white" /></TouchableOpacity>
            </View>
          </View>

          <FlatList 
            data={filteredUsers} 
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.chatRow} onPress={() => setSelectedUser(item)}>
                <View style={styles.chatAvatar}><Text style={styles.avatarTxt}>{item.email[0].toUpperCase()}</Text></View>
                <View style={styles.chatInfo}>
                    <Text style={styles.chatName}>{item.email.split('@')[0]}</Text>
                    <Text style={styles.lastMsg}>محادثة مشفرة آمنة...</Text>
                </View>
              </TouchableOpacity>
            )} 
            keyExtractor={(item) => item.id} 
          />
          <NavigationTabs currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.whatsappHeader}>
             <View style={styles.callButtonsContainer}>
                <ZegoSendCallInvitationButton 
                    invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
                    isVideoCall={false} 
                    resourceID={"zegouikit_call"} 
                    backgroundColor="transparent" width={35} height={35} 
                />
                <ZegoSendCallInvitationButton 
                    invitees={[{ userID: selectedUser.id, userName: selectedUser.email }]} 
                    isVideoCall={true} 
                    resourceID={"zegouikit_call"} 
                    backgroundColor="transparent" width={35} height={35} 
                />
            </View>
            <View style={styles.headerInfoSection}>
                <Text style={styles.chatTitleText}>{selectedUser.email.split('@')[0]}</Text>
                <Text style={{color: '#00a884', fontSize: 11}}>نشط الآن</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          </View>

          <ImageBackground source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={{flex: 1}}>
            <FlatList 
                ref={flatListRef}
                data={chatMessages} 
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderId === user.uid ? styles.whatsappMyBubble : styles.whatsappOtherBubble]}>
                {item.type === 'image' ? (
                    <Image source={{ uri: item.text }} style={styles.messageImage} />
                ) : ( <Text style={styles.messageText}>{item.text}</Text> )}
                <Text style={styles.whatsappMiniTime}>{item.displayTime}</Text>
              </View>
            )} keyExtractor={(item) => item.id} />
            {uploading && <ActivityIndicator size="large" color="#00a884" style={{marginBottom: 20}} />}
          </ImageBackground>

          <View style={styles.whatsappInputBar}>
            <View style={styles.inputMainCard}>
              <TextInput style={styles.whatsappTextInput} placeholder="مراسلة" value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
              <TouchableOpacity onPress={pickImage}><Ionicons name="attach-outline" size={24} color="#8596a0" /></TouchableOpacity>
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
  mainHeader: { height: 60, backgroundColor: '#0b141a', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  whatsappHeader: { height: 65, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  callButtonsContainer: { flexDirection: 'row', alignItems: 'center', width: 90, justifyContent: 'space-around' },
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
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  messageImage: { width: 220, height: 220, borderRadius: 10 },
  bubble: { padding: 10, borderRadius: 10, margin: 8 }
});
