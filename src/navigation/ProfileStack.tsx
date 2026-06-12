import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { CommunityPointsScreen } from '@/screens/profile/CommunityPointsScreen';
import { BlockedUsersScreen } from '@/screens/profile/BlockedUsersScreen';
import { ModerationScreen } from '@/screens/profile/ModerationScreen';
import { NotificationSettingsScreen } from '@/screens/profile/NotificationSettingsScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { isDark } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
        headerTintColor: isDark ? palette.brandLight : palette.brandDark,
        contentStyle: { backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CommunityPoints"
        component={CommunityPointsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: 'Blocked accounts' }}
      />
      <Stack.Screen
        name="Moderation"
        component={ModerationScreen}
        options={{ title: 'Moderation' }}
      />
    </Stack.Navigator>
  );
}
