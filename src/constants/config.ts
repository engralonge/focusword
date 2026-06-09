export type AppEnvironment = 'development' | 'preview' | 'production';

export const config = {
  appName: 'Citizens Bible Community',
  environment: (process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development') as AppEnvironment,
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  legal: {
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '',
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
    supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL ?? '',
  },
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    config.supabase.url &&
      config.supabase.anonKey &&
      !config.supabase.url.includes('your-project') &&
      config.supabase.anonKey !== 'your-anon-key',
  );
}

export function isConfiguredPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname !== 'example.com';
  } catch {
    return false;
  }
}

export function getConfigurationError(): string | null {
  if (!isSupabaseConfigured()) {
    return 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }
  if (!['development', 'preview', 'production'].includes(config.environment)) {
    return `Invalid EXPO_PUBLIC_ENVIRONMENT: ${config.environment}`;
  }
  if (config.environment === 'production') {
    const requiredUrls = Object.values(config.legal);
    if (requiredUrls.some((url) => !isConfiguredPublicUrl(url))) {
      return 'Production builds require HTTPS privacy policy, terms, and support URLs.';
    }
  }
  return null;
}
