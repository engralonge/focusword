import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { config } from '@/constants/config';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenContainer contentClassName="px-4 justify-center flex-1">
      <Text variant="title">Welcome to {config.appName}</Text>
      <Text variant="body" className="mt-2">
        Live Bible study, prayer, and community in one place.
      </Text>
      <Button
        title="Create account"
        className="mt-8"
        onPress={() => navigation.navigate('SignUp')}
      />
      <Button
        title="Sign in"
        variant="secondary"
        className="mt-3"
        onPress={() => navigation.navigate('SignIn')}
      />
    </ScreenContainer>
  );
}
