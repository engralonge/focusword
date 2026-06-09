import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@/navigation/types';
import { LiveHomeScreen } from '@/screens/home/LiveHomeScreen';
import { CreateStreamScreen } from '@/screens/home/CreateStreamScreen';
import { LiveStreamScreen } from '@/screens/home/LiveStreamScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  const { isDark } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
        headerTintColor: isDark ? palette.brandLight : palette.brandDark,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
      }}
    >
      <Stack.Screen name="LiveHome" component={LiveHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CreateStream"
        component={CreateStreamScreen}
        options={{ title: 'Host a Study' }}
      />
      <Stack.Screen name="LiveStream" component={LiveStreamScreen} options={{ title: 'Live Study' }} />
    </Stack.Navigator>
  );
}
