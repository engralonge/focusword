import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import type { AuthStackParamList } from '@/navigation/types';
import { normalizeEmail, validateEmail, validatePassword } from '@/utils/auth';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    const validationError = validateEmail(email) ?? validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    const nextError = await signIn(normalizeEmail(email), password);
    setLoading(false);
    if (nextError) {
      setError(nextError);
    }
  };

  return (
    <ScreenContainer scroll={false} contentClassName="px-4 justify-center flex-1">
      <Text variant="title">Sign in</Text>
      <View className="mt-6 gap-3">
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email address"
        />
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Password"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />
      </View>
      {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
      <Button
        title={loading ? 'Signing in...' : 'Sign in'}
        className="mt-6"
        disabled={loading}
        onPress={() => void handleSignIn()}
      />
      <Pressable className="mt-4 items-center" onPress={() => navigation.navigate('ForgotPassword')}>
        <Text className="text-brand font-medium">Forgot password?</Text>
      </Pressable>
      <Pressable className="mt-3 items-center" onPress={() => navigation.navigate('SignUp')}>
        <Text variant="caption">New to FocusWord? Create an account</Text>
      </Pressable>
    </ScreenContainer>
  );
}
