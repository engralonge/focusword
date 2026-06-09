import { useState } from 'react';
import { TextInput } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEmail, validateEmail } from '@/utils/auth';

export function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateEmail(normalizedEmail);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    const nextError = await resetPassword(normalizedEmail);
    setLoading(false);
    if (nextError) {
      setError(nextError);
      return;
    }
    setSent(true);
  };

  return (
    <ScreenContainer scroll={false} contentClassName="px-4 justify-center flex-1">
      <Text variant="title">Reset your password</Text>
      <Text variant="caption" className="mt-2">
        We will send a secure password reset link to your email.
      </Text>
      <TextInput
        className="mt-6 bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        accessibilityLabel="Email address"
      />
      {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
      {sent ? <Text className="text-green-600 mt-3">Check your inbox for the reset link.</Text> : null}
      <Button
        title={loading ? 'Sending...' : 'Send reset link'}
        className="mt-6"
        disabled={loading || sent}
        onPress={() => void handleReset()}
      />
    </ScreenContainer>
  );
}
