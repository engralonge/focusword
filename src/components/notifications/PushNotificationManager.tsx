import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthProvider';
import { registerPushNotifications } from '@/services/notifications/notificationService';
import { reportError } from '@/services/observability/errorReporter';

export function PushNotificationManager() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return undefined;

    const register = () => {
      void registerPushNotifications().catch((error: unknown) => {
        void reportError(
          error instanceof Error ? error : new Error('Push registration failed'),
          { feature: 'notifications', operation: 'register_push_token' },
        );
      });
    };
    register();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') register();
    });
    return () => subscription.remove();
  }, [session?.user.id]);

  return null;
}
