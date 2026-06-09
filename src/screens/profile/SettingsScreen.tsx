import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import { config, isConfiguredPublicUrl } from '@/constants/config';
import { palette } from '@/constants/colors';

export function SettingsScreen() {
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
    <ScreenContainer contentClassName="px-5">
      <Card className="mt-3 rounded-3xl border-brand/20 bg-brand/[0.05] p-5">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-brand/12 items-center justify-center">
            <Ionicons name="moon-outline" size={21} color={palette.brandLight} />
          </View>
          <View className="flex-1">
            <Text variant="subtitle">Sanctuary appearance</Text>
            <Text variant="caption" className="mt-1 leading-5">
              A calm, low-light reading environment designed for Scripture.
            </Text>
          </View>
        </View>
      </Card>

      {legalLinks.length ? (
        <View className="mt-6 rounded-2xl border border-border overflow-hidden bg-surface-elevated/80">
          {legalLinks.map((item) => (
            <Pressable
              key={item.label}
              className="px-4 py-4 border-b border-border-subtle"
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
