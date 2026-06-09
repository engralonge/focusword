import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BibleStackParamList } from '@/navigation/types';
import { BibleScreen } from '@/screens/bible/BibleScreen';
import { BibleReaderScreen } from '@/screens/bible/BibleReaderScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<BibleStackParamList>();

export function BibleStack() {
  const { isDark } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
        headerTintColor: isDark ? palette.brandLight : palette.brandDark,
        contentStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
      }}
    >
      <Stack.Screen name="BibleMain" component={BibleScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="BibleReader"
        component={BibleReaderScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PassageReader"
        component={BibleReaderScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}