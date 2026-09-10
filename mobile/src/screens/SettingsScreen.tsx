import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MobileAPI } from '../services/api';

interface Props {
  busId: string;
  setBusId: (id: string) => void;
  routeId: string;
  setRouteId: (id: string) => void;
  cameraId: string;
  setCameraId: (id: string) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  busId,
  setBusId,
  routeId,
  setRouteId,
  cameraId,
  setCameraId,
}) => {
  const [serverUrl, setServerUrl] = useState(MobileAPI.getBaseUrl());
  const [edgeKey, setEdgeKey] = useState(MobileAPI.getEdgeKey());
  const [testStatus, setTestStatus] = useState<string>('');

  const handleSave = () => {
    MobileAPI.setBaseUrl(serverUrl);
    MobileAPI.setEdgeKey(edgeKey);
    setTestStatus('Settings saved successfully');
  };

  const handleTestConnection = async () => {
    setTestStatus('Testing connection to backend...');
    MobileAPI.setBaseUrl(serverUrl);
    const health = await MobileAPI.checkHealth();
    if (health.online) {
      setTestStatus(`✅ Connected: UrbanPulse API v${health.data?.version || '1.0'}`);
    } else {
      setTestStatus(`❌ Failed to reach ${serverUrl}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edge Device Configuration</Text>
      <Text style={styles.subtitle}>Calibrate host server, vehicle identity, and edge API key</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Backend Host URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://10.0.2.2:8001"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Use 10.0.2.2 for Android Emulator, or your LAN IP for physical device</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Edge Device Key (X-Edge-Device-Key)</Text>
        <TextInput
          style={styles.input}
          value={edgeKey}
          onChangeText={setEdgeKey}
          placeholder="edge_k8s_prod_key_77a94f"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Grants 300 req/min edge headroom without IP NAT collision</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Bus Vehicle ID</Text>
        <TextInput
          style={styles.input}
          value={busId}
          onChangeText={setBusId}
          placeholder="bus-01"
          placeholderTextColor="#64748b"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Route Corridor ID</Text>
        <TextInput
          style={styles.input}
          value={routeId}
          onChangeText={setRouteId}
          placeholder="route-1"
          placeholderTextColor="#64748b"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Camera Sensor ID</Text>
        <TextInput
          style={styles.input}
          value={cameraId}
          onChangeText={setCameraId}
          placeholder="cam-01-fwd"
          placeholderTextColor="#64748b"
        />
      </View>

      {testStatus ? <Text style={styles.statusText}>{testStatus}</Text> : null}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.testButton} onPress={handleTestConnection}>
          <Text style={styles.testButtonText}>TEST PING</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>SAVE CONFIG</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  hint: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 40,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  testButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
