import { createClient } from 'npm:@supabase/supabase-js@2';

export async function enforceRateLimit(
  request: Request,
  action: 'ai_summary' | 'bible_content' | 'livekit_token',
): Promise<{ response?: Response; userId?: string }> {
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !supabaseUrl || !anonKey) {
    return { response: new Response('Authentication required', { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { response: new Response('Invalid session', { status: 401 }) };
  }

  const { data: allowed, error } = await supabase.rpc('consume_api_quota', {
    requested_action: action,
  });
  if (error) {
    return { response: new Response('Quota service unavailable', { status: 503 }) };
  }
  if (!allowed) {
    return { response: new Response('Too many requests', { status: 429 }) };
  }
  return { userId: userData.user.id };
}

export function rateLimitMessage(
  response: Response,
  limitMessage: string,
): string {
  if (response.status === 429) return limitMessage;
  if (response.status === 401) return 'Authentication required';
  return 'Request protection is temporarily unavailable';
}
