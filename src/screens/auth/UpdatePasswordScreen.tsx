import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import { validatePasswordConfirmation } from '@/utils/auth';

export function UpdatePasswordScreen() {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    const validationError = validatePasswordConfirmation(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    const nextError = await setNewPassword(password);
    setLoading(false);
    if (nextError) {
      setError(nextError);
    }
  };

  return (
    <ScreenContainer scroll={false} contentClassName="px-4 justify-center flex-1">
      <Text variant="title">Choose a new password</Text>
      <View className="mt-6 gap-3">
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="New password"
        />
        <TextInput
          className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Confirm new password"
        />
      </View>
      {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
      <Button
        title={loading ? 'Updating...' : 'Update password'}
        className="mt-6"
        disabled={loading}
        onPress={() => void handleUpdate()}
      />
    </ScreenContainer>
  );
}
