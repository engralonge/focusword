import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import type { ProfileStackParamList } from '@/navigation/types';
import { validateProfile } from '@/utils/auth';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

export function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(session?.user.displayName ?? '');
  const [bio, setBio] = useState(session?.user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const validationError = validateProfile(displayName, bio);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    const nextError = await updateProfile(displayName, bio);
    setLoading(false);
    if (nextError) {
      setError(nextError);
      return;
    }
    navigation.goBack();
  };

  return (
    <ScreenContainer scroll={false} contentClassName="px-4">
      <View className="mt-4 gap-4">
        <View>
          <Text variant="label" className="mb-2">Display name</Text>
          <TextInput
            className="bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={80}
            autoComplete="name"
            accessibilityLabel="Display name"
          />
        </View>
        <View>
          <Text variant="label" className="mb-2">Bio</Text>
          <TextInput
            className="min-h-28 bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
            value={bio}
            onChangeText={setBio}
            placeholder="A little about you"
            maxLength={280}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Profile bio"
          />
          <Text variant="caption" className="mt-1 text-right">{bio.length}/280</Text>
        </View>
      </View>
      {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
      <Button
        title={loading ? 'Saving...' : 'Save profile'}
        className="mt-6"
        disabled={loading}
        onPress={() => void save()}
      />
    </ScreenContainer>
  );
}
