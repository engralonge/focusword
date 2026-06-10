import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@/navigation/types';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { FocusModeScreen } from '@/screens/home/FocusModeScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="FocusMode" component={FocusModeScreen} />
    </Stack.Navigator>
  );
}
