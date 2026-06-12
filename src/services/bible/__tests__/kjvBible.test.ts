import { BIBLE_BOOKS } from '@/constants/bible';
import { getKjvChapter, searchKjvVerses } from '@/services/bible/kjvBible';

describe('bundled King James Version', () => {
  it.each(BIBLE_BOOKS)('contains every chapter of $name', (book) => {
    expect(getKjvChapter(book.id, book.name, 1)?.verses.length).toBeGreaterThan(0);
    expect(
      getKjvChapter(book.id, book.name, book.chapters)?.verses.length,
    ).toBeGreaterThan(0);
  });

  it('includes the complete opening and closing chapters', () => {
    const genesis = getKjvChapter('GEN', 'Genesis', 1);
    const revelation = getKjvChapter('REV', 'Revelation', 22);

    expect(genesis?.verses).toHaveLength(31);
    expect(genesis?.verses[0]?.text).toBe(
      'In the beginning God created the heaven and the earth.',
    );
    expect(revelation?.verses.at(-1)?.number).toBe(21);
    expect(genesis?.copyright).toContain('Public domain');
  });

  it('searches references and text without a provider', () => {
    expect(searchKjvVerses('John 3:16')).toHaveLength(1);
    expect(
      searchKjvVerses('The LORD is my shepherd').some(
        (result) => result.reference === 'Psalms 23:1',
      ),
    ).toBe(true);
  });
});
