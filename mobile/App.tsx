import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LiveScanScreen } from './src/screens/LiveScanScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { UserSession } from './src/types';
import { MobileAPI } from './src/services/api';

interface DeviceConfigContextType {
  busId: string;
  setBusId: (id: string) => void;
  routeId: string;
  setRouteId: (id: string) => void;
  cameraId: string;
  setCameraId: (id: string) => void;
}

export const DeviceConfigContext = createContext<DeviceConfigContextType>({
  busId: 'bus-01',
  setBusId: () => {},
  routeId: 'route-1',
  setRouteId: () => {},
  cameraId: 'cam-01-fwd',
  setCameraId: () => {},
});

const Tab = createBottomTabNavigator();

function DashcamTabScreen({ navigation }: any) {
  const { busId, routeId, cameraId } = useContext(DeviceConfigContext);
  return (
    <LiveScanScreen
      busId={busId}
      routeId={routeId}
      cameraId={cameraId}
      onNavigateToHistory={() => navigation.navigate('Queue')}
    />
  );
}

function ConfigTabScreen() {
  const { busId, setBusId, routeId, setRouteId, cameraId, setCameraId } =
    useContext(DeviceConfigContext);
  return (
    <SettingsScreen
      busId={busId}
      setBusId={setBusId}
      routeId={routeId}
      setRouteId={setRouteId}
      cameraId={cameraId}
      setCameraId={setCameraId}
    />
  );
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Sensor identity state
  const [busId, setBusId] = useState('bus-01');
  const [routeId, setRouteId] = useState('route-1');
  const [cameraId, setCameraId] = useState('cam-01-fwd');

  useEffect(() => {
    async function restoreSession() {
      try {
        const initResult = await MobileAPI.init();
        if (initResult.session) {
          setSession(initResult.session);
        } else if (initResult.token) {
          setSession({
            token: initResult.token,
            username: 'operator@bmtc.gov.in',
            role: 'TRANSPORT_OPERATOR',
            fullName: 'BMTC Transit Operator',
          });
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    restoreSession();
  }, []);

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Initializing Edge Dashcam...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
          <LoginScreen onLoginSuccess={setSession} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <DeviceConfigContext.Provider
      value={{
        busId,
        setBusId,
        routeId,
        setRouteId,
        cameraId,
        setCameraId,
      }}
    >
      <SafeAreaProvider>
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
              onPress={async () => {
                await MobileAPI.setToken(null);
                setSession(null);
              }}
            >
              <Text style={styles.logoutText}>DISCONNECT</Text>
            </TouchableOpacity>
          </View>

          {/* React Navigation Bottom Tab Navigator */}
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#38bdf8',
                tabBarInactiveTintColor: '#64748b',
                tabBarLabelStyle: styles.tabLabel,
              }}
            >
              <Tab.Screen
                name="Dashcam"
                component={DashcamTabScreen}
                options={{
                  tabBarLabel: '📹 DASHCAM',
                }}
              />

              <Tab.Screen
                name="Queue"
                component={HistoryScreen}
                options={{
                  tabBarLabel: '📦 QUEUE',
                }}
              />

              <Tab.Screen
                name="Config"
                component={ConfigTabScreen}
                options={{
                  tabBarLabel: '⚙️ CONFIG',
                }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </DeviceConfigContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  appName: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  appUser: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabBar: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: 6,
    paddingTop: 6,
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
