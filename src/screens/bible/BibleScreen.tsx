import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import type { BibleStackParamList } from '@/navigation/types';
import type { BibleAnnotation, ReadingProgress, VerseSearchResult } from '@/types/bible';
import {
  fetchBookmarks,
  fetchReadingProgress,
  searchVerses,
} from '@/services/bible/bibleService';
import { BIBLE_BOOKS, type BibleBook } from '@/constants/bible';
import { palette } from '@/constants/colors';

type Nav = NativeStackNavigationProp<BibleStackParamList, 'BibleMain'>;

const QUICK_PASSAGES = [
  { book: 'John', chapter: 3, label: 'John 3 - Born again' },
  { book: 'Psalms', chapter: 23, label: 'Psalm 23 - The Shepherd' },
] as const;

export function BibleScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VerseSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [bookmarks, setBookmarks] = useState<BibleAnnotation[]>([]);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

  const loadStudyState = useCallback(async () => {
    try {
      const [nextProgress, nextBookmarks] = await Promise.all([
        fetchReadingProgress(),
        fetchBookmarks(8),
      ]);
      setProgress(nextProgress);
      setBookmarks(nextBookmarks);
    } catch {
      setProgress(null);
      setBookmarks([]);
    }
  }, []);

  useEffect(() => {
    void loadStudyState();
  }, [loadStudyState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        setSearchError(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      searchVerses(query, 'WEB')
        .then(setResults)
        .catch((error: unknown) => {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : 'Search is unavailable.');
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const openReader = (
    book: string,
    chapter: number,
    verse?: number,
    translation: ReadingProgress['translation'] = 'WEB',
  ) => {
    navigation.navigate('BibleReader', { book, chapter, verse, translation });
  };

  return (
    <>
      <ScreenContainer contentClassName="px-4">
        <Header title="Bible" subtitle="Search, read, and keep your study notes" />
        <View className="flex-row items-center bg-surface-light dark:bg-surface rounded-xl px-3 mb-2 border border-black/5 dark:border-white/10">
          <Ionicons name="search" size={18} color={palette.muted} />
          <TextInput
            className="flex-1 py-3 px-2 text-base text-foreground-light dark:text-foreground"
            placeholder="Search verses or type John 3:16"
            placeholderTextColor={palette.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        {searching ? <Text variant="caption" className="mb-3">Searching...</Text> : null}
        {searchError ? <Text className="text-red-500 mb-3">{searchError}</Text> : null}
        {query.length >= 2 && !searching && results.length === 0 && !searchError ? (
          <Text variant="caption" className="mb-3">No verses found.</Text>
        ) : null}
        {results.length > 0 ? (
          <Card className="mb-4">
            {results.slice(0, 10).map((result) => (
              <Pressable
                key={`${result.reference}-${result.translation}`}
                className="py-2 border-b border-black/5 dark:border-white/5"
                onPress={() => {
                  setQuery('');
                  openReader(result.book, result.chapter, result.verse, result.translation);
                }}
              >
                <Text className="text-brand font-semibold">{result.reference}</Text>
                <Text variant="caption" numberOfLines={2}>{result.text}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {progress ? (
          <>
            <Text variant="label" className="mb-2 mt-3">Continue reading</Text>
            <Pressable
              onPress={() =>
                openReader(progress.book, progress.chapter, progress.verse, progress.translation)
              }
            >
              <Card className="mb-4">
                <Text variant="subtitle">{progress.book} {progress.chapter}</Text>
                <Text variant="caption" className="mt-1">
                  {progress.translation}{progress.verse ? ` - verse ${progress.verse}` : ''}
                </Text>
              </Card>
            </Pressable>
          </>
        ) : null}

        <Text variant="label" className="mb-2">Start reading</Text>
        {QUICK_PASSAGES.map((passage) => (
          <Pressable
            key={passage.label}
            onPress={() => openReader(passage.book, passage.chapter)}
          >
            <Card className="mb-2">
              <Text variant="subtitle">{passage.label}</Text>
              <Text className="text-brand font-medium mt-1">Open reader</Text>
            </Card>
          </Pressable>
        ))}

        {bookmarks.length > 0 ? (
          <>
            <Text variant="label" className="mb-2 mt-5">Bookmarks</Text>
            <View className="flex-row flex-wrap gap-2">
              {bookmarks.map((bookmark) => (
                <Pressable
                  key={bookmark.id}
                  className="bg-surface-light dark:bg-surface px-3 py-2 rounded-lg border border-black/5 dark:border-white/5"
                  onPress={() =>
                    openReader(
                      bookmark.book,
                      bookmark.chapter,
                      bookmark.verse,
                      bookmark.translation,
                    )
                  }
                >
                  <Text>{bookmark.book} {bookmark.chapter}:{bookmark.verse}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text variant="label" className="mb-2 mt-5">All books</Text>
        {(['Old', 'New'] as const).map((testament) => (
          <View key={testament}>
            <Text variant="subtitle" className="mt-2 mb-2">{testament} Testament</Text>
            <View className="flex-row flex-wrap gap-2">
              {BIBLE_BOOKS.filter((book) => book.testament === testament).map((book) => (
                <Pressable
                  key={book.id}
                  className="bg-surface-light dark:bg-surface px-3 py-2 rounded-lg border border-black/5 dark:border-white/5"
                  onPress={() => setSelectedBook(book)}
                >
                  <Text>{book.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <View className="h-8" />
      </ScreenContainer>

      <Modal
        visible={Boolean(selectedBook)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedBook(null)}
      >
        <ScreenContainer contentClassName="px-4">
          <View className="flex-row items-center justify-between mt-2">
            <Text variant="title">{selectedBook?.name}</Text>
            <Pressable
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Close chapter picker"
              onPress={() => setSelectedBook(null)}
            >
              <Ionicons name="close" size={26} color={palette.muted} />
            </Pressable>
          </View>
          <Text variant="caption" className="mb-4">Choose a chapter</Text>
          {selectedBook ? (
            <View className="flex-row flex-wrap gap-2">
              {Array.from({ length: selectedBook.chapters }, (_, index) => index + 1).map(
                (chapter) => (
                  <Pressable
                    key={chapter}
                    className="w-12 h-12 items-center justify-center rounded-lg bg-surface-light dark:bg-surface border border-black/5 dark:border-white/5"
                    onPress={() => {
                      const book = selectedBook.name;
                      setSelectedBook(null);
                      openReader(book, chapter);
                    }}
                  >
                    <Text>{chapter}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ) : (
            <EmptyState title="Choose a book" />
          )}
        </ScreenContainer>
      </Modal>
    </>
  );
}
