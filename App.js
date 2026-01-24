import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Linking, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: '1', text: 'أهلاً بك في أوايسس! جرب إرسال رسالة أو تسجيل صوت.', time: '10:00 م', sender: 'other' }
  ]);
  const [isRecording, setIsRecording] = useState(false);

  // 📞 برمجة أزرار الاتصال (تفتح واجهة الهاتف الحقيقية)
  const handleCall = (type) => {
    const url = type === 'video' ? 'facetime://' : 'tel:0900000000';
    Alert.alert(
      type === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية',
      'هل تريد الاتصال بهذا الصديق؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'اتصال', onPress: () => Linking.openURL(url).catch(() => Alert.alert('خطأ', 'هذه الميزة تعمل على الهواتف الحقيقية فقط')) }
      ]
    );
  };

  // ✉️ برمجة إرسال الرسائل (تضيف الرسالة للقائمة فوراً)
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

  // 🎙️ برمجة الميكروفون (تغيير الحالة للشكل النشط)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // هنا سنربط مكتبة expo-av لاحقاً للتسجيل الحقيقي
      console.log("بدء التسجيل...");
    } else {
      Alert.alert("تم تسجيل الصوت", "سيتم إرسال المقطع الصوتي فور ربط قاعدة البيانات.");
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
          <TouchableOpacity onPress={() => handleCall('video')}><Ionicons name="videocam" size={24} color="white" style={styles.icon} /></TouchableOpacity>
          <TouchableOpacity onPress={() => handleCall('voice')}><Ionicons name="call" size={20} color="white" style={styles.icon} /></TouchableOpacity>
          <TouchableOpacity><Ionicons name="ellipsis-vertical" size={22} color="white" /></TouchableOpacity>
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

      {/* شريط الإدخال السفلي الذكي */}
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
          {!message && <TouchableOpacity><Ionicons name="camera" size={24} color="#8596a0" /></TouchableOpacity>}
        </View>

        {/* زر الإرسال / الميكروفون الديناميكي */}
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
  header: { height: 95, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3d4b55', marginHorizontal: 10 },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  status: { color: '#8596a0', fontSize: 12 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 20 },
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
