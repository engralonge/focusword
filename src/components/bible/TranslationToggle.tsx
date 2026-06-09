import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { BibleTranslation } from '@/types/bible';
import { TRANSLATIONS } from '@/services/bible/bibleService';
import { cn } from '@/utils/cn';

type Props = {
  value: BibleTranslation;
  onChange: (t: BibleTranslation) => void;
};

export function TranslationToggle({ value, onChange }: Props) {
  return (
    <View className="flex-row rounded-full bg-surface-light dark:bg-surface p-1 border border-black/5 dark:border-white/10">
      {TRANSLATIONS.map((t) => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          className={cn(
            'flex-1 py-2 rounded-full items-center',
            value === t && 'bg-brand',
          )}
        >
          <Text
            className={cn(
              'text-sm font-semibold',
              value === t ? 'text-background' : 'text-muted',
            )}
          >
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}