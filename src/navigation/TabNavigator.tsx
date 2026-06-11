import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '@/navigation/types';
import { HomeStack } from '@/navigation/HomeStack';
import { LiveStack } from '@/navigation/LiveStack';
import { BibleStack } from '@/navigation/BibleStack';
import { PrayerStack } from '@/navigation/PrayerStack';
import { CommunityStack } from '@/navigation/CommunityStack';
import { ProfileStack } from '@/navigation/ProfileStack';
import { useTheme } from '@/context/ThemeProvider';
import { getTabBarColors, palette } from '@/constants/colors';
const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcons: Record<keyof MainTabParamList, { focused: TabIconName; unfocused: TabIconName }> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Live: { focused: 'radio', unfocused: 'radio-outline' },
  Bible: { focused: 'book', unfocused: 'book-outline' },
  Prayer: { focused: 'heart', unfocused: 'heart-outline' },
  Community: { focused: 'notifications', unfocused: 'notifications-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

export function TabNavigator() {
  const { isDark } = useTheme();
  const tabColors = getTabBarColors(isDark);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name];
          const name = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: tabColors.active,
        tabBarInactiveTintColor: tabColors.inactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: tabColors.background,
          borderTopColor: tabColors.border,
          borderTopWidth: 1,
          height: 68,
          paddingHorizontal: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Live" component={LiveStack} />
      <Tab.Screen name="Bible" component={BibleStack} />
      <Tab.Screen name="Prayer" component={PrayerStack} />
      <Tab.Screen
        name="Community"
        component={CommunityStack}
        options={{ tabBarLabel: 'Activity' }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
