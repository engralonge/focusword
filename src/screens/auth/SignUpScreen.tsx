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
import { palette } from '@/constants/colors';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const { signUp, resendConfirmation } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

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
    setConfirmationEmail(normalizedEmail);
    setMessage('Check your email to verify your account, then sign in.');
  };

  const handleResend = async () => {
    if (!confirmationEmail) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const nextError = await resendConfirmation(confirmationEmail);
    setLoading(false);
    if (nextError) {
      setError(nextError);
      return;
    }
    setMessage('A new confirmation email has been sent.');
  };

  return (
    <ScreenContainer contentClassName="px-6">
      <Text variant="label" className="mt-5">Join the family of faith</Text>
      <Text variant="title" className="mt-2">Create your account</Text>
      <Text variant="caption" className="mt-3 leading-5">
        Keep your reading journey, prayers, and community activity together.
      </Text>
      <View className="mt-6 gap-3">
        <TextInput
          className="bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
          placeholder="Display name"
          placeholderTextColor={palette.muted}
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          accessibilityLabel="Display name"
        />
        <TextInput
          className="bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
          placeholder="Email"
          placeholderTextColor={palette.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel="Email address"
        />
        <TextInput
          className="bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
          placeholder="Password"
          placeholderTextColor={palette.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Password"
        />
        <TextInput
          className="bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
          placeholder="Confirm password"
          placeholderTextColor={palette.muted}
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
      {confirmationEmail ? (
        <Button
          title={loading ? 'Sending...' : 'Resend confirmation email'}
          variant="secondary"
          className="mt-3"
          disabled={loading}
          onPress={() => void handleResend()}
        />
      ) : null}
      <Pressable className="mt-4 items-center" onPress={() => navigation.navigate('SignIn')}>
        <Text variant="caption">Already have an account? <Text className="text-brand-light">Sign in</Text></Text>
      </Pressable>
    </ScreenContainer>
  );
}
