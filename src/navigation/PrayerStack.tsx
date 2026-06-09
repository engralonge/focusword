import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PrayerStackParamList } from '@/navigation/types';
import { PrayerScreen } from '@/screens/prayer/PrayerScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<PrayerStackParamList>();

export function PrayerStack() {
  const { isDark } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
      }}
    >
      <Stack.Screen name="PrayerMain" component={PrayerScreen} />
    </Stack.Navigator>
  );
}