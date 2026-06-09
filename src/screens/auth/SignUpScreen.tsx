import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import type { AuthStackParamList } from '@/navigation/types';
import {
  normalizeEmail,
  validateEmail,
  validatePasswordConfirmation,
  validateProfile,
} from '@/utils/auth';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const name = displayName.trim();
    const normalizedEmail = normalizeEmail(email);
    const validationError =
      validateProfile(name) ??
      validateEmail(normalizedEmail) ??
      validatePasswordConfirmation(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    const nextError = await signUp(name, normalizedEmail, password);
    setLoading(false);
    if (nextError) {
      setError(nextError);
      return;
    }
    setMessage('Check your email to verify your account, then sign in.');
  };

  return (
    <ScreenContainer contentClassName="px-4">
      <Text variant="title" className="mt-4">Create your account</Text>
      <Text variant="caption" className="mt-2">
        Join live studies, post prayer requests, and keep your study activity synced.
      </Text>
      <View className="mt-6 gap-3">
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          accessibilityLabel="Display name"
        />
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel="Email address"
        />
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Password"
        />
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Confirm password"
        />
      </View>
      {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
      {message ? <Text className="text-green-600 mt-3">{message}</Text> : null}
      <Button
        title={loading ? 'Creating account...' : 'Create account'}
        className="mt-6"
        disabled={loading}
        onPress={() => void handleSignUp()}
      />
      <Pressable className="mt-4 items-center" onPress={() => navigation.navigate('SignIn')}>
        <Text variant="caption">Already have an account? Sign in</Text>
      </Pressable>
    </ScreenContainer>
  );
}
