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
      <ScreenContainer contentClassName="px-5">
        <Header title="Bible" subtitle="A peaceful space to read God's Word" />
        <View className="flex-row items-center bg-surface-elevated rounded-2xl px-4 mb-3 border border-border">
          <Ionicons name="search-outline" size={19} color={palette.brandMuted} />
          <TextInput
            className="flex-1 py-4 px-3 text-base text-foreground"
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
          <Card className="mb-5 border-brand/20">
            {results.slice(0, 10).map((result) => (
              <Pressable
                key={`${result.reference}-${result.translation}`}
                className="py-3 border-b border-border-subtle"
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
            <Text variant="label" className="mb-3 mt-4">Your journey in the Word</Text>
            <Pressable
              onPress={() =>
                openReader(progress.book, progress.chapter, progress.verse, progress.translation)
              }
            >
              <Card className="mb-6 rounded-3xl border-brand/25 bg-brand/[0.06] p-5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text variant="subtitle">{progress.book} {progress.chapter}</Text>
                    <Text variant="caption" className="mt-1">
                      {progress.translation}{progress.verse ? ` - verse ${progress.verse}` : ''}
                    </Text>
                  </View>
                  <View className="w-11 h-11 rounded-full bg-brand/12 border border-brand/25 items-center justify-center">
                    <Ionicons name="arrow-forward" size={19} color={palette.brandLight} />
                  </View>
                </View>
              </Card>
            </Pressable>
          </>
        ) : null}

        <Text variant="label" className="mb-3">Scripture focus</Text>
        {QUICK_PASSAGES.map((passage) => (
          <Pressable
            key={passage.label}
            onPress={() => openReader(passage.book, passage.chapter)}
          >
            <Card className="mb-3 border-brand/15 bg-surface-elevated/80">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-brand/10 items-center justify-center">
                  <Ionicons name="book-outline" size={19} color={palette.brand} />
                </View>
                <View className="flex-1">
                  <Text variant="subtitle">{passage.label}</Text>
                  <Text className="text-brand-muted text-sm font-medium mt-1">Open in Bible</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}

        {bookmarks.length > 0 ? (
          <>
            <Text variant="label" className="mb-3 mt-6">Bookmarks</Text>
            <View className="flex-row flex-wrap gap-2">
              {bookmarks.map((bookmark) => (
                <Pressable
                  key={bookmark.id}
                  className="bg-brand/[0.05] px-3 py-2 rounded-xl border border-brand/20"
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

        <Text variant="label" className="mb-2 mt-7">All books</Text>
        {(['Old', 'New'] as const).map((testament) => (
          <View key={testament}>
            <Text variant="subtitle" className="mt-3 mb-3">{testament} Testament</Text>
            <View className="flex-row flex-wrap gap-2">
              {BIBLE_BOOKS.filter((book) => book.testament === testament).map((book) => (
                <Pressable
                  key={book.id}
                  className="bg-surface-elevated px-3 py-2.5 rounded-xl border border-border"
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
        <ScreenContainer contentClassName="px-5">
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
                    className="w-12 h-12 items-center justify-center rounded-xl bg-surface-elevated border border-border"
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
