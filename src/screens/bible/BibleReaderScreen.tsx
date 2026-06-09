import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ComposerModal } from '@/components/common/ComposerModal';
import { TranslationToggle } from '@/components/bible/TranslationToggle';
import { VerseRow } from '@/components/bible/VerseRow';
import type { BibleStackParamList } from '@/navigation/types';
import type {
  BibleAnnotation,
  BibleChapter,
  BibleTranslation,
  VerseSearchResult,
} from '@/types/bible';
import {
  fetchChapter,
  fetchChapterAnnotations,
  saveReadingProgress,
  searchVerses,
  setBibleAnnotation,
} from '@/services/bible/bibleService';
import { summarizePassage } from '@/services/ai/grokService';
import { getBibleBook } from '@/constants/bible';
import { palette } from '@/constants/colors';
import { useTheme } from '@/context/ThemeProvider';

type Route = RouteProp<BibleStackParamList, 'BibleReader'>;
type Nav = NativeStackNavigationProp<BibleStackParamList, 'BibleReader'>;

export function BibleReaderScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { isDark } = useTheme();
  const listRef = useRef<FlatList>(null);

  const [translation, setTranslation] = useState<BibleTranslation>(
    params.translation ?? 'KJV',
  );
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [annotations, setAnnotations] = useState<BibleAnnotation[]>([]);
  const [activeVerse, setActiveVerse] = useState<number | undefined>(params.verse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VerseSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const book = params.book;
  const chapterNum = params.chapter;
  const metadata = getBibleBook(book);

  const loadChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [content, savedAnnotations] = await Promise.all([
        fetchChapter(book, chapterNum, translation),
        fetchChapterAnnotations(book, chapterNum, translation).catch(() => []),
      ]);
      setChapter(content);
      setAnnotations(savedAnnotations);
      await saveReadingProgress({
        book,
        chapter: chapterNum,
        verse: params.verse,
        translation,
      }).catch(() => undefined);
    } catch (nextError) {
      setChapter(null);
      setError(nextError instanceof Error ? nextError.message : 'Could not load this chapter.');
    } finally {
      setLoading(false);
    }
  }, [book, chapterNum, params.verse, translation]);

  useEffect(() => {
    void loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    setActiveVerse(params.verse);
  }, [params.book, params.chapter, params.verse]);

  useEffect(() => {
    if (!params.verse || !chapter) {
      return;
    }
    const index = chapter.verses.findIndex((verse) => verse.number === params.verse);
    if (index >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 250);
    }
  }, [chapter, params.verse]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      searchVerses(searchQuery, translation)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, translation]);

  const hasAnnotation = (verse: number, kind: BibleAnnotation['kind']) =>
    annotations.some((annotation) => annotation.verse === verse && annotation.kind === kind);

  const toggleAnnotation = async (
    verse: number,
    kind: 'highlight' | 'bookmark',
  ) => {
    const active = hasAnnotation(verse, kind);
    setActiveVerse(verse);
    setAnnotations((current) =>
      active
        ? current.filter((item) => !(item.verse === verse && item.kind === kind))
        : [
            ...current,
            {
              id: `optimistic-${kind}-${verse}`,
              book,
              chapter: chapterNum,
              verse,
              translation,
              kind,
              color: kind === 'highlight' ? 'gold' : undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
    );
    try {
      await setBibleAnnotation({
        book,
        chapter: chapterNum,
        verse,
        translation,
        kind,
        active: !active,
        color: kind === 'highlight' ? 'gold' : undefined,
      });
      await saveReadingProgress({ book, chapter: chapterNum, verse, translation });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save study state.');
      await loadChapter();
    }
  };

  const openNote = () => {
    if (!activeVerse) {
      return;
    }
    const note = annotations.find(
      (annotation) => annotation.verse === activeVerse && annotation.kind === 'note',
    );
    setNoteDraft(note?.note ?? '');
    setNoteOpen(true);
  };

  const saveNote = async () => {
    if (!activeVerse) {
      return;
    }
    setNoteSaving(true);
    try {
      await setBibleAnnotation({
        book,
        chapter: chapterNum,
        verse: activeVerse,
        translation,
        kind: 'note',
        active: noteDraft.trim().length > 0,
        note: noteDraft,
      });
      setNoteOpen(false);
      const nextAnnotations = await fetchChapterAnnotations(book, chapterNum, translation);
      setAnnotations(nextAnnotations);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save the note.');
    } finally {
      setNoteSaving(false);
    }
  };

  const goToResult = (result: VerseSearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    navigation.push('BibleReader', {
      book: result.book,
      chapter: result.chapter,
      verse: result.verse,
      translation,
    });
  };

  const moveChapter = (offset: number) => {
    if (!metadata) {
      return;
    }
    const next = chapterNum + offset;
    if (next < 1 || next > metadata.chapters) {
      return;
    }
    navigation.replace('BibleReader', { book, chapter: next, translation });
  };

  const handleSummarize = async () => {
    if (!chapter) {
      return;
    }
    const verses = activeVerse
      ? chapter.verses.filter((verse) => verse.number === activeVerse)
      : chapter.verses;
    setSummaryLoading(true);
    setSummaryError(null);
    const { summary: nextSummary, error: nextError } = await summarizePassage({
      reference: activeVerse ? `${book} ${chapterNum}:${activeVerse}` : `${book} ${chapterNum}`,
      translation,
      verses: verses.map((verse) => `${verse.number}. ${verse.text}`).join('\n'),
    });
    setSummaryLoading(false);
    if (nextError) {
      setSummaryError(nextError);
    } else {
      setSummary(nextSummary);
    }
  };

  const iconColor = isDark ? palette.brandLight : palette.brandDark;

  return (
    <>
      <ScreenContainer scroll={false} className="flex-1">
        <View className="px-4 pt-2 pb-3 border-b border-black/5 dark:border-white/10">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Previous chapter"
              disabled={chapterNum <= 1}
              onPress={() => moveChapter(-1)}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={chapterNum <= 1 ? palette.muted : iconColor}
              />
            </Pressable>
            <Text variant="title">{book} {chapterNum}</Text>
            <Pressable
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Next chapter"
              disabled={!metadata || chapterNum >= metadata.chapters}
              onPress={() => moveChapter(1)}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={!metadata || chapterNum >= metadata.chapters ? palette.muted : iconColor}
              />
            </Pressable>
          </View>
          <View className="mt-2 flex-row items-center bg-surface-light dark:bg-surface rounded-xl px-3 border border-black/5 dark:border-white/10">
            <Ionicons name="search" size={18} color={palette.muted} />
            <TextInput
              className="flex-1 py-3 px-2 text-base text-foreground-light dark:text-foreground"
              placeholder="Search Scripture"
              placeholderTextColor={palette.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searching ? <ActivityIndicator size="small" color={palette.brand} /> : null}
          </View>
          {searchResults.length > 0 ? (
            <View className="mt-2 rounded-xl bg-surface-light dark:bg-surface border border-black/5 dark:border-white/10 max-h-48">
              {searchResults.slice(0, 8).map((result) => (
                <Pressable
                  key={`${result.reference}-${result.translation}`}
                  className="px-3 py-2 border-b border-black/5 dark:border-white/5"
                  onPress={() => goToResult(result)}
                >
                  <Text className="text-brand font-semibold text-sm">{result.reference}</Text>
                  <Text variant="caption" numberOfLines={1}>{result.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View className="mt-3">
            <TranslationToggle value={translation} onChange={setTranslation} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.brand} />
            <Text variant="caption" className="mt-3">Loading chapter...</Text>
          </View>
        ) : error && !chapter ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="cloud-offline-outline" size={36} color={palette.muted} />
            <Text variant="subtitle" className="mt-3 text-center">Chapter unavailable</Text>
            <Text variant="caption" className="mt-2 text-center">{error}</Text>
            <Button title="Try again" className="mt-5" onPress={() => void loadChapter()} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={chapter?.verses ?? []}
            keyExtractor={(item) => String(item.number)}
            contentContainerClassName="px-2 pt-2 pb-40"
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={() => undefined}
            renderItem={({ item }) => (
              <VerseRow
                number={item.number}
                text={item.text}
                highlighted={hasAnnotation(item.number, 'highlight')}
                bookmarked={hasAnnotation(item.number, 'bookmark')}
                hasNote={hasAnnotation(item.number, 'note')}
                searchQuery={searchQuery}
                onPress={() => void toggleAnnotation(item.number, 'highlight')}
              />
            )}
            ListHeaderComponent={
              <View className="mb-3 px-2">
                <Text variant="caption" className="text-center">
                  Tap a verse to select and highlight it
                </Text>
                {chapter?.source === 'offline' ? (
                  <Text variant="caption" className="text-center mt-1 text-brand">
                    Offline chapter
                  </Text>
                ) : null}
              </View>
            }
            ListFooterComponent={
              chapter?.copyright ? (
                <Text variant="caption" className="mt-5 px-3 text-center">
                  {chapter.copyright}
                </Text>
              ) : null
            }
          />
        )}

        <View className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-3 bg-background-light/95 dark:bg-background/95 border-t border-black/5 dark:border-white/10">
          {error && chapter ? <Text className="text-red-500 text-sm mb-2">{error}</Text> : null}
          {summaryError ? <Text className="text-red-500 text-sm mb-2">{summaryError}</Text> : null}
          <View className="flex-row gap-2 mb-2">
            <Pressable
              className="flex-1 h-11 rounded-lg bg-surface-light dark:bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Toggle bookmark"
              disabled={!activeVerse}
              onPress={() => activeVerse && void toggleAnnotation(activeVerse, 'bookmark')}
            >
              <Ionicons
                name={activeVerse && hasAnnotation(activeVerse, 'bookmark') ? 'bookmark' : 'bookmark-outline'}
                size={21}
                color={activeVerse ? palette.brand : palette.muted}
              />
            </Pressable>
            <Pressable
              className="flex-1 h-11 rounded-lg bg-surface-light dark:bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Edit verse note"
              disabled={!activeVerse}
              onPress={openNote}
            >
              <Ionicons name="document-text-outline" size={21} color={activeVerse ? palette.brand : palette.muted} />
            </Pressable>
          </View>
          <Button
            title={
              summaryLoading
                ? 'Summarizing...'
                : activeVerse
                  ? `Summarize ${book} ${chapterNum}:${activeVerse}`
                  : 'Summarize chapter'
            }
            disabled={summaryLoading || loading || !chapter}
            onPress={() => void handleSummarize()}
          />
        </View>
      </ScreenContainer>

      <ComposerModal
        visible={noteOpen}
        title={activeVerse ? `Note on ${book} ${chapterNum}:${activeVerse}` : 'Verse note'}
        value={noteDraft}
        placeholder="Write your study note..."
        submitTitle={noteDraft.trim() ? 'Save note' : 'Remove note'}
        maxLength={5000}
        loading={noteSaving}
        allowEmptySubmit
        onChangeText={setNoteDraft}
        onClose={() => setNoteOpen(false)}
        onSubmit={() => void saveNote()}
      />

      <Modal visible={Boolean(summary)} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background-light dark:bg-background px-5 pt-5">
          <View className="flex-row items-center justify-between">
            <Text variant="title">Study summary</Text>
            <Pressable
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Close summary"
              onPress={() => setSummary(null)}
            >
              <Ionicons name="close" size={26} color={palette.muted} />
            </Pressable>
          </View>
          <Text variant="label" className="text-brand mt-5 mb-2">
            {activeVerse ? `${book} ${chapterNum}:${activeVerse}` : `${book} ${chapterNum}`} - {translation}
          </Text>
          <Text className="text-lg leading-8">{summary}</Text>
          <Text variant="caption" className="mt-6">
            AI summaries support study and may contain mistakes. Read them alongside Scripture.
          </Text>
        </View>
      </Modal>
    </>
  );
}
