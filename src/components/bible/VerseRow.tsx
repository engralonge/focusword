import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { cn } from '@/utils/cn';
import { palette } from '@/constants/colors';

type Props = {
  number: number;
  text: string;
  highlighted: boolean;
  bookmarked?: boolean;
  hasNote?: boolean;
  searchQuery: string;
  onPress: () => void;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function VerseText({ text, searchQuery }: { text: string; searchQuery: string }) {
  const q = searchQuery.trim();
  if (q.length < 2) {
    return (
      <Text className="text-[18px] leading-8 text-scripture flex-1 font-light">
        {text}
      </Text>
    );
  }

  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, 'gi'));
  return (
    <Text className="text-[18px] leading-8 text-scripture flex-1 font-light">
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <Text key={i} className="bg-brand/35 text-scripture font-medium">
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export function VerseRow({
  number,
  text,
  highlighted,
  bookmarked = false,
  hasNote = false,
  searchQuery,
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          'flex-row gap-3 px-3 py-3.5 rounded-xl mb-1',
          highlighted && 'bg-brand/[0.12] border-l-2 border-brand',
        )}
      >
        <Text className="text-brand-muted font-semibold text-sm w-7 text-right pt-1">{number}</Text>
        <VerseText text={text} searchQuery={searchQuery} />
        {bookmarked || hasNote ? (
          <View className="gap-1 pt-1">
            {bookmarked ? <Ionicons name="bookmark" size={15} color={palette.brand} /> : null}
            {hasNote ? <Ionicons name="document-text" size={15} color={palette.muted} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
