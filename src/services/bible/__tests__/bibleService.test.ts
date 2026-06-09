import { fetchChapter, searchVerses } from '@/services/bible/bibleService';

describe('bibleService', () => {
  it('returns an offline chapter in the selected translation', async () => {
    const chapter = await fetchChapter('John', 3, 'KJV');

    expect(chapter.book).toBe('John');
    expect(chapter.chapter).toBe(3);
    expect(chapter.verses.find((verse) => verse.number === 16)?.text).toContain(
      'God so loved the world',
    );
  });

  it('returns a clear fallback for unavailable chapters', async () => {
    await expect(fetchChapter('Genesis', 1, 'ESV')).rejects.toThrow(
      'Connect FocusWord to load this chapter',
    );
  });

  it('searches by exact reference', async () => {
    const results = await searchVerses('John 3:16', 'KJV');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      reference: 'John 3:16',
      translation: 'KJV',
    });
  });

  it('searches verse text case-insensitively', async () => {
    const results = await searchVerses('SHEPHERD', 'NIV');

    expect(results.some((result) => result.reference === 'Psalms 23:1')).toBe(true);
  });

  it('does not search single-character queries', async () => {
    await expect(searchVerses('a', 'KJV')).resolves.toEqual([]);
  });
});
