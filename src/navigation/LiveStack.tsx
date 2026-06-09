import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LiveStackParamList } from '@/navigation/types';
import { LiveHomeScreen } from '@/screens/home/LiveHomeScreen';
import { CreateStreamScreen } from '@/screens/home/CreateStreamScreen';
import { LiveStreamScreen } from '@/screens/home/LiveStreamScreen';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<LiveStackParamList>();

export function LiveStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.backgroundDark },
        headerTintColor: palette.brandLight,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: palette.backgroundDark },
      }}
    >
      <Stack.Screen name="LiveHome" component={LiveHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateStream" component={CreateStreamScreen} options={{ title: 'Host a study' }} />
      <Stack.Screen name="LiveStream" component={LiveStreamScreen} options={{ title: 'Live study' }} />
    </Stack.Navigator>
  );
}
