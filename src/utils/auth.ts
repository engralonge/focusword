import type { UserProfile } from '@/types';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? null
    : 'Enter a valid email address.';
}

export function validatePassword(password: string): string | null {
  return password.length >= 8
    ? null
    : 'Use at least 8 characters for your password.';
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  return validatePassword(password) ?? (
    password === confirmation ? null : 'Passwords do not match.'
  );
}

export function validateProfile(displayName: string, bio = ''): string | null {
  const nameLength = displayName.trim().length;
  if (nameLength < 2 || nameLength > 80) {
    return 'Display names must be between 2 and 80 characters.';
  }
  if (bio.trim().length > 280) {
    return 'Bios cannot exceed 280 characters.';
  }
  return null;
}

export function getAuthErrorMessage(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case 'email_not_confirmed':
      return 'Confirm your email address before signing in.';
    case 'over_email_send_rate_limit':
      return 'Too many confirmation emails were requested. Please wait a few minutes and try again.';
    case 'over_request_rate_limit':
      return 'Too many requests were made. Please wait a few minutes and try again.';
    case 'email_address_not_authorized':
      return 'Email delivery is not configured for this address. Please contact support.';
    case 'email_address_invalid':
      return 'Enter a valid email address that can receive messages.';
    case 'invalid_credentials':
      return 'The email or password is incorrect.';
    case 'weak_password':
      return 'Choose a stronger password and try again.';
    default:
      return fallback;
  }
}

export function getAccountRestrictionMessage(
  profile: UserProfile | null,
  now = Date.now(),
): string | null {
  if (profile?.accountStatus === 'banned') {
    return 'This account has been banned. Contact support for help.';
  }
  if (
    profile?.accountStatus === 'suspended' &&
    profile.suspendedUntil &&
    new Date(profile.suspendedUntil).getTime() > now
  ) {
    return `This account is suspended until ${new Date(
      profile.suspendedUntil,
    ).toLocaleString()}.`;
  }
  return null;
}
