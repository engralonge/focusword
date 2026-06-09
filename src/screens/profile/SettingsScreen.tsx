import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/context/ThemeProvider';
import { useAuth } from '@/context/AuthProvider';
import type { ThemeMode } from '@/types';
import { cn } from '@/utils/cn';
import { config, isConfiguredPublicUrl } from '@/constants/config';

const modes: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const { mode, setMode } = useTheme();
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDeletion = () => {
    Alert.alert(
      'Delete account permanently?',
      'Your profile, studies, notes, posts, prayers, and chat history will be removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            setError(null);
            void deleteAccount().then((nextError) => {
              setError(nextError);
              setDeleting(false);
            });
          },
        },
      ],
    );
  };

  const legalLinks = [
    { label: 'Privacy policy', url: config.legal.privacyPolicyUrl },
    { label: 'Terms of use', url: config.legal.termsUrl },
    { label: 'Support', url: config.legal.supportUrl },
  ].filter((item) => isConfiguredPublicUrl(item.url));

  return (
    <ScreenContainer contentClassName="px-4">
      <Card className="mt-2">
        <Text variant="subtitle">Appearance</Text>
        <Text variant="caption" className="mt-1 mb-3">Choose light, dark, or match system</Text>
        <View className="flex-row gap-2">
          {modes.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setMode(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === item.value }}
              className={cn(
                'flex-1 py-3 rounded-lg items-center border',
                mode === item.value
                  ? 'bg-brand border-brand'
                  : 'bg-surface-light dark:bg-surface border-black/10 dark:border-white/10',
              )}
            >
              <Text className={cn('font-medium', mode === item.value && 'text-background')}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {legalLinks.length ? (
        <View className="mt-6 border-y border-black/5 dark:border-white/10">
          {legalLinks.map((item) => (
            <Pressable
              key={item.label}
              className="py-4 border-b border-black/5 dark:border-white/10"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(item.url)}
            >
              <Text>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="mt-8">
        <Text variant="subtitle">Account</Text>
        <Text variant="caption" className="mt-1">
          Permanently remove your account and all associated data.
        </Text>
        {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
        <Button
          title={deleting ? 'Deleting...' : 'Delete account'}
          variant="danger"
          className="mt-4"
          disabled={deleting}
          onPress={confirmDeletion}
        />
      </View>
    </ScreenContainer>
  );
}
