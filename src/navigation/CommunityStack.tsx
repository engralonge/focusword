import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '@/navigation/types';
import { CommunityScreen } from '@/screens/community/CommunityScreen';
import { CommunityPostScreen } from '@/screens/community/CommunityPostScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityStack() {
  const { isDark } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
      }}
    >
      <Stack.Screen name="CommunityMain" component={CommunityScreen} />
      <Stack.Screen
        name="CommunityPost"
        component={CommunityPostScreen}
        options={{ headerShown: true, title: 'Discussion' }}
      />
    </Stack.Navigator>
  );
}
