import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function NavigationTabs({ currentTab, setCurrentTab }) {
  // تعريف التبويبات مع الأيقونات الخاصة بها
  const tabs = [
    { id: 'Calls', label: 'المكالمات', icon: 'phone-outline', activeIcon: 'phone' },
    { id: 'Updates', label: 'المستجدات', icon: 'circle-slice-8', type: 'material' },
    { id: 'Chats', label: 'الدردشات', icon: 'chatbox-ellipses-outline', activeIcon: 'chatbox-ellipses' },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        
        return (
          <TouchableOpacity 
            key={tab.id} 
            onPress={() => setCurrentTab(tab.id)} 
            style={[styles.tab, isActive && styles.activeTab]}
            activeOpacity={0.7}
          >
            {/* إضافة أيقونات لجعل الواجهة أكثر احترافية */}
            {tab.type === 'material' ? (
              <MaterialCommunityIcons 
                name={tab.icon} 
                size={24} 
                color={isActive ? '#00a884' : '#8596a0'} 
              />
            ) : (
              <Ionicons 
                name={isActive ? tab.activeIcon : tab.icon} 
                size={24} 
                color={isActive ? '#00a884' : '#8596a0'} 
              />
            )}
            
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { 
    flexDirection: 'row-reverse', 
    height: 65, // زيادة الارتفاع قليلاً لتناسب الأيقونات
    backgroundColor: '#1f2c34', // تغيير اللون ليتناسب مع هيدر واتساب الداكن
    borderTopWidth: 0.5, 
    borderTopColor: '#2f3b44',
    paddingBottom: Platform.OS === 'ios' ? 15 : 5, // معالجة الحافة السفلية للآيفون
  },
  tab: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 8
  },
  activeTab: { 
    // يمكن إضافة خط علوي أو سفلي هنا
  },
  tabText: { 
    color: '#8596a0', 
    fontSize: 12, 
    marginTop: 4,
    fontWeight: '500' 
  },
  activeTabText: { 
    color: '#00a884',
    fontWeight: 'bold' 
  }
});
