import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// استيراد محرك المكالمات ZegoCloud
import ZegoUIKitPrebuiltCallService, { 
  ZegoSendCallInvitationButton,
  ZegoUIKitPrebuiltCallWaitingScreen,
  ZegoUIKitPrebuiltCallInCallScreen
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZegoUIKitSignalingPlugin from 'zego-uikit-signaling-plugin-rn';

export default function App() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: '1', text: 'أهلاً بك في أوايسس! الأزرار بالأعلى مفعلة الآن عبر ZegoCloud.', time: '10:00 م', sender: 'other' }
  ]);
  const [isRecording, setIsRecording] = useState(false);

  // 🔑 مفاتيحك الخاصة التي استخرجناها
  const appID = 1773421291;
  const appSign = "48f1a163421aeb2dfdf57ac214f51362d8733ee19be92d3745a160a2521de2d7";
  
  // تعريف المستخدم (في النسخة النهائية سيأتي من Firebase)
  const userID = "oasis_user_123"; 
  const userName = "مستخدم_أوايسس";

  // 🛠️ إعداد محرك الاتصال عند فتح التطبيق
  useEffect(() => {
    ZegoUIKitPrebuiltCallService.init(
      appID,
      appSign,
      userID,
      userName,
      [ZegoUIKitSignalingPlugin],
      {
        ringtoneConfig: {
          incomingCallRingtone: 'ringtone.mp3',
          outgoingCallRingtone: 'ringtone.mp3',
        },
      }
    );
  }, []);

  // ✉️ وظيفة إرسال الرسائل
  const sendMessage = () => {
    if (message.trim().length > 0) {
      const newMessage = {
        id: Date.now().toString(),
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'me'
      };
      setChatMessages([...chatMessages, newMessage]);
      setMessage('');
    }
  };

  // 🎙️ وظيفة الميكروفون (التسجيل)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      console.log("بدء التسجيل عبر محرك expo-av...");
    } else {
      Alert.alert("تم الحفظ", "بصمة الصوت جاهزة للإرسال.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      {/* هيدر المحادثة */}
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <TouchableOpacity><Ionicons name="arrow-forward" size={24} color="white" /></TouchableOpacity>
          <View style={styles.avatar} />
          <View>
            <Text style={styles.userName}>صديقي</Text>
            <Text style={styles.status}>متصل الآن</Text>
          </View>
        </View>
        
        <View style={styles.headerIcons}>
          {/* زر فيديو Zego الحقيقي */}
          <ZegoSendCallInvitationButton
            invitees={[{ userID: 'friend_id', userName: 'صديقي' }]}
            isVideoCall={true}
            resourceID={"oasis_video"} // نفس المعرف في لوحة تحكم Zego
          />
          
          {/* زر صوت Zego الحقيقي */}
          <ZegoSendCallInvitationButton
            invitees={[{ userID: 'friend_id', userName: 'صديقي' }]}
            isVideoCall={false}
            resourceID={"oasis_voice"}
          />
        </View>
      </View>

      {/* منطقة عرض الرسائل */}
      <FlatList 
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.sender === 'me' ? styles.myBubble : styles.otherBubble]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        )}
        contentContainerStyle={styles.chatList}
      />

      {/* شريط الإدخال السفلي */}
      <View style={styles.bottomBar}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity><Ionicons name="happy-outline" size={24} color="#8596a0" /></TouchableOpacity>
          <TextInput 
            style={styles.input} 
            placeholder="الرسالة" 
            placeholderTextColor="#8596a0"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity><Ionicons name="attach" size={24} color="#8596a0" style={styles.attachIcon} /></TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={message ? sendMessage : toggleRecording}
          style={[styles.actionBtn, isRecording && {backgroundColor: '#ff4444'}]}
        >
          {message ? (
            <MaterialCommunityIcons name="send" size={24} color="white" style={{transform: [{scaleX: -1}]}} />
          ) : (
            <MaterialCommunityIcons name={isRecording ? "stop" : "microphone"} size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3d4b55', marginHorizontal: 10 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  status: { color: '#8596a0', fontSize: 12 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  chatList: { padding: 15 },
  bubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', borderTopRightRadius: 2 },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#1f2c34', borderTopLeftRadius: 2 },
  messageText: { color: 'white', fontSize: 16 },
  timeText: { color: '#8596a0', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  bottomBar: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#1f2c34', borderRadius: 25, alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, color: 'white', fontSize: 17, paddingHorizontal: 10, textAlign: 'right' },
  attachIcon: { transform: [{rotate: '45deg'}], marginRight: 10 },
  actionBtn: { width: 48, height: 48, backgroundColor: '#25D366', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
});
