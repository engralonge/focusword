import { Platform } from 'react-native';
import { config } from '@/constants/config';
import { getSupabaseClient } from '@/services/supabase/client';

export async function reportError(
  error: Error,
  context: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('app_error_events').insert({
      user_id: data.user.id,
      message: error.message.slice(0, 2000),
      stack: error.stack?.slice(0, 12000) ?? null,
      context,
      platform: ['android', 'ios', 'web', 'windows', 'macos'].includes(Platform.OS)
        ? Platform.OS
        : 'unknown',
      environment: config.environment,
    });
  } catch {
    // Error reporting must never interrupt the user or recurse.
  }
}
