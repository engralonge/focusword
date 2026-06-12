import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthProvider';
import type { ProfileStackParamList } from '@/navigation/types';
import { config } from '@/constants/config';
import { palette } from '@/constants/colors';
import { Avatar } from '@/components/common/Avatar';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, signOut } = useAuth();

  return (
    <ScreenContainer contentClassName="px-5">
      <Header title="Profile" subtitle="Your journey in the Word" />
      <Card className="rounded-3xl border-brand/25 bg-brand/[0.05] p-6 items-center">
        <Avatar
          displayName={session?.user.displayName ?? 'Guest'}
          avatarUrl={session?.user.avatarUrl}
          size="lg"
          className="mb-5 border-2"
        />
        <Text variant="subtitle">
          {session?.user.displayName ?? 'Guest'}
        </Text>
        <Text variant="caption" className="mt-1">
          {session?.user.email ?? 'Not signed in'}
        </Text>
        <Text variant="body" className="mt-4 text-center text-muted leading-6">
          {session?.user.bio ?? 'Small faithful steps become a life of depth.'}
        </Text>
      </Card>
      <Pressable
        className="mt-5 flex-row items-center rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 py-4 active:bg-brand/10"
        accessibilityRole="button"
        accessibilityLabel="Open community points"
        onPress={() => navigation.navigate('CommunityPoints')}
      >
        <View className="w-11 h-11 rounded-xl bg-brand/12 items-center justify-center">
          <Ionicons name="sparkles-outline" size={21} color={palette.brand} />
        </View>
        <View className="flex-1 ml-4">
          <Text className="font-semibold">Community points</Text>
          <Text variant="caption" className="mt-1">
            Study consistency and service activity
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </Pressable>
      <Text variant="label" className="mt-7 mb-3">Account</Text>
      <View className="rounded-2xl border border-border overflow-hidden bg-surface-elevated/80">
        <Pressable
          className="flex-row items-center gap-4 px-4 py-4 border-b border-border-subtle"
          onPress={() => navigation.navigate('EditProfile')}
        >
          <View className="w-10 h-10 rounded-xl bg-brand/10 items-center justify-center">
            <Ionicons name="person-outline" size={20} color={palette.brand} />
          </View>
          <Text className="flex-1 font-medium">Edit profile</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
        <Pressable
          className="flex-row items-center gap-4 px-4 py-4 border-b border-border-subtle"
          onPress={() => navigation.navigate('Settings')}
        >
          <View className="w-10 h-10 rounded-xl bg-brand/10 items-center justify-center">
            <Ionicons name="settings-outline" size={20} color={palette.brand} />
          </View>
          <Text className="flex-1 font-medium">Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
        <Pressable
          className={`flex-row items-center gap-4 px-4 py-4 ${
            session?.user.role === 'moderator' || session?.user.role === 'admin'
              ? 'border-b border-border-subtle'
              : ''
          }`}
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <View className="w-10 h-10 rounded-xl bg-brand/10 items-center justify-center">
            <Ionicons name="shield-checkmark-outline" size={20} color={palette.brand} />
          </View>
          <Text className="flex-1 font-medium">Safety and blocked accounts</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
        {session?.user.role === 'moderator' || session?.user.role === 'admin' ? (
          <Pressable
            className="flex-row items-center gap-4 px-4 py-4"
            onPress={() => navigation.navigate('Moderation')}
          >
            <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center">
              <Ionicons name="flag-outline" size={20} color={palette.danger} />
            </View>
            <Text className="flex-1 font-medium">Moderation queue</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>
      <Text variant="caption" className="mt-5 text-center">{config.appName}</Text>
      <Button title="Sign out" variant="ghost" className="mt-2" onPress={() => void signOut()} />
    </ScreenContainer>
  );
}
