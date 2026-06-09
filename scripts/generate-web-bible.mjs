import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_SHA256 = 'fddfe4439974babae472bba881450ce7f54720e1f9db486092ac4dd0253ba992';
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
const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? 'src/assets/bible/web.json';

if (!sourcePath) {
  throw new Error(
    'Usage: node scripts/generate-web-bible.mjs <engwebp_vpl.txt> [output.json]',
  );
}

const source = await readFile(sourcePath);
const checksum = createHash('sha256').update(source).digest('hex');
if (checksum !== EXPECTED_SHA256) {
  throw new Error(`Unexpected WEB source checksum: ${checksum}`);
}

const books = {};
for (const line of source.toString('utf8').split(/\r?\n/)) {
  if (!line.trim()) {
    continue;
  }
  const match = line.match(/^([1-3A-Z]{3}) (\d+):(\d+) ?(.*)$/u);
  if (!match) {
    throw new Error(`Could not parse WEB source line: ${line.slice(0, 80)}`);
  }
  const [, sourceBookId, chapterText, verseText, text] = match;
  const bookId = BOOK_ID_ALIASES[sourceBookId] ?? sourceBookId;
  const chapter = Number(chapterText);
  const verse = Number(verseText);
  if (!text) {
    continue;
  }
  const chapters = books[bookId] ?? (books[bookId] = []);
  const verses = chapters[chapter - 1] ?? (chapters[chapter - 1] = []);
  verses.push([verse, text]);
}

const output = {
  metadata: {
    translation: 'WEB',
    title: 'World English Bible',
    edition: 'Protestant 66-book edition, 2020 stable text',
    source: 'https://ebible.org/find/details.php?id=engwebp',
    sourceUpdated: '2026-05-22',
    sourceSha256: EXPECTED_SHA256,
    license: 'Public domain',
  },
  books,
};

const resolvedOutputPath = path.resolve(outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Generated ${outputPath} with ${Object.keys(books).length} books.`);
