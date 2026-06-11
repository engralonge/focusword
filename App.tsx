import './global.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NavigationContainer,
  DarkTheme,
  type LinkingOptions,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/context/ThemeProvider';
import { AuthProvider } from '@/context/AuthProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { palette } from '@/constants/colors';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';

const darkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.brand,
    background: palette.backgroundDark,
    card: palette.surfaceDark,
    text: palette.brandLight,
    border: '#2D3748',
  },
};

const lightNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.brand,
    background: palette.backgroundDark,
    card: palette.surfaceDark,
    text: palette.foreground,
    border: palette.borderSubtle,
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'focusword://'],
  config: {
    screens: {
      Main: {
        screens: {
          Home: {
            screens: {
              HomeMain: '',
            },
          },
          Live: {
            screens: {
              LiveHome: 'live',
              CreateStream: 'live/new',
              LiveStream: 'live/:streamId',
              Replay: 'replay/:recordingId',
            },
          },
          Bible: 'bible',
          Prayer: 'prayer',
          Community: {
            screens: {
              CommunityMain: 'community',
              ActivityInbox: 'activity',
              CommunityPost: 'community/discussion',
            },
          },
          Profile: {
            screens: {
              ProfileMain: 'profile',
              CommunityPoints: 'profile/points',
              EditProfile: 'profile/edit',
              Settings: 'profile/settings',
            },
          },
        },
      },
      Auth: {
        screens: {
          SignIn: 'sign-in',
          SignUp: 'sign-up',
          ForgotPassword: 'forgot-password',
          UpdatePassword: 'update-password',
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;
    const response = await Notifications.getLastNotificationResponseAsync();
    const notificationUrl = response?.notification.request.content.data?.url;
    return typeof notificationUrl === 'string' ? notificationUrl : undefined;
  },
  subscribe(listener: (url: string) => void) {
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => listener(url));
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === 'string') listener(url);
      },
    );
    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },
};

function AppContent() {
  const { isDark } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer linking={linking} theme={isDark ? darkNavTheme : lightNavTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
