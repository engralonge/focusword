import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { enforceRateLimit, rateLimitMessage } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Translation = 'KJV' | 'NIV' | 'ESV';
type ContentNode = {
  type?: string;
  name?: string;
  text?: string;
  attrs?: { number?: string; verseId?: string };
  items?: ContentNode[];
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bibleIdFor(translation: Translation): string | undefined {
  return Deno.env.get(`API_BIBLE_${translation}_ID`);
}

async function apiBible(path: string): Promise<Response> {
  const apiKey = Deno.env.get('API_BIBLE_KEY');
  if (!apiKey) {
    throw new Error('Bible provider is not configured');
  }
  return fetch(`https://rest.api.bible/v1${path}`, {
    headers: { 'api-key': apiKey },
  });
}

function collectVerses(nodes: ContentNode[]): Array<{ number: number; text: string }> {
  const verses = new Map<number, string[]>();
  let currentVerse: number | null = null;

  const visit = (node: ContentNode) => {
    if (node.name === 'verse' && node.attrs?.number) {
      const parsed = Number(node.attrs.number);
      currentVerse = Number.isFinite(parsed) ? parsed : currentVerse;
      if (currentVerse && !verses.has(currentVerse)) {
        verses.set(currentVerse, []);
      }
    } else if (node.type === 'text' && node.text && currentVerse) {
      const isVerseText = Boolean(node.attrs?.verseId) || node.text.trim().length > 0;
      if (isVerseText) {
        verses.get(currentVerse)?.push(node.text);
      }
    }
    node.items?.forEach(visit);
  };

  nodes.forEach(visit);
  return [...verses.entries()].map(([number, parts]) => ({
    number,
    text: parts.join('').replace(/\s+/g, ' ').trim(),
  })).filter((verse) => verse.text.length > 0);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const quota = await enforceRateLimit(request, 'bible_content');
  if (quota.response) {
    return json(
      { error: rateLimitMessage(quota.response, 'Bible content limit reached. Try again shortly.') },
      quota.response.status,
    );
  }

  let body: {
    action?: 'chapter' | 'search';
    translation?: Translation;
    bookId?: string;
    book?: string;
    chapter?: number;
    query?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const translation = body.translation;
  if (!translation || !['KJV', 'NIV', 'ESV'].includes(translation)) {
    return json({ error: 'Unsupported translation' }, 400);
  }
  const bibleId = bibleIdFor(translation);
  if (!bibleId) {
    return json({ error: `${translation} is not configured for this deployment` }, 503);
  }

  try {
    if (body.action === 'chapter') {
      if (!body.bookId || !body.book || !Number.isInteger(body.chapter) || body.chapter! < 1) {
        return json({ error: 'Invalid chapter request' }, 400);
      }
      const chapterId = `${body.bookId}.${body.chapter}`;
      const response = await apiBible(
        `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}` +
          '?content-type=json&include-notes=false&include-titles=false' +
          '&include-chapter-numbers=false&include-verse-numbers=true',
      );
      if (!response.ok) {
        console.error('API.Bible chapter failed', response.status);
        return json({ error: 'Chapter is unavailable from the Bible provider' }, response.status);
      }
      const payload = await response.json() as {
        data?: { content?: ContentNode[]; copyright?: string };
      };
      const verses = collectVerses(payload.data?.content ?? []);
      if (!verses.length) {
        return json({ error: 'The Bible provider returned no verse content' }, 502);
      }
      return json({
        chapter: {
          book: body.book,
          chapter: body.chapter,
          verses,
          copyright: payload.data?.copyright,
          source: 'provider',
        },
      });
    }

    if (body.action === 'search') {
      const query = body.query?.trim();
      if (!query || query.length < 2 || query.length > 200) {
        return json({ error: 'Search query must be between 2 and 200 characters' }, 400);
      }
      const params = new URLSearchParams({ query, limit: '20', offset: '0' });
      const response = await apiBible(
        `/bibles/${encodeURIComponent(bibleId)}/search?${params.toString()}`,
      );
      if (!response.ok) {
        console.error('API.Bible search failed', response.status);
        return json({ error: 'Bible search is temporarily unavailable' }, response.status);
      }
      const payload = await response.json() as {
        data?: {
          verses?: Array<{
            id: string;
            reference: string;
            text: string;
          }>;
        };
      };
      const results = (payload.data?.verses ?? []).map((verse) => {
        const parts = verse.id.split('.');
        return {
          bookId: parts[0],
          chapter: Number(parts[1]),
          verse: Number(parts[2]),
          reference: verse.reference,
          text: verse.text.trim(),
          translation,
        };
      });
      return json({ results });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    console.error('Bible content function failed', error);
    return json({ error: 'Bible content service is temporarily unavailable' }, 502);
  }
});
