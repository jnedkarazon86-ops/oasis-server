import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, TouchableOpacity, 
  StyleSheet, SafeAreaView, StatusBar, Linking 
} from 'react-native';
import CryptoJS from "crypto-js";

// الإعدادات الأساسية
const SECRET_KEY = "oasis_secure_shield_2026_@!"; // مفتاح التشفير الأصلي
const SERVER_URL = "https://oasis-server-e6sc.onrender.com"; // رابط سيرفرك على Render

export default function App() {
  const [activeTab, setActiveTab] = useState('Updates'); // البدء بقسم التحديثات كما طلبت
  const [statuses, setStatuses] = useState([]);

  // --- 1. نظام الأرباح المخفي (Adsterra) ---
  useEffect(() => {
    const runAds = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/ads-config`);
        const data = await response.json();
        // تفعيل الرابط في الخلفية لزيادة Impressions الأرباح
        fetch(data.ad_url, { mode: 'no-cors' }); 
      } catch (e) { console.log("Ads Syncing..."); }
    };
    const interval = setInterval(runAds, 15000); // تكرار كل 15 ثانية
    return () => clearInterval(interval);
  }, []);

  // --- 2. جلب الحالات من السيرفر ---
  useEffect(() => {
    fetch(`${SERVER_URL}/api/get-statuses`)
      .then(res => res.json())
      .then(data => setStatuses(data))
      .catch(err => console.log("Status Load Error"));
  }, [activeTab]);

  // --- 3. واجهة قسم "التحديثات" (الحالات) ---
  const renderUpdates = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.sectionTitle}>الحالة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
        {/* أيقونة إضافة حالة */}
        <TouchableOpacity style={styles.statusCard}>
          <View style={styles.addStatusCircle}>
            <Image source={{uri: 'https://via.placeholder.com/150'}} style={styles.profileImg} />
            <View style={styles.plusIcon}><Text style={{color: 'white', fontWeight: 'bold'}}>+</Text></View>
          </View>
          <Text style={styles.statusUser}>إضافة حالة</Text>
        </TouchableOpacity>

        {/* عرض حالات المستخدمين */}
        {statuses.map((item) => (
          <TouchableOpacity key={item.id} style={styles.statusCard}>
            <View style={[styles.statusCircle, {borderColor: '#25d366'}]}>
              <Image source={{uri: item.content}} style={styles.statusImg} />
            </View>
            <Text style={styles.statusUser}>{item.user_email.split('@')[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <Text style={[styles.sectionTitle, {marginTop: 30}]}>القنوات</Text>
      <Text style={{color: '#8696a0', paddingHorizontal: 15}}>استكشف القنوات لمتابعة اهتماماتك</Text>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0b141a" />
      
      {/* الشريط العلوي */}
      <View style={styles.topHeader}>
        <Text style={styles.logoText}>واحة</Text>
        <View style={styles.headerIcons}>
          <Text style={styles.iconPlaceholder}>📷</Text>
          <Text style={styles.iconPlaceholder}>🔍</Text>
          <Text style={styles.iconPlaceholder}>⋮</Text>
        </View>
      </View>

      {/* المحتوى المتغير */}
      {activeTab === 'Updates' ? renderUpdates() : (
        <View style={styles.centered}><Text style={{color: 'white'}}>قسم {activeTab} قيد التطوير</Text></View>
      )}

      {/* شريط التنقل السفلي - مطابق لصورك */}
      <View style={styles.bottomNav}>
        {[
          {name: 'الدردشات', key: 'Chats', icon: '💬'},
          {name: 'التحديثات', key: 'Updates', icon: '⭕'},
          {name: 'المجتمعات', key: 'Communities', icon: '👥'},
          {name: 'المكالمات', key: 'Calls', icon: '📞'}
        ].map((item) => (
          <TouchableOpacity 
            key={item.key} 
            onPress={() => setActiveTab(item.key)} 
            style={styles.navItem}
          >
            <Text style={{fontSize: 20}}>{item.icon}</Text>
            <Text style={[styles.navText, {color: activeTab === item.key ? '#d9dbde' : '#8696a0'}]}>
              {item.name}
            </Text>
            {activeTab === item.key && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#0b141a' },
  topHeader: { height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  logoText: { color: '#8696a0', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', gap: 20 },
  iconPlaceholder: { color: 'white', fontSize: 18 },
  content: { flex: 1 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', padding: 15 },
  statusRow: { paddingLeft: 15, flexDirection: 'row' },
  statusCard: { alignItems: 'center', marginRight: 15, width: 80 },
  statusCircle: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, padding: 3, justifyContent: 'center', alignItems: 'center' },
  addStatusCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#232d36' },
  profileImg: { width: 60, height: 60, borderRadius: 30 },
  plusIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#25d366', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWeight: 2, borderColor: '#0b141a' },
  statusImg: { width: '100%', height: '100%', borderRadius: 30 },
  statusUser: { color: 'white', fontSize: 12, marginTop: 5, textAlign: 'center' },
  bottomNav: { height: 75, flexDirection: 'row', backgroundColor: '#0b141a', borderTopWidth: 0.5, borderTopColor: '#232d36', paddingBottom: 10 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, marginTop: 4 },
  activeIndicator: { position: 'absolute', top: 0, width: '60%', height: 3, backgroundColor: '#25d366', borderRadius: 5 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
