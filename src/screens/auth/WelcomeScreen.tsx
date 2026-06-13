import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { config } from '@/constants/config';
import type { AuthStackParamList } from '@/navigation/types';
import { BrandMark } from '@/components/common/BrandMark';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenContainer scroll={false} contentClassName="px-6 justify-center flex-1">
      <View className="items-center">
        <BrandMark size={132} framed className="mb-7 rounded-[28px]" />
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
