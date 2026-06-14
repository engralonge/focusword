import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import type { UserProfile } from '@/types';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateProfile,
  getAccountRestrictionMessage,
  getAuthErrorMessage,
} from '@/utils/auth';

export type AuthSession = {
  user: UserProfile;
  accessToken?: string;
};

function mapSupabaseUser(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? undefined,
    displayName:
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Guest',
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ session: AuthSession | null; error: string | null }> {
  const validationError = validateEmail(email) ?? validatePassword(password);
  if (validationError) {
    return { session: null, error: validationError };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { session: null, error: 'Supabase is not configured. Add keys to .env' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) {
    return { session: null, error: getAuthErrorMessage(error.code, error.message) };
  }
  if (!data.user) {
    return { session: null, error: 'No user returned' };
  }
  const profile = await fetchUserProfile();
  const restriction = getAccountRestrictionMessage(profile);
  if (restriction) {
    await supabase.auth.signOut();
    return { session: null, error: restriction };
  }
  return {
    session: {
      user: profile ?? mapSupabaseUser(data.user),
      accessToken: data.session?.access_token,
    },
    error: null,
  };
}

export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<{ session: AuthSession | null; error: string | null }> {
  const validationError =
    validateProfile(displayName) ?? validateEmail(email) ?? validatePassword(password);
  if (validationError) {
    return { session: null, error: validationError };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { session: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: Linking.createURL('auth/callback'),
    },
  });
  if (error) {
    return { session: null, error: getAuthErrorMessage(error.code, error.message) };
  }
  return {
    session: data.user && data.session
      ? { user: mapSupabaseUser(data.user), accessToken: data.session.access_token }
      : null,
    error: null,
  };
}

export async function resendSignupConfirmation(email: string): Promise<string | null> {
  const validationError = validateEmail(email);
  if (validationError) return validationError;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 'Supabase is not configured.';
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: Linking.createURL('auth/callback'),
    },
  });
  return error ? getAuthErrorMessage(error.code, error.message) : null;
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const validationError = validateEmail(email);
  if (validationError) return validationError;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 'Supabase is not configured.';
  }
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: Linking.createURL('auth/reset-password'),
  });
  return error ? getAuthErrorMessage(error.code, error.message) : null;
}

export async function updatePassword(password: string): Promise<string | null> {
  const validationError = validatePassword(password);
  if (validationError) return validationError;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 'Supabase is not configured.';
  }
  const { error } = await supabase.auth.updateUser({ password });
  return error?.message ?? null;
}

export async function updateUserProfile(
  displayName: string,
  bio: string,
): Promise<{ user: UserProfile | null; error: string | null }> {
  const validationError = validateProfile(displayName, bio);
  if (validationError) {
    return { user: null, error: validationError };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { user: null, error: 'Supabase is not configured.' };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { user: null, error: userError?.message ?? 'Your session has expired.' };
  }

  const name = displayName.trim();
  const normalizedBio = bio.trim();
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: name, bio: normalizedBio || null })
    .eq('id', userData.user.id);
  if (profileError) {
    return { user: null, error: profileError.message };
  }

  const { data, error } = await supabase.auth.updateUser({
    data: { display_name: name },
  });
  if (error || !data.user) {
    return { user: null, error: error?.message ?? 'Could not update your profile.' };
  }
  return {
    user: { ...mapSupabaseUser(data.user), bio: normalizedBio || undefined },
    error: null,
  };
}

export async function updateUserAvatar(
  uri: string | null,
  selectedMimeType?: string,
): Promise<{ user: UserProfile | null; error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { user: null, error: 'Supabase is not configured.' };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { user: null, error: userError?.message ?? 'Your session has expired.' };
  }

  const folder = userData.user.id;
  const { data: existing } = await supabase.storage.from('avatars').list(folder);
  if (existing?.length) {
    await supabase.storage
      .from('avatars')
      .remove(existing.map((item) => `${folder}/${item.name}`));
  }

  let avatarUrl: string | null = null;
  if (uri) {
    const response = await fetch(uri);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return { user: null, error: 'Profile photos must be smaller than 5 MB.' };
    }
    const contentType =
      selectedMimeType ||
      response.headers.get('content-type')?.split(';')[0] ||
      'image/jpeg';
    const extension =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `${folder}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) {
      return { user: null, error: uploadError.message };
    }
    const publicResult = supabase.storage.from('avatars').getPublicUrl(path);
    avatarUrl = `${publicResult.data.publicUrl}?v=${Date.now()}`;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userData.user.id);
  if (profileError) {
    return { user: null, error: profileError.message };
  }
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });
  if (metadataError) {
    return { user: null, error: metadataError.message };
  }
  return { user: await fetchUserProfile(), error: null };
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return null;
  }
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, bio, role, account_status, suspended_until')
    .eq('id', authData.user.id)
    .maybeSingle();
  return {
    ...mapSupabaseUser(authData.user),
    displayName: data?.display_name?.trim() || mapSupabaseUser(authData.user).displayName,
    avatarUrl: data?.avatar_url ?? undefined,
    bio: data?.bio ?? undefined,
    role: data?.role as UserProfile['role'],
    accountStatus: data?.account_status as UserProfile['accountStatus'],
    suspendedUntil: data?.suspended_until ?? undefined,
  };
}

export async function handleAuthCallback(url: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 'Supabase is not configured.';
  }

  const normalizedUrl = url.replace('#', '?');
  const parsed = Linking.parse(normalizedUrl);
  const callbackError = parsed.queryParams?.error_description ?? parsed.queryParams?.error;
  if (typeof callbackError === 'string') {
    return callbackError.replace(/\+/g, ' ');
  }
  const accessToken = parsed.queryParams?.access_token;
  const refreshToken = parsed.queryParams?.refresh_token;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return null;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function deleteAccount(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 'Supabase is not configured.';
  }
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('delete-account');
  if (error || data?.error) {
    return data?.error ?? error?.message ?? 'Could not delete your account.';
  }
  await supabase.auth.signOut({ scope: 'local' });
  return null;
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    return null;
  }
  return {
    user: mapSupabaseUser(data.session.user),
    accessToken: data.session.access_token,
  };
}

export function onAuthStateChange(
  callback: (session: AuthSession | null, event: AuthChangeEvent) => void,
): (() => void) | undefined {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
    if (!session?.user) {
      callback(null, _event);
      return;
    }
    callback({
      user: mapSupabaseUser(session.user),
      accessToken: session.access_token,
    }, _event);
  });
  return () => data.subscription.unsubscribe();
}
