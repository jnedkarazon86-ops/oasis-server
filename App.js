import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Linking, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  // 📞 وظيفة الاتصال الهاتفي
  const makeCall = (type) => {
    const phoneNumber = 'tel:0900000000'; // رقم افتراضي
    Alert.alert('بدء اتصال', `هل تريد إجراء مكالمة ${type === 'video' ? 'فيديو' : 'صوتية'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'اتصال', onPress: () => Linking.openURL(phoneNumber) }
    ]);
  };

  // ✉️ وظيفة إرسال الرسالة
  const sendMessage = () => {
    if (message.trim().length > 0) {
      setChatMessages([...chatMessages, { id: Date.now().toString(), text: message, time: '10:00 م' }]);
      setMessage(''); // تفريغ الحقل بعد الإرسال
    }
  };

  // 🎙️ وظيفة تسجيل الصوت (واجهة تفاعلية)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // هنا يبدأ التسجيل الحقيقي مستقبلاً
    } else {
      Alert.alert("تم الحفظ", "تم تسجيل المقطع الصوتي بنجاح");
    }
  };

  return (
    <View style={styles.container}>
      {/* هيدر الدردشة مع أزرار الاتصال */}
      <View style={styles.chatHeader}>
        <View style={styles.userInfo}>
          <Ionicons name="arrow-forward" size={24} color="white" />
          <View style={styles.avatarSmall} />
          <Text style={styles.userName}>صديقي</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => makeCall('video')} style={styles.iconSpacing}>
            <Ionicons name="videocam" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => makeCall('voice')} style={styles.iconSpacing}>
            <Ionicons name="call" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* منطقة الرسائل */}
      <FlatList 
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.msgBubble}><Text style={styles.msgText}>{item.text}</Text></View>
        )}
        style={styles.chatArea}
      />

      {/* شريط الإدخال السفلي (رسائل + صوت) */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity><Ionicons name="happy-outline" size={24} color="#8596a0" /></TouchableOpacity>
          <TextInput 
            style={styles.textInput} 
            placeholder="الرسالة" 
            placeholderTextColor="#8596a0"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={styles.iconSpacing}><Ionicons name="attach" size={24} color="#8596a0" style={{transform: [{rotate: '45deg'}]}} /></TouchableOpacity>
          {!message && <TouchableOpacity><Ionicons name="camera" size={24} color="#8596a0" /></TouchableOpacity>}
        </View>

        {/* زر الإرسال أو الميكروفون الديناميكي */}
        <TouchableOpacity 
          style={[styles.actionButton, isRecording && {backgroundColor: 'red'}]} 
          onPress={message ? sendMessage : toggleRecording}
        >
          {message ? (
            <MaterialCommunityIcons name="send" size={24} color="white" style={{transform: [{scaleX: -1}]}} />
          ) : (
            <MaterialCommunityIcons name={isRecording ? "stop" : "microphone"} size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  chatHeader: { height: 90, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#3d4b55', marginHorizontal: 10 },
  userName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', marginBottom: 5 },
  iconSpacing: { marginLeft: 20 },
  chatArea: { flex: 1, padding: 10 },
  msgBubble: { alignSelf: 'flex-end', backgroundColor: '#005c4b', padding: 10, borderRadius: 10, marginBottom: 5, maxWidth: '80%' },
  msgText: { color: 'white', fontSize: 16 },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#1f2c34', borderRadius: 25, paddingHorizontal: 15, alignItems: 'center', height: 45 },
  textInput: { flex: 1, color: 'white', marginHorizontal: 10, fontSize: 16, textAlign: 'right' },
  actionButton: { width: 45, height: 45, backgroundColor: '#25D366', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
});
