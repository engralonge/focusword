import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import type { RootStackParamList } from '@/navigation/types';
import { TabNavigator } from '@/navigation/TabNavigator';
import { AuthStack } from '@/navigation/AuthStack';
import { useAuth } from '@/context/AuthProvider';
import { Text } from '@/components/ui/Text';
import { getConfigurationError } from '@/constants/config';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const configurationError = getConfigurationError();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background">
        <ActivityIndicator color={palette.brand} />
        <Text variant="caption" className="mt-3">Starting Citizens Bible Community...</Text>
      </View>
    );
  }

  if (configurationError) {
    return (
      <View className="flex-1 justify-center px-6 bg-background-light dark:bg-background">
        <Text variant="title">Configuration required</Text>
        <Text variant="body" className="mt-3">{configurationError}</Text>
        <Text variant="caption" className="mt-3">
          Copy .env.example to .env, add your project values, and restart Expo.
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session && !isPasswordRecovery ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthStack}
          initialParams={isPasswordRecovery ? { screen: 'UpdatePassword' } : undefined}
        />
      )}
    </Stack.Navigator>
  );
}
