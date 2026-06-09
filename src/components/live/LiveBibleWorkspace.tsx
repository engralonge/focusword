import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { TranslationToggle } from '@/components/bible/TranslationToggle';
import { BIBLE_BOOKS, getBibleBook } from '@/constants/bible';
import { palette } from '@/constants/colors';
import { fetchChapter } from '@/services/bible/bibleService';
import { summarizePassage } from '@/services/ai/grokService';
import {
  fetchLiveBibleWorkspace,
  saveLiveBibleWorkspace,
  subscribeToLiveBibleWorkspace,
} from '@/services/streaming/streamingService';
import type { LiveBibleWorkspace as Workspace } from '@/types';
import type { BibleChapter, BibleTranslation } from '@/types/bible';
import { cn } from '@/utils/cn';

type Props = {
  streamId: string;
  isHost: boolean;
  onError: (message: string) => void;
};

const defaultWorkspace = (streamId: string): Workspace => ({
  streamId,
  book: 'John',
  chapter: 1,
  translation: 'WEB',
  isVisible: true,
  updatedAt: new Date().toISOString(),
});

export function LiveBibleWorkspace({ streamId, isHost, onError }: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      setWorkspace(await fetchLiveBibleWorkspace(streamId));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not load shared Scripture.');
    } finally {
      setLoading(false);
    }
  }, [onError, streamId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(
    () => subscribeToLiveBibleWorkspace(streamId, () => void loadWorkspace()),
    [loadWorkspace, streamId],
  );

  useEffect(() => {
    if (!workspace || (!workspace.isVisible && !isHost)) {
      setChapter(null);
      return;
    }
    setContentLoading(true);
    setLocalError(null);
    fetchChapter(workspace.book, workspace.chapter, workspace.translation)
      .then(setChapter)
      .catch((error: unknown) => {
        setChapter(null);
        setLocalError(
          error instanceof Error ? error.message : 'Could not load the shared passage.',
        );
      })
      .finally(() => setContentLoading(false));
  }, [isHost, workspace?.book, workspace?.chapter, workspace?.isVisible, workspace?.translation]);

  const persist = async (next: Workspace) => {
    setWorkspace(next);
    setSaving(true);
    setLocalError(null);
    try {
      const { updatedAt: _updatedAt, ...payload } = next;
      await saveLiveBibleWorkspace(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update shared Scripture.';
      setLocalError(message);
      onError(message);
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const updateReference = (
    next: Partial<Pick<Workspace, 'book' | 'chapter' | 'translation'>>,
  ) => {
    if (!workspace) return;
    const book = next.book ?? workspace.book;
    const metadata = getBibleBook(book);
    const requestedChapter = next.chapter ?? workspace.chapter;
    void persist({
      ...workspace,
      ...next,
      book,
      chapter: Math.max(1, Math.min(metadata?.chapters ?? 1, requestedChapter)),
      activeVerse: undefined,
      summary: undefined,
      summaryReference: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const openWorkspace = () => {
    const next = workspace
      ? { ...workspace, isVisible: true, updatedAt: new Date().toISOString() }
      : defaultWorkspace(streamId);
    void persist(next);
  };

  const selectVerse = (verse: number) => {
    if (!isHost || !workspace) return;
    void persist({
      ...workspace,
      activeVerse: workspace.activeVerse === verse ? undefined : verse,
      summary: undefined,
      summaryReference: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const shareSummary = async () => {
    if (!workspace || !chapter) return;
    const selectedVerses = workspace.activeVerse
      ? chapter.verses.filter((verse) => verse.number === workspace.activeVerse)
      : chapter.verses;
    const reference = workspace.activeVerse
      ? `${workspace.book} ${workspace.chapter}:${workspace.activeVerse}`
      : `${workspace.book} ${workspace.chapter}`;
    setSummarizing(true);
    setLocalError(null);
    const result = await summarizePassage({
      reference,
      translation: workspace.translation,
      verses: selectedVerses.map((verse) => `${verse.number}. ${verse.text}`).join('\n'),
    });
    setSummarizing(false);
    if (result.error) {
      setLocalError(result.error);
      onError(result.error);
      return;
    }
    await persist({
      ...workspace,
      summary: result.summary,
      summaryReference: reference,
      updatedAt: new Date().toISOString(),
    });
  };

  if (loading) {
    return (
      <Card className="mt-4 items-center py-6">
        <ActivityIndicator color={palette.brand} />
        <Text variant="caption" className="mt-2">Loading shared Scripture...</Text>
      </Card>
    );
  }

  if ((!workspace || !workspace.isVisible) && !isHost) {
    return null;
  }

  if (!workspace || !workspace.isVisible) {
    return (
      <Card className="mt-4">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-brand/12 items-center justify-center">
            <Ionicons name="book-outline" size={22} color={palette.brandLight} />
          </View>
          <View className="flex-1">
            <Text variant="subtitle">Live Scripture</Text>
            <Text variant="caption" className="mt-1">
              Open a passage for everyone in the room.
            </Text>
          </View>
        </View>
        <Button title="Open Scripture" className="mt-4" onPress={openWorkspace} />
      </Card>
    );
  }

  const metadata = getBibleBook(workspace.book);

  return (
    <>
      <Card className="mt-4 p-0 overflow-hidden border-brand/25">
        <View className="px-4 py-4 border-b border-border-subtle bg-brand/[0.05]">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-brand/12 items-center justify-center">
                <Ionicons name="book-outline" size={20} color={palette.brandLight} />
              </View>
              <View>
                <Text variant="label">Live Scripture</Text>
                <Text variant="subtitle" className="mt-1">
                  {workspace.book} {workspace.chapter}
                </Text>
              </View>
            </View>
            {isHost ? (
              <Pressable
                className="w-10 h-10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Hide shared Scripture"
                onPress={() =>
                  void persist({
                    ...workspace,
                    isVisible: false,
                    updatedAt: new Date().toISOString(),
                  })
                }
              >
                <Ionicons name="eye-off-outline" size={21} color={palette.muted} />
              </Pressable>
            ) : (
              <View className="rounded-full bg-live/15 px-3 py-1">
                <Text className="text-live text-xs font-semibold">HOST LED</Text>
              </View>
            )}
          </View>

          {isHost ? (
            <View className="mt-4">
              <Pressable
                className="min-h-11 rounded-xl border border-border bg-surface-elevated px-4 flex-row items-center justify-between"
                accessibilityRole="button"
                accessibilityLabel="Choose Bible book"
                onPress={() => setBookPickerOpen(true)}
              >
                <Text className="font-semibold">{workspace.book}</Text>
                <Ionicons name="chevron-down" size={18} color={palette.muted} />
              </Pressable>
              <View className="mt-3 flex-row items-center justify-between">
                <Pressable
                  className="w-11 h-11 rounded-xl border border-border items-center justify-center"
                  disabled={workspace.chapter <= 1 || saving}
                  accessibilityRole="button"
                  accessibilityLabel="Previous shared chapter"
                  onPress={() => updateReference({ chapter: workspace.chapter - 1 })}
                >
                  <Ionicons
                    name="chevron-back"
                    size={21}
                    color={workspace.chapter <= 1 ? palette.muted : palette.brandLight}
                  />
                </Pressable>
                <Text className="font-semibold">Chapter {workspace.chapter}</Text>
                <Pressable
                  className="w-11 h-11 rounded-xl border border-border items-center justify-center"
                  disabled={!metadata || workspace.chapter >= metadata.chapters || saving}
                  accessibilityRole="button"
                  accessibilityLabel="Next shared chapter"
                  onPress={() => updateReference({ chapter: workspace.chapter + 1 })}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={21}
                    color={
                      !metadata || workspace.chapter >= metadata.chapters
                        ? palette.muted
                        : palette.brandLight
                    }
                  />
                </Pressable>
              </View>
              <View className="mt-3">
                <TranslationToggle
                  value={workspace.translation}
                  onChange={(translation: BibleTranslation) =>
                    updateReference({ translation })
                  }
                />
              </View>
            </View>
          ) : (
            <Text variant="caption" className="mt-2">{workspace.translation}</Text>
          )}
        </View>

        {localError ? (
          <View className="px-4 py-4 bg-red-500/10">
            <Text className="text-red-400">{localError}</Text>
          </View>
        ) : null}

        {contentLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={palette.brand} />
          </View>
        ) : (
          <View className="px-3 py-3">
            {chapter?.verses.map((verse) => {
              const highlighted = workspace.activeVerse === verse.number;
              return (
                <Pressable
                  key={verse.number}
                  className={cn(
                    'flex-row gap-3 rounded-xl px-3 py-3',
                    highlighted && 'bg-brand/[0.14] border-l-2 border-brand',
                  )}
                  disabled={!isHost}
                  accessibilityRole={isHost ? 'button' : undefined}
                  accessibilityLabel={
                    isHost ? `Share ${workspace.book} ${workspace.chapter}:${verse.number}` : undefined
                  }
                  onPress={() => selectVerse(verse.number)}
                >
                  <Text className="w-7 pt-1 text-right text-sm font-semibold text-brand-muted">
                    {verse.number}
                  </Text>
                  <Text className="flex-1 text-[17px] leading-7 text-scripture font-light">
                    {verse.text}
                  </Text>
                </Pressable>
              );
            })}
            {chapter?.copyright ? (
              <Text variant="caption" className="px-3 py-4 text-center">
                {chapter.copyright}
              </Text>
            ) : null}
          </View>
        )}

        {workspace.summary ? (
          <View className="mx-4 mb-4 rounded-xl border border-brand/20 bg-brand/[0.07] p-4">
            <Text variant="label">Shared study insight</Text>
            <Text className="mt-2 font-semibold text-brand-light">
              {workspace.summaryReference}
            </Text>
            <Text className="mt-3 leading-7">{workspace.summary}</Text>
            <Text variant="caption" className="mt-3">
              AI-assisted insight. Read it alongside Scripture.
            </Text>
          </View>
        ) : null}

        {isHost && chapter ? (
          <View className="px-4 pb-4">
            <Button
              title={
                summarizing
                  ? 'Preparing insight...'
                  : workspace.activeVerse
                    ? `Share insight on verse ${workspace.activeVerse}`
                    : 'Share chapter insight'
              }
              variant="secondary"
              disabled={summarizing || saving}
              onPress={() => void shareSummary()}
            />
            <Text variant="caption" className="mt-2 text-center">
              Tap a verse to focus everyone on it.
            </Text>
          </View>
        ) : null}
      </Card>

      <Modal
        visible={bookPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBookPickerOpen(false)}
      >
        <View className="flex-1 bg-background pt-5">
          <View className="px-5 pb-4 flex-row items-center justify-between border-b border-border">
            <Text variant="title">Choose a book</Text>
            <Pressable
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Close Bible book picker"
              onPress={() => setBookPickerOpen(false)}
            >
              <Ionicons name="close" size={25} color={palette.muted} />
            </Pressable>
          </View>
          <FlatList
            data={BIBLE_BOOKS}
            keyExtractor={(book) => book.id}
            contentContainerClassName="px-5 py-3"
            renderItem={({ item }) => (
              <Pressable
                className="min-h-12 border-b border-border-subtle flex-row items-center justify-between"
                onPress={() => {
                  setBookPickerOpen(false);
                  updateReference({ book: item.name, chapter: 1 });
                }}
              >
                <Text className="font-medium">{item.name}</Text>
                <Text variant="caption">{item.chapters} chapters</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
