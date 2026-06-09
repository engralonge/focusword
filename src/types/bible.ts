export type BibleTranslation = 'KJV' | 'NIV' | 'ESV';

export type BibleVerse = {
  number: number;
  text: string;
};

export type BibleChapter = {
  book: string;
  chapter: number;
  verses: BibleVerse[];
  copyright?: string;
  source: 'offline' | 'provider';
};

export type VerseSearchResult = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: BibleTranslation;
  reference: string;
};

export type BibleAnnotationKind = 'highlight' | 'bookmark' | 'note';

export type BibleAnnotation = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  translation: BibleTranslation;
  kind: BibleAnnotationKind;
  note?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReadingProgress = {
  book: string;
  chapter: number;
  verse?: number;
  translation: BibleTranslation;
  updatedAt: string;
};
