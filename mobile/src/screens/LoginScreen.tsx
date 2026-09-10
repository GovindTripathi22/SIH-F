import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MobileAPI } from '../services/api';
import { UserSession } from '../types';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('operator@bmtc.gov.in');
  const [password, setPassword] = useState('Operator@BMTC2026');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const session = await MobileAPI.login(username, password);
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandHeader}>
        <Text style={styles.brandTitle}>UrbanPulse</Text>
        <Text style={styles.brandSubtitle}>Mobile Edge Dashcam Probe</Text>
        <Text style={styles.badge}>SIH26124 • BEL</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Operator ID / Email</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#64748b"
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>AUTHENTICATE SENSOR UNIT</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Demo Credentials Buttons */}
      <View style={styles.demoSection}>
        <Text style={styles.demoTitle}>Quick Select Role:</Text>
        <View style={styles.demoButtons}>
          <TouchableOpacity
            style={styles.demoChip}
            onPress={() => selectDemoAccount('operator@bmtc.gov.in', 'Operator@BMTC2026')}
          >
            <Text style={styles.demoChipText}>BMTC Fleet Operator</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoChip}
            onPress={() => selectDemoAccount('field@bbmp.gov.in', 'Field@BBMP2026')}
          >
            <Text style={styles.demoChipText}>BBMP Field Engineer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    padding: 24,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    color: '#38bdf8',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#0f172a',
    color: '#0284c7',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 14,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  demoSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  demoTitle: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 8,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  demoChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoChipText: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
