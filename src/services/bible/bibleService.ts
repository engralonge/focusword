import type {
  BibleAnnotation,
  BibleAnnotationKind,
  BibleChapter,
  BibleTranslation,
  ReadingProgress,
  VerseSearchResult,
} from '@/types/bible';
import { getAllSearchableVerses, getChapterContent } from '@/services/bible/bibleContent';
import { getKjvChapter, searchKjvVerses } from '@/services/bible/kjvBible';
import { getWebChapter, searchWebVerses } from '@/services/bible/webBible';
import { BIBLE_BOOKS, getBibleBook } from '@/constants/bible';
import { getSupabaseClient } from '@/services/supabase/client';

export { BIBLE_BOOKS };
export const TRANSLATIONS: BibleTranslation[] = ['WEB', 'KJV', 'NIV', 'ESV'];

async function requireUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Your session has expired. Sign in again.');
  }
  return { supabase, user: data.user };
}

export async function fetchChapter(
  book: string,
  chapter: number,
  translation: BibleTranslation,
): Promise<BibleChapter> {
  const metadata = getBibleBook(book);
  if (!metadata || chapter < 1 || chapter > metadata.chapters) {
    throw new Error(`Invalid Bible reference: ${book} ${chapter}.`);
  }

  if (translation === 'WEB') {
    const offline = getWebChapter(metadata.id, metadata.name, chapter);
    if (offline) {
      return offline;
    }
    throw new Error(`Offline WEB content is unavailable for ${book} ${chapter}.`);
  }

  if (translation === 'KJV') {
    const offline = getKjvChapter(metadata.id, metadata.name, chapter);
    if (offline) {
      return offline;
    }
    throw new Error(`Offline KJV content is unavailable for ${book} ${chapter}.`);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.functions.invoke<{
      chapter?: BibleChapter;
      error?: string;
    }>('bible-content', {
      body: {
        action: 'chapter',
        translation,
        bookId: metadata.id,
        book: metadata.name,
        chapter,
      },
    });
    if (data?.chapter?.verses.length) {
      return data.chapter;
    }

    const offline = getChapterContent(book, chapter, translation);
    if (offline) {
      return offline;
    }
    throw new Error(data?.error ?? error?.message ?? 'Bible content is unavailable.');
  }

  const offline = getChapterContent(book, chapter, translation);
  if (offline) {
    return offline;
  }
  throw new Error(
    'This translation requires an internet connection and provider access. WEB and KJV are available fully offline.',
  );
}

function searchOffline(
  query: string,
  translation: BibleTranslation,
): VerseSearchResult[] {
  const q = query.trim().toLowerCase();
  const referenceMatch = q.match(/^(.+?)\s+(\d+):(\d+)$/);
  return getAllSearchableVerses()
    .filter((item) => {
      const ref = `${item.book} ${item.chapter}:${item.verse}`.toLowerCase();
      const text = item.translations[translation]?.toLowerCase() ?? '';
      if (referenceMatch) {
        const [, book, ch, vs] = referenceMatch;
        return (
          item.book.toLowerCase().startsWith(book) &&
          item.chapter === Number(ch) &&
          item.verse === Number(vs)
        );
      }
      return ref.includes(q) || text.includes(q);
    })
    .slice(0, 12)
    .map((item) => ({
      book: item.book,
      chapter: item.chapter,
      verse: item.verse,
      text: item.translations[translation] ?? '',
      translation,
      reference: `${item.book} ${item.chapter}:${item.verse}`,
    }));
}

export async function searchVerses(
  query: string,
  translation: BibleTranslation,
): Promise<VerseSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  if (translation === 'WEB') {
    return searchWebVerses(q);
  }
  if (translation === 'KJV') {
    return searchKjvVerses(q);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.functions.invoke<{
      results?: Array<VerseSearchResult & { bookId?: string }>;
    }>('bible-content', {
      body: { action: 'search', translation, query: q },
    });
    if (data?.results?.length) {
      return data.results.map((result) => ({
        ...result,
        book:
          BIBLE_BOOKS.find((book) => book.id === result.bookId)?.name ??
          result.reference.split(/\s+\d/)[0] ??
          result.book,
      }));
    }
  }
  return searchOffline(q, translation);
}

function mapAnnotation(row: Record<string, unknown>): BibleAnnotation {
  return {
    id: String(row.id),
    book: String(row.book),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    translation: row.translation as BibleTranslation,
    kind: row.kind as BibleAnnotationKind,
    note: typeof row.note === 'string' ? row.note : undefined,
    color: typeof row.color === 'string' ? row.color : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function fetchChapterAnnotations(
  book: string,
  chapter: number,
  translation: BibleTranslation,
): Promise<BibleAnnotation[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('bible_annotations')
    .select('*')
    .eq('user_id', user.id)
    .eq('book', book)
    .eq('chapter', chapter)
    .eq('translation', translation);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapAnnotation(row as Record<string, unknown>));
}

export async function fetchBookmarks(limit = 20): Promise<BibleAnnotation[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('bible_annotations')
    .select('*')
    .eq('user_id', user.id)
    .eq('kind', 'bookmark')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapAnnotation(row as Record<string, unknown>));
}

export async function setBibleAnnotation(input: {
  book: string;
  chapter: number;
  verse: number;
  translation: BibleTranslation;
  kind: BibleAnnotationKind;
  active: boolean;
  note?: string;
  color?: string;
}): Promise<void> {
  const { supabase, user } = await requireUser();
  const reference = {
    user_id: user.id,
    book: input.book,
    chapter: input.chapter,
    verse: input.verse,
    translation: input.translation,
    kind: input.kind,
  };
  if (!input.active) {
    const { error } = await supabase
      .from('bible_annotations')
      .delete()
      .match(reference);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }
  const { error } = await supabase.from('bible_annotations').upsert({
    ...reference,
    note: input.note?.trim() || null,
    color: input.color ?? null,
  }, {
    onConflict: 'user_id,book,chapter,verse,translation,kind',
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function saveReadingProgress(progress: Omit<ReadingProgress, 'updatedAt'>): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('bible_reading_progress').upsert({
    user_id: user.id,
    book: progress.book,
    chapter: progress.chapter,
    verse: progress.verse ?? null,
    translation: progress.translation,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchReadingProgress(): Promise<ReadingProgress | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('bible_reading_progress')
    .select('book, chapter, verse, translation, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return {
    book: data.book,
    chapter: data.chapter,
    verse: data.verse ?? undefined,
    translation: data.translation as BibleTranslation,
    updatedAt: data.updated_at,
  };
}
