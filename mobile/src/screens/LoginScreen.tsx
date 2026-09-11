import React, { useState, useEffect } from 'react';
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
  const [password, setPassword] = useState('');
  const [edgeKey, setEdgeKey] = useState(MobileAPI.getEdgeKey() || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<Array<{ role: string; username: string; default_password?: string }>>([]);

  // In development mode, load available demo accounts dynamically from backend
  useEffect(() => {
    if (__DEV__) {
      MobileAPI.getDemoAccounts()
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            setDemoAccounts(accounts);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogin = async () => {
    // Intentional empty field validation
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both operator ID and account password.');
      setIsPermissionDenied(false);
      setIsOffline(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setIsPermissionDenied(false);
    setIsOffline(false);

    try {
      const session = await MobileAPI.login(username.trim(), password.trim(), edgeKey.trim());
      onLoginSuccess(session);
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      const lower = msg.toLowerCase();

      // Check if network / offline failure
      if (lower.includes('network') || lower.includes('fetch') || lower.includes('unreachable') || lower.includes('failed to connect') || lower.includes('econnrefused')) {
        setIsOffline(true);
        setErrorMessage(`Backend Unreachable: Could not connect to ${MobileAPI.getBaseUrl()}. Check WiFi/Cellular or emulator bridge.`);
      } else if (lower.includes('incorrect') || lower.includes('unauthorized') || lower.includes('permission') || lower.includes('401') || lower.includes('403') || lower.includes('forbidden')) {
        setIsPermissionDenied(true);
        setErrorMessage(`Permission Denied: Credentials rejected or role unauthorized for mobile probe operations.`);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (u: string, p?: string) => {
    setUsername(u);
    if (p) setPassword(p);
    setErrorMessage('');
    setIsPermissionDenied(false);
    setIsOffline(false);
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
          placeholder="operator@bmtc.gov.in"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter account password"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>Edge Device Key (Optional)</Text>
        <TextInput
          style={styles.input}
          value={edgeKey}
          onChangeText={setEdgeKey}
          autoCapitalize="none"
          placeholder="Enter Edge Device API Key (Optional)"
          placeholderTextColor="#64748b"
        />

        {/* Intentional Error / Permission-Denied / Offline State Presentation */}
        {Boolean(errorMessage) && (
          <View
            style={[
              styles.errorBanner,
              isPermissionDenied && styles.permissionDeniedBanner,
              isOffline && styles.offlineBanner,
            ]}
          >
            <Text style={styles.errorIcon}>
              {isOffline ? '📡' : (isPermissionDenied ? '🚫' : '⚠️')}
            </Text>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Intentional Offline Retry State */}
        {isOffline && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.retryButtonText}>🔄 RETRY CONNECTION</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.loginButtonText}>AUTHENTICATING SENSOR UNIT...</Text>
            </View>
          ) : (
            <Text style={styles.loginButtonText}>AUTHENTICATE SENSOR UNIT</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Demo Credentials Buttons (Dev environment only, dynamically injected from dev backend) */}
      {Boolean(__DEV__) && demoAccounts.length > 0 && (
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Quick Select Role (DEV Fixture Only):</Text>
          <View style={styles.demoButtons}>
            {demoAccounts
              .filter((a) => a.role === 'TRANSPORT_OPERATOR' || a.role === 'FIELD_ENGINEER')
              .map((acct) => (
                <TouchableOpacity
                  key={acct.role}
                  style={styles.demoChip}
                  onPress={() => selectDemoAccount(acct.username, acct.default_password)}
                >
                  <Text style={styles.demoChipText}>
                    {acct.role === 'TRANSPORT_OPERATOR' ? 'BMTC Operator' : 'BBMP Field Eng'}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}
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
    minHeight: 44,
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  permissionDeniedBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
  },
  offlineBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  errorIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    color: '#f8fafc',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#64748b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 44,
    minWidth: 44,
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  loginButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 44,
    minWidth: 44,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoChipText: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
