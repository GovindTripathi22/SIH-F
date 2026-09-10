import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LiveScanScreen } from './src/screens/LiveScanScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { UserSession } from './src/types';
import { MobileAPI } from './src/services/api';

type Tab = 'SCAN' | 'HISTORY' | 'SETTINGS' | 'ACCOUNT';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('SCAN');
  const [session, setSession] = useState<UserSession | null>(null);

  // Sensor identity state
  const [busId, setBusId] = useState('bus-01');
  const [routeId, setRouteId] = useState('route-1');
  const [cameraId, setCameraId] = useState('cam-01-fwd');

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
        <LoginScreen onLoginSuccess={setSession} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />

      {/* App Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>UrbanPulse Edge</Text>
          <Text style={styles.appUser}>
            {session.fullName} ({session.role})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            MobileAPI.setToken(null);
            setSession(null);
          }}
        >
          <Text style={styles.logoutText}>DISCONNECT</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'SCAN' && (
          <LiveScanScreen
            busId={busId}
            routeId={routeId}
            cameraId={cameraId}
            onNavigateToHistory={() => setActiveTab('HISTORY')}
          />
        )}
        {activeTab === 'HISTORY' && <HistoryScreen />}
        {activeTab === 'SETTINGS' && (
          <SettingsScreen
            busId={busId}
            setBusId={setBusId}
            routeId={routeId}
            setRouteId={setRouteId}
            cameraId={cameraId}
            setCameraId={setCameraId}
          />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'SCAN' && styles.tabItemActive]}
          onPress={() => setActiveTab('SCAN')}
        >
          <Text style={[styles.tabLabel, activeTab === 'SCAN' && styles.tabLabelActive]}>
            📹 DASHCAM
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
          onPress={() => setActiveTab('HISTORY')}
        >
          <Text style={[styles.tabLabel, activeTab === 'HISTORY' && styles.tabLabelActive]}>
            📦 QUEUE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'SETTINGS' && styles.tabItemActive]}
          onPress={() => setActiveTab('SETTINGS')}
        >
          <Text style={[styles.tabLabel, activeTab === 'SETTINGS' && styles.tabLabelActive]}>
            ⚙️ CONFIG
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0e1321',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  appName: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  appUser: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0e1321',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 10,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#38bdf8',
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#38bdf8',
  },
});
