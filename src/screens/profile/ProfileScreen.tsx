import { View } from 'react-native';
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

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, signOut } = useAuth();

  return (
    <ScreenContainer contentClassName="px-4">
      <Header title="Profile" subtitle={config.appName} />
      <Card>
        <View className="w-16 h-16 rounded-full bg-brand/20 items-center justify-center mb-3">
          <Text variant="title" className="text-brand">
            {(session?.user.displayName ?? 'G')[0]?.toUpperCase()}
          </Text>
        </View>
        <Text variant="subtitle">
          {session?.user.displayName ?? 'Guest'}
        </Text>
        <Text variant="caption" className="mt-1">
          {session?.user.email ?? 'Not signed in'}
        </Text>
        {session?.user.bio ? (
          <Text variant="body" className="mt-3">{session.user.bio}</Text>
        ) : null}
      </Card>
      <Button
        title="Edit profile"
        className="mt-4"
        onPress={() => navigation.navigate('EditProfile')}
      />
      <Button
        title="Settings"
        variant="secondary"
        className="mt-3"
        onPress={() => navigation.navigate('Settings')}
      />
      <Button title="Sign out" variant="ghost" className="mt-3" onPress={() => void signOut()} />
    </ScreenContainer>
  );
}
