import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { config, isSupabaseConfigured } from '@/constants/config';

let client: SupabaseClient | null = null;
let refreshLifecycleConfigured = false;

const MigratingSessionStorage = {
  async getItem(key: string) {
    const current = await AsyncStorage.getItem(key);
    if (current || Platform.OS === 'web') return current;
    try {
      const legacy = await SecureStore.getItemAsync(key);
      if (legacy) {
        await AsyncStorage.setItem(key, legacy);
        await SecureStore.deleteItemAsync(key);
      }
      return legacy;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
    }
  },
};

function configureRefreshLifecycle(supabase: SupabaseClient) {
  if (refreshLifecycleConfigured || Platform.OS === 'web') {
    return;
  }
  refreshLifecycleConfigured = true;
  if (AppState.currentState === 'active') {
    supabase.auth.startAutoRefresh();
  }
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        storage: MigratingSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    });
    configureRefreshLifecycle(client);
  }
  return client;
}
