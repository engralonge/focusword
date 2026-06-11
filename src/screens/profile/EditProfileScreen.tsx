import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import type { ProfileStackParamList } from '@/navigation/types';
import { validateProfile } from '@/utils/auth';
import { palette } from '@/constants/colors';
import { Avatar } from '@/components/common/Avatar';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

export function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, updateProfile, updateAvatar } = useAuth();
  const [displayName, setDisplayName] = useState(session?.user.displayName ?? '');
  const [bio, setBio] = useState(session?.user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarLoading(true);
    setError(null);
    const nextError = await updateAvatar(
      result.assets[0].uri,
      result.assets[0].mimeType,
    );
    setAvatarLoading(false);
    if (nextError) setError(nextError);
  };

  const removeAvatar = async () => {
    setAvatarLoading(true);
    setError(null);
    const nextError = await updateAvatar(null);
    setAvatarLoading(false);
    if (nextError) setError(nextError);
  };

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
    <ScreenContainer scroll={false} contentClassName="px-5">
      <View className="mt-4 gap-4">
        <View className="items-center mb-2">
          <Pressable
            onPress={() => void chooseAvatar()}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <Avatar
              displayName={session?.user.displayName ?? 'Guest'}
              avatarUrl={session?.user.avatarUrl}
              size="lg"
            />
            <View className="absolute right-0 bottom-0 w-8 h-8 rounded-full bg-brand items-center justify-center">
              <Ionicons name="camera" size={16} color={palette.backgroundDark} />
            </View>
          </Pressable>
          <Text variant="caption" className="mt-3">
            {avatarLoading ? 'Updating photo...' : 'Tap to choose a profile photo'}
          </Text>
          {session?.user.avatarUrl ? (
            <Pressable
              className="mt-2"
              disabled={avatarLoading}
              onPress={() => void removeAvatar()}
            >
              <Text className="text-sm text-red-400">Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
        <View>
          <Text variant="label" className="mb-2">Display name</Text>
          <TextInput
            className="bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
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
            className="min-h-28 bg-surface-elevated rounded-2xl px-4 py-4 text-foreground border border-border"
            value={bio}
            onChangeText={setBio}
            placeholder="A little about you"
            placeholderTextColor={palette.muted}
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
