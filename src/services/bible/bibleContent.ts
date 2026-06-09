import type { BibleChapter, BibleTranslation, BibleVerse } from '@/types/bible';

type ChapterKey = `${string}:${number}`;

const JOHN_3: Record<BibleTranslation, BibleVerse[]> = {
  KJV: [
    { number: 1, text: 'There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:' },
    { number: 2, text: 'The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God: for no man can do these miracles that thou doest, except God be with him.' },
    { number: 3, text: 'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.' },
    { number: 4, text: 'Nicodemus saith unto him, How can a man be born when he is old? can he enter the second time into his mother\'s womb, and be born?' },
    { number: 5, text: 'Jesus answered, Verily, verily, I say unto thee, Except a man be born of water and of the Spirit, he cannot enter into the kingdom of God.' },
    { number: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
    { number: 17, text: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.' },
  ],
  NIV: [
    { number: 1, text: 'Now there was a Pharisee, a man named Nicodemus who was a member of the Jewish ruling council.' },
    { number: 2, text: 'He came to Jesus at night and said, "Rabbi, we know that you are a teacher who has come from God. For no one could perform the signs you are doing if God were not with him."' },
    { number: 3, text: 'Jesus replied, "Very truly I tell you, no one can see the kingdom of God unless they are born again."' },
    { number: 4, text: '“How can someone be born when they are old?” Nicodemus asked. “Surely they cannot enter a second time into their mother’s womb to be born!”' },
    { number: 5, text: 'Jesus answered, "Very truly I tell you, no one can enter the kingdom of God unless they are born of water and the Spirit."' },
    { number: 16, text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
    { number: 17, text: 'For God did not send his Son into the world to condemn the world, but to save the world through him.' },
  ],
  ESV: [
    { number: 1, text: 'Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.' },
    { number: 2, text: 'This man came to Jesus by night and said to him, "Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do unless God is with him."' },
    { number: 3, text: 'Jesus answered him, "Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God."' },
    { number: 4, text: 'Nicodemus said to him, "How can a man be born when he is old? Can he enter a second time into his mother\'s womb and be born?"' },
    { number: 5, text: 'Jesus answered, "Truly, truly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God."' },
    { number: 16, text: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.' },
    { number: 17, text: 'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.' },
  ],
};

const PSALM_23: Record<BibleTranslation, BibleVerse[]> = {
  KJV: [
    { number: 1, text: 'The LORD is my shepherd; I shall not want.' },
    { number: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' },
    { number: 3, text: 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.' },
    { number: 4, text: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.' },
  ],
  NIV: [
    { number: 1, text: 'The LORD is my shepherd, I lack nothing.' },
    { number: 2, text: 'He makes me lie down in green pastures, he leads me beside quiet waters,' },
    { number: 3, text: 'he refreshes my soul. He guides me along the right paths for his name\'s sake.' },
    { number: 4, text: 'Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.' },
  ],
  ESV: [
    { number: 1, text: 'The LORD is my shepherd; I shall not want.' },
    { number: 2, text: 'He makes me lie down in green pastures. He leads me beside still waters.' },
    { number: 3, text: 'He restores my soul. He leads me in paths of righteousness for his name\'s sake.' },
    { number: 4, text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.' },
  ],
};

const CHAPTERS: Partial<Record<ChapterKey, Record<BibleTranslation, BibleVerse[]>>> = {
  'John:3': JOHN_3,
  'Psalms:23': PSALM_23,
};

export function getChapterContent(
  book: string,
  chapter: number,
  translation: BibleTranslation,
): BibleChapter | null {
  const key = `${book}:${chapter}` as ChapterKey;
  const data = CHAPTERS[key];
  if (!data) {
    return null;
  }
  return { book, chapter, verses: data[translation], source: 'offline' };
}

export function getAllSearchableVerses(): Array<{
  book: string;
  chapter: number;
  verse: number;
  translations: Record<BibleTranslation, string>;
}> {
  const results: Array<{
    book: string;
    chapter: number;
    verse: number;
    translations: Record<BibleTranslation, string>;
  }> = [];

  for (const [key, translations] of Object.entries(CHAPTERS)) {
    if (!translations) {
      continue;
    }
    const [book, chapterStr] = key.split(':');
    const chapter = Number(chapterStr);
    const verseNumbers = new Set<number>();
    for (const verses of Object.values(translations)) {
      verses.forEach((v) => verseNumbers.add(v.number));
    }
    for (const verse of verseNumbers) {
      const texts = {} as Record<BibleTranslation, string>;
      for (const [t, verses] of Object.entries(translations) as [BibleTranslation, BibleVerse[]][]) {
        const found = verses.find((v) => v.number === verse);
        if (found) {
          texts[t] = found.text;
        }
      }
      results.push({ book, chapter, verse, translations: texts });
    }
  }
  return results;
}
