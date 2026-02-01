import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function NavigationTabs({ currentTab, setCurrentTab }) {
  const tabs = ['Calls', 'Updates', 'Chats'];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity key={tab} onPress={() => setCurrentTab(tab)} style={[styles.tab, currentTab === tab && styles.activeTab]}>
          <Text style={[styles.tabText, currentTab === tab && styles.activeTabText]}>{tab === 'Chats' ? 'الدردشات' : tab === 'Updates' ? 'المستجدات' : 'المكالمات'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row-reverse', height: 50, backgroundColor: '#0b141a', borderBottomWidth: 1, borderBottomColor: '#1f2c34' },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#00a884' },
  tabText: { color: '#8596a0', fontWeight: 'bold' },
  activeTabText: { color: '#00a884' }
});
