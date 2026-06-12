import kjvData from '@/assets/bible/kjv.json';
import { BIBLE_BOOKS } from '@/constants/bible';
import type { BibleChapter, VerseSearchResult } from '@/types/bible';

type CompactVerse = [number, string];
type KjvData = {
  metadata: {
    title: string;
    edition: string;
    source: string;
    sourceUpdated: string;
    sourceSha256: string;
    license: string;
  };
  books: Record<string, CompactVerse[][]>;
};

const data = kjvData as unknown as KjvData;
const bookNameById = new Map(BIBLE_BOOKS.map((book) => [book.id, book.name]));

export const KJV_COPYRIGHT =
  `${data.metadata.title}. ${data.metadata.edition}. ${data.metadata.license}. Source: eBible.org.`;

export function getKjvChapter(
  bookId: string,
  book: string,
  chapter: number,
): BibleChapter | null {
  const verses = data.books[bookId]?.[chapter - 1];
  if (!verses?.length) {
    return null;
  }
  return {
    book,
    chapter,
    verses: verses.map(([number, text]) => ({ number, text })),
    copyright: KJV_COPYRIGHT,
    source: 'offline',
  };
}

export function searchKjvVerses(
  query: string,
  limit = 12,
): VerseSearchResult[] {
  const normalized = query.trim().toLowerCase();
  const referenceMatch = normalized.match(/^(.+?)\s+(\d+):(\d+)$/);
  const results: VerseSearchResult[] = [];

  for (const [bookId, chapters] of Object.entries(data.books)) {
    const book = bookNameById.get(bookId);
    if (!book) {
      continue;
    }
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      for (const [verse, text] of chapters[chapterIndex] ?? []) {
        const chapter = chapterIndex + 1;
        const reference = `${book} ${chapter}:${verse}`;
        const searchableText = text.toLowerCase().replace(/[[\]]/g, '');
        const matches = referenceMatch
          ? book.toLowerCase().startsWith(referenceMatch[1]) &&
            chapter === Number(referenceMatch[2]) &&
            verse === Number(referenceMatch[3])
          : reference.toLowerCase().includes(normalized) ||
            searchableText.includes(normalized);
        if (matches) {
          results.push({
            book,
            chapter,
            verse,
            text,
            translation: 'KJV',
            reference,
          });
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }
  }
  return results;
}
