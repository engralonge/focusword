import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { SignInScreen } from '@/screens/auth/SignInScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { UpdatePasswordScreen } from '@/screens/auth/UpdatePasswordScreen';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const { isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight,
        },
        headerTintColor: isDark ? palette.brandLight : palette.brandDark,
        contentStyle: {
          backgroundColor: isDark ? palette.backgroundDark : palette.backgroundLight,
        },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign in' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create account' }} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Reset password' }}
      />
      <Stack.Screen
        name="UpdatePassword"
        component={UpdatePasswordScreen}
        options={{ title: 'Choose a new password' }}
      />
    </Stack.Navigator>
  );
}
