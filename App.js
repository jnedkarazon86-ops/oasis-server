import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, TextInput, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

export default function App() {
  const [currentTab, setCurrentTab] = useState('Chats'); // Chats, Status, Calls, Settings
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState('');

  // واجهة الهيدر (العلوية)
  const renderHeader = () => (
    <View style={styles.header}>
      {!isSearching ? (
        <>
          <Text style={styles.headerTitle}>أوايسس</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}><Ionicons name="camera-outline" size={24} color="white" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearching(true)}><Ionicons name="search" size={24} color="white" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setCurrentTab('Settings')}><Ionicons name="ellipsis-vertical" size={24} color="white" /></TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.searchBarContainer}>
          <TouchableOpacity onPress={() => {setIsSearching(false); setSearchText('');}}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          <TextInput 
            style={styles.searchInput} 
            placeholder="بحث..." 
            placeholderTextColor="#ccc" 
            autoFocus 
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      )}
    </View>
  );

  // واجهة الإعدادات
  const renderSettings = () => (
    <ScrollView style={styles.container}>
      <View style={styles.settingsHeader}>
        <TouchableOpacity onPress={() => setCurrentTab('Chats')}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text style={styles.settingsTitle}>الإعدادات</Text>
      </View>
      <SettingItem icon="key" title="الحساب" sub="الخصوصية، الأمان، تغيير الرقم" />
      <SettingItem icon="chatbubble-ellipses" title="الدردشات" sub="المظهر، خلفيات الشاشة" />
      <SettingItem icon="notifications" title="الإشعارات" sub="نغمات الرسائل والمجموعات" />
      <SettingItem icon="data-usage" title="التخزين والبيانات" sub="التنزيل التلقائي، حجم الشبكة" type="material" />
      <SettingItem icon="help-circle" title="المساعدة" sub="مركز المساعدة، اتصل بنا" />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {currentTab !== 'Settings' && renderHeader()}

      <View style={{ flex: 1 }}>
        {currentTab === 'Chats' && (
          <View style={styles.centered}><Text style={styles.emptyText}>لا توجد مراسلات نصية بعد</Text></View>
        )}
        {currentTab === 'Status' && (
          <View style={styles.statusSection}>
            <View style={styles.myStatus}>
              <View style={styles.avatarLarge}><View style={styles.plusIcon}><Ionicons name="add" size={16} color="white" /></View></View>
              <View style={{marginLeft: 15}}><Text style={styles.nameText}>حالتي</Text><Text style={styles.subText}>انقر لإضافة حالة</Text></View>
            </View>
          </View>
        )}
        {currentTab === 'Calls' && (
          <View style={styles.centered}><Text style={styles.emptyText}>لا توجد مكالمات هاتفية أو فيديو</Text></View>
        )}
        {currentTab === 'Settings' && renderSettings()}
      </View>

      {/* الأزرار العائمة الديناميكية */}
      {currentTab === 'Chats' && (
        <TouchableOpacity style={styles.fab} onPress={() => alert('إضافة دردشة بإيميل')}><MaterialCommunityIcons name="message-plus" size={24} color="white" /></TouchableOpacity>
      )}
      {currentTab === 'Status' && (
        <View style={styles.fabColumn}>
          <TouchableOpacity style={styles.fabSmall}><MaterialCommunityIcons name="pencil" size={22} color="white" /></TouchableOpacity>
          <TouchableOpacity style={styles.fab}><Ionicons name="camera" size={26} color="white" /></TouchableOpacity>
        </View>
      )}
      {currentTab === 'Calls' && (
        <TouchableOpacity style={styles.fab}><MaterialCommunityIcons name="phone-plus" size={24} color="white" /></TouchableOpacity>
      )}

      {/* شريط التنقل السفلي */}
      <View style={styles.bottomNav}>
        <NavButton label="دردشات" icon="chatbubbles" active={currentTab === 'Chats'} onPress={() => setCurrentTab('Chats')} />
        <NavButton label="حالات" icon="aperture" active={currentTab === 'Status'} onPress={() => setCurrentTab('Status')} />
        <NavButton label="مكالمات" icon="call" active={currentTab === 'Calls'} onPress={() => setCurrentTab('Calls')} />
      </View>
    </View>
  );
}

// مكونات فرعية للكود
const SettingItem = ({ icon, title, sub, type }) => (
  <TouchableOpacity style={styles.settingItem}>
    {type === 'material' ? <MaterialCommunityIcons name={icon} size={24} color="#8596a0" /> : <Ionicons name={icon} size={24} color="#8596a0" />}
    <View style={{marginLeft: 20}}><Text style={styles.nameText}>{title}</Text><Text style={styles.subText}>{sub}</Text></View>
  </TouchableOpacity>
);

const NavButton = ({ label, icon, active, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Ionicons name={icon} size={24} color={active ? '#25D366' : '#8596a0'} />
    <Text style={{color: active ? '#25D366' : '#8596a0', fontSize: 12, marginTop: 4}}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121b22' },
  header: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 20 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginBottom: -5 },
  searchInput: { flex: 1, color: 'white', marginLeft: 15, fontSize: 18, borderBottomWidth: 0.5, borderBottomColor: '#25D366' },
  bottomNav: { height: 70, backgroundColor: '#1f2c34', flexDirection: 'row', borderTopWidth: 0.3, borderTopColor: '#233138' },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 90, right: 20, backgroundColor: '#25D366', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabColumn: { position: 'absolute', bottom: 90, right: 20, alignItems: 'center' },
  fabSmall: { backgroundColor: '#233138', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8596a0', fontSize: 16 },
  statusSection: { padding: 15 },
  myStatus: { flexDirection: 'row', alignItems: 'center' },
  avatarLarge: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#3d4b55' },
  plusIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#25D366', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#121b22' },
  nameText: { color: 'white', fontSize: 16, fontWeight: '600' },
  subText: { color: '#8596a0', fontSize: 14, marginTop: 2 },
  settingsHeader: { height: 100, backgroundColor: '#1f2c34', flexDirection: 'row', alignItems: 'flex-end', padding: 15 },
  settingsTitle: { color: 'white', fontSize: 20, marginLeft: 30, fontWeight: 'bold' },
  settingItem: { flexDirection: 'row', padding: 20, alignItems: 'center' }
});
