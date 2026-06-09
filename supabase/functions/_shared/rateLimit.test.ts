import {
  assertEquals,
} from 'jsr:@std/assert@1';
import { rateLimitMessage } from './rateLimit.ts';

Deno.test('rateLimitMessage preserves distinct failure causes', () => {
  assertEquals(
    rateLimitMessage(new Response('', { status: 429 }), 'Limit reached'),
    'Limit reached',
  );
  assertEquals(
    rateLimitMessage(new Response('', { status: 401 }), 'Limit reached'),
    'Authentication required',
  );
  assertEquals(
    rateLimitMessage(new Response('', { status: 503 }), 'Limit reached'),
    'Request protection is temporarily unavailable',
  );
});
