import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { enforceRateLimit, rateLimitMessage } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SummaryRequest = {
  reference: string;
  translation: string;
  verses: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const quota = await enforceRateLimit(request, 'ai_summary');
  if (quota.response) {
    return json(
      { error: rateLimitMessage(quota.response, 'AI summary limit reached. Try again later.') },
      quota.response.status,
    );
  }

  const apiKey = Deno.env.get('XAI_API_KEY');
  if (!apiKey) {
    return json({ error: 'AI service is not configured' }, 503);
  }

  let input: SummaryRequest;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const reference = input.reference?.trim();
  const translation = input.translation?.trim();
  const verses = input.verses?.trim();
  if (!reference || !translation || !verses || verses.length > 12_000) {
    return json({ error: 'Invalid passage input' }, 400);
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('XAI_MODEL') ?? 'grok-4.3',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Summarize Bible passages for a study app in 3 to 5 concise sentences. Be warm, faithful to the supplied text, and avoid speculation.',
        },
        {
          role: 'user',
          content: `Summarize this passage (${translation}, ${reference}):\n\n${verses}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error('xAI request failed', response.status);
    return json({ error: 'The AI study service is temporarily unavailable' }, 502);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = data.choices?.[0]?.message?.content?.trim();
  return summary
    ? json({ summary })
    : json({ error: 'The AI service returned an empty response' }, 502);
});
