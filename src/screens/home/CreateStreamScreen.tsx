import { useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { HomeStackParamList } from '@/navigation/types';
import { createLiveStream } from '@/services/streaming/streamingService';
import { useTheme } from '@/context/ThemeProvider';
import { palette } from '@/constants/colors';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'CreateStream'>;

const inputClass =
  'rounded-lg border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface px-4 py-3 text-foreground-light dark:text-foreground';

export function CreateStreamScreen() {
  const navigation = useNavigation<Nav>();
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startNow, setStartNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }
    if (event.type !== 'dismissed' && date) {
      setScheduledAt(date);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!startNow && scheduledAt.getTime() <= Date.now()) {
        throw new Error('Choose a future date and time.');
      }
      const streamId = await createLiveStream({
        title,
        description,
        startNow,
        scheduledAt: startNow ? undefined : scheduledAt.toISOString(),
      });
      navigation.replace('LiveStream', { streamId });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not create the study.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer contentClassName="px-4">
      <Text variant="label" className="mt-3 mb-2">Study title</Text>
      <TextInput
        className={inputClass}
        value={title}
        onChangeText={setTitle}
        placeholder="Understanding the Sermon on the Mount"
        placeholderTextColor={palette.muted}
        maxLength={120}
        accessibilityLabel="Study title"
      />
      <Text variant="label" className="mt-5 mb-2">Description</Text>
      <TextInput
        className={`${inputClass} min-h-28`}
        value={description}
        onChangeText={setDescription}
        placeholder="What will the group read and discuss?"
        placeholderTextColor={palette.muted}
        maxLength={2000}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Study description"
      />
      <View className="flex-row items-center justify-between mt-6 py-2">
        <View className="flex-1 pr-4">
          <Text variant="subtitle">Start now</Text>
          <Text variant="caption">Turn this off to schedule the study.</Text>
        </View>
        <Switch
          value={startNow}
          onValueChange={setStartNow}
          trackColor={{ false: palette.muted, true: palette.brandDark }}
          thumbColor={startNow ? palette.brand : undefined}
          accessibilityLabel="Start study now"
        />
      </View>
      {!startNow ? (
        <View className="mt-3">
          <Text variant="label" className="mb-2">Starts</Text>
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 flex-row items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-3"
              onPress={() => setPickerMode('date')}
              accessibilityRole="button"
              accessibilityLabel="Choose study date"
            >
              <Ionicons name="calendar-outline" size={20} color={palette.brand} />
              <Text>{scheduledAt.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable
              className="flex-1 flex-row items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-3"
              onPress={() => setPickerMode('time')}
              accessibilityRole="button"
              accessibilityLabel="Choose study time"
            >
              <Ionicons name="time-outline" size={20} color={palette.brand} />
              <Text>{scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
          </View>
          {pickerMode ? (
            <DateTimePicker
              value={scheduledAt}
              mode={pickerMode}
              minimumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant={isDark ? 'dark' : 'light'}
              onChange={onDateChange}
            />
          ) : null}
        </View>
      ) : null}
      {error ? <Text className="text-red-500 text-center mt-5">{error}</Text> : null}
      <Button
        title={saving ? 'Creating...' : startNow ? 'Go live' : 'Schedule study'}
        className="mt-6"
        disabled={saving || title.trim().length < 3}
        onPress={() => void submit()}
      />
    </ScreenContainer>
  );
}
