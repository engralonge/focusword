import { fetchChapter, searchVerses } from '@/services/bible/bibleService';

describe('bibleService', () => {
  it('includes the complete WEB canon offline', async () => {
    const genesis = await fetchChapter('Genesis', 1, 'WEB');
    const revelation = await fetchChapter('Revelation', 22, 'WEB');

    expect(genesis.verses).toHaveLength(31);
    expect(genesis.verses[0]?.text).toBe(
      'In the beginning, God created the heavens and the earth.',
    );
    expect(revelation.verses.at(-1)?.number).toBe(21);
    expect(genesis.copyright).toContain('Public domain');
  });

  it('returns an offline chapter in the selected translation', async () => {
    const chapter = await fetchChapter('John', 3, 'KJV');

    expect(chapter.book).toBe('John');
    expect(chapter.chapter).toBe(3);
    expect(chapter.verses.find((verse) => verse.number === 16)?.text).toContain(
      'God so loved the world',
    );
    expect(chapter.verses).toHaveLength(36);
    expect(chapter.source).toBe('offline');
    expect(chapter.copyright).toContain('Public domain');
  });

  it('returns a clear fallback for unavailable chapters', async () => {
    await expect(fetchChapter('Genesis', 1, 'ESV')).rejects.toThrow(
      'WEB and KJV are available fully offline',
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

  it('searches the complete WEB text offline', async () => {
    const exact = await searchVerses('Revelation 22:21', 'WEB');
    const phrase = await searchVerses('In the beginning, God created', 'WEB');

    expect(exact[0]).toMatchObject({
      reference: 'Revelation 22:21',
      translation: 'WEB',
    });
    expect(phrase.some((result) => result.reference === 'Genesis 1:1')).toBe(true);
  });

  it('does not search single-character queries', async () => {
    await expect(searchVerses('a', 'KJV')).resolves.toEqual([]);
  });
});
