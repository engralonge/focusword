import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { config } from '@/constants/config';
import type { AuthStackParamList } from '@/navigation/types';
import { palette } from '@/constants/colors';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenContainer scroll={false} contentClassName="px-6 justify-center flex-1">
      <View className="items-center">
        <View className="w-28 h-28 rounded-full bg-brand/10 border-2 border-brand/35 items-center justify-center mb-7">
          <View className="absolute -inset-3 rounded-full border border-brand/15" />
          <Ionicons name="book-outline" size={42} color={palette.brandLight} />
        </View>
        <Text variant="label" className="mb-3">A welcoming place for faith</Text>
        <Text variant="title" className="text-center text-[32px] leading-10">
          {config.appName}
        </Text>
        <Text variant="body" className="mt-4 text-center text-muted leading-7 max-w-[320px]">
          Scripture, prayer, and fellowship for growing together in the Word.
        </Text>
      </View>
      <Button
        title="Create account"
        className="mt-10"
        onPress={() => navigation.navigate('SignUp')}
      />
      <Button
        title="Welcome back"
        variant="secondary"
        className="mt-3"
        onPress={() => navigation.navigate('SignIn')}
      />
      <View className="mt-8 flex-row items-center justify-center gap-2">
        <View className="w-8 h-px bg-brand/20" />
        <Text variant="caption" className="text-center">Gathering in God's Word</Text>
        <View className="w-8 h-px bg-brand/20" />
      </View>
    </ScreenContainer>
  );
}
