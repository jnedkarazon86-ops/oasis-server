import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// الاستيرادات الأساسية
import ZegoUIKitPrebuiltCallService, { ZegoSendCallInvitationButton } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';
import { db, auth } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = 'https://oasis-server-e6sc.onrender.com';
const appID = 1773421291; 
const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isWaitingVerify, setIsWaitingVerify] = useState(false);
  
  const [allUsers, setAllUsers] = useState([]); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 1. إدارة جلسة المستخدم وتفعيل الحماية
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // فحص حالة تفعيل الإيميل (المنطق الذي سألت عنه في الصورة)
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsWaitingVerify(false);
          await setDoc(doc(db, "users", currentUser.uid), { 
            email: currentUser.email, 
            id: currentUser.uid,
            lastSeen: serverTimestamp() 
          }, { merge: true });

          const qUsers = query(collection(db, "users"));
          onSnapshot(qUsers, (snapshot) => {
            setAllUsers(snapshot.docs.map(d => d.data()).filter(u => u.id !== currentUser.uid));
          });

          ZegoUIKitPrebuiltCallService.init(
            appID, appSign, currentUser.uid, currentUser.email.split('@')[0], 
            [ZegoUIKitSignalingPlugin]
          );
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
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [selectedUser]);

  // 2. إرسال الرسائل النصية
  const sendMessage = async () => {
    if (message.trim() && selectedUser) {
      const chatId = getChatId(user.uid, selectedUser.id);
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: message,
          senderId: user.uid,
          type: 'text',
          timestamp: serverTimestamp()
        });
        setMessage('');
      } catch (e) { Alert.alert("خطأ", "فشل الإرسال"); }
    }
  };

  // 3. دوال الوسائط (صور وفيديو) عبر السيرفر
  const pickMedia = async (mediaType) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert("عذراً", "نحتاج إذن للوصول للاستوديو");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setUploading(true);
      const fileUri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
        name: `upload_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`
      });
      formData.append('type', mediaType);

      try {
        const response = await fetch(`${SERVER_URL}/api/upload-media`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.status === 'success') {
          const chatId = getChatId(user.uid, selectedUser.id);
          await addDoc(collection(db, "chats", chatId, "messages"), {
            mediaUrl: data.url,
            senderId: user.uid,
            type: mediaType,
            timestamp: serverTimestamp()
          });
        }
      } catch (err) { Alert.alert("خطأ", "فشل الرفع للسيرفر"); }
      finally { setUploading(false); }
    }
  };

  // 4. دوال الصوت
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) { Alert.alert("فشل التسجيل", err.message); }
  }

  async function stopRecording() {
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: `voice_${Date.now()}.m4a` });
      formData.append('type', 'audio');

      const response = await fetch(`${SERVER_URL}/api/upload-media`, { method: 'POST', body: formData });
      const result = await response.json();

      if (result.status === 'success') {
        const chatId = getChatId(user.uid, selectedUser.id);
        await addDoc(collection(db, "chats", chatId, "messages"), {
          mediaUrl: result.url,
          senderId: user.uid,
          type: 'audio',
          timestamp: serverTimestamp()
        });
      }
    } catch (err) { Alert.alert("خطأ", "فشل رفع الصوت"); }
  }

  async function playVoice(url) {
    try {
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${SERVER_URL}/${url}` });
      setSound(newSound);
      await newSound.playAsync();
    } catch (e) { Alert.alert("خطأ", "لا يمكن التشغيل"); }
  }

  // الواجهة
  if (!user) {
     return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <Ionicons name="leaf" size={70} color="#25D366" />
          <Text style={styles.authTitle}>واحة أوايسس</Text>
          {isWaitingVerify ? (
            <View style={{alignItems: 'center'}}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.waitingText}>يرجى تفعيل بريدك الإلكتروني ثم العودة</Text>
              <TouchableOpacity onPress={() => auth.signOut()}><Text style={{color: '#25D366', marginTop: 20}}>خروج</Text></TouchableOpacity>
            </View>
          ) : (
            <>
               <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" />
               <TextInput style={styles.input} placeholder="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry />
               <TouchableOpacity style={styles.mainBtn} onPress={() => { /* منطق handleAuth السابق */ }}>
                 {authLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>دخول / تسجيل</Text>}
               </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  if (!selectedUser) {
    return (
      <View style={styles.container}>
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
        <TouchableOpacity style={{padding: 20}} onPress={() => auth.signOut()}><Text style={{color: 'red', textAlign:'center'}}>تسجيل خروج</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedUser(null)}><Ionicons name="arrow-back" size={28} color="white" /></TouchableOpacity>
        <Text style={styles.userName}>{selectedUser.email.split('@')[0]}</Text>
        {/* زر الاتصال يظهر فقط لأننا ضمنا أن المستخدم مفعل في useEffect */}
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
            {item.type === 'audio' ? (
              <TouchableOpacity onPress={() => playVoice(item.mediaUrl)} style={styles.mediaRow}>
                <Ionicons name="play-circle" size={30} color="white" />
                <Text style={styles.messageText}> بصمة صوتية</Text>
              </TouchableOpacity>
            ) : item.type === 'image' ? (
              <Image source={{ uri: `${SERVER_URL}/${item.mediaUrl}` }} style={styles.chatImage} />
            ) : item.type === 'video' ? (
               <TouchableOpacity style={styles.mediaRow}>
                 <Ionicons name="videocam" size={24} color="white" />
                 <Text style={styles.messageText}> مشاهدة فيديو</Text>
               </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
          </View>
        )}
      />

      {uploading && <ActivityIndicator color="#25D366" style={{marginBottom: 10}} />}

      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={() => pickMedia('image')}><Ionicons name="image" size={28} color="#25D366" /></TouchableOpacity>
        <TouchableOpacity onPress={() => pickMedia('video')} style={{marginLeft: 10}}><Ionicons name="videocam" size={28} color="#25D366" /></TouchableOpacity>
        
        <View style={styles.inputWrapper}>
          <TextInput style={styles.textInput} placeholder="مراسلة..." value={message} onChangeText={setMessage} placeholderTextColor="#8596a0" />
        </View>

        <TouchableOpacity 
            style={[styles.sendBtn, isRecording && {backgroundColor: '#ff3b30'}]} 
            onPress={message ? sendMessage : (isRecording ? stopRecording : startRecording)}
        >
          <MaterialCommunityIcons name={message ? "send" : (isRecording ? "stop" : "microphone")} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  authContainer: { flex: 1, backgroundColor: '#0b141a', justifyContent: 'center', padding: 20 },
  authCard: { backgroundColor: '#1f2c34', borderRadius: 25, padding: 30, alignItems: 'center' },
  authTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', marginVertical: 20 },
  input: { backgroundColor: '#2a3942', color: 'white', width: '100%', borderRadius: 12, padding: 15, marginBottom: 15, textAlign: 'right' },
  mainBtn: { backgroundColor: '#25D366', width: '100%', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingText: { color: '#ffcc00', marginTop: 20, textAlign: 'center' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  userCard: { flexDirection: 'row-reverse', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#2a3942', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  bubble: { padding: 10, borderRadius: 15, marginHorizontal: 15, marginVertical: 5, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34' },
  messageText: { color: 'white', fontSize: 16, textAlign: 'right' },
  chatImage: { width: 200, height: 200, borderRadius: 10 },
  mediaRow: { flexDirection: 'row', alignItems: 'center' },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: '#0b141a' },
  inputWrapper: { flex: 1, backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, height: 45, justifyContent: 'center', marginHorizontal: 10 },
  textInput: { color: 'white', textAlign: 'right' },
  sendBtn: { width: 45, height: 45, backgroundColor: '#25D366', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' }
});
