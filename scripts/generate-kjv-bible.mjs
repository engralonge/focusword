import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_SHA256 = 'bcd732dea06ada44e6d60e4371a4b22f89bda05148285ea82582527d5a7d624a';
const BOOK_ID_ALIASES = {
  SOL: 'SNG',
  EZE: 'EZK',
  JOE: 'JOL',
  NAH: 'NAM',
  MAR: 'MRK',
  JOH: 'JHN',
  PHI: 'PHP',
  JAM: 'JAS',
  '1JO': '1JN',
  '2JO': '2JN',
  '3JO': '3JN',
};
const CANON_BOOK_IDS = new Set([
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
  'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP',
  'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
]);
const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? 'src/assets/bible/kjv.json';

if (!sourcePath) {
  throw new Error(
    'Usage: node scripts/generate-kjv-bible.mjs <eng-kjv_vpl.txt> [output.json]',
  );
}

const source = await readFile(sourcePath);
const checksum = createHash('sha256').update(source).digest('hex');
if (checksum !== EXPECTED_SHA256) {
  throw new Error(`Unexpected KJV source checksum: ${checksum}`);
}

const books = {};
for (const line of source.toString('utf8').split(/\r?\n/)) {
  if (!line.trim()) {
    continue;
  }
  const match = line.match(/^([1-4A-Z]{3}) (\d+):(\d+) ?(.*)$/u);
  if (!match) {
    throw new Error(`Could not parse KJV source line: ${line.slice(0, 80)}`);
  }
  const [, sourceBookId, chapterText, verseText, rawText] = match;
  const bookId = BOOK_ID_ALIASES[sourceBookId] ?? sourceBookId;
  if (!CANON_BOOK_IDS.has(bookId)) {
    continue;
  }
  const text = rawText.replace(/^¶\s*/u, '').trim();
  if (!text) {
    continue;
  }
  const chapter = Number(chapterText);
  const verse = Number(verseText);
  const chapters = books[bookId] ?? (books[bookId] = []);
  const verses = chapters[chapter - 1] ?? (chapters[chapter - 1] = []);
  verses.push([verse, text]);
}

if (Object.keys(books).length !== CANON_BOOK_IDS.size) {
  throw new Error(`Expected 66 KJV books, generated ${Object.keys(books).length}`);
}

const output = {
  metadata: {
    translation: 'KJV',
    title: 'King James Version',
    edition: 'Standardized 1769 text, Protestant 66-book edition',
    source: 'https://ebible.org/find/details.php?id=eng-kjv',
    sourceUpdated: '2026-05-16',
    sourceSha256: EXPECTED_SHA256,
    license: 'Public domain outside the United Kingdom',
  },
  books,
};

const resolvedOutputPath = path.resolve(outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Generated ${outputPath} with ${Object.keys(books).length} books.`);
