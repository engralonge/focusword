import { BIBLE_BOOKS } from '@/constants/bible';
import { getWebChapter } from '@/services/bible/webBible';

describe('bundled World English Bible', () => {
  it.each(BIBLE_BOOKS)('contains every chapter of $name', (book) => {
    expect(getWebChapter(book.id, book.name, 1)?.verses.length).toBeGreaterThan(0);
    expect(
      getWebChapter(book.id, book.name, book.chapters)?.verses.length,
    ).toBeGreaterThan(0);
  });
});
