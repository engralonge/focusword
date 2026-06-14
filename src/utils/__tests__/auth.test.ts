import {
  getAuthErrorMessage,
  getAccountRestrictionMessage,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateProfile,
} from '@/utils/auth';

describe('auth domain validation', () => {
  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com');
    expect(validateEmail('reader@example.com')).toBeNull();
    expect(validateEmail('reader@localhost')).toBe('Enter a valid email address.');
    expect(validateEmail('reader example.com')).toBe('Enter a valid email address.');
  });

  it('enforces password length and confirmation', () => {
    expect(validatePassword('short')).toContain('8 characters');
    expect(validatePassword('long-enough')).toBeNull();
    expect(validatePasswordConfirmation('long-enough', 'different')).toBe(
      'Passwords do not match.',
    );
    expect(validatePasswordConfirmation('long-enough', 'long-enough')).toBeNull();
  });

  it('enforces profile limits', () => {
    expect(validateProfile('A')).toContain('between 2 and 80');
    expect(validateProfile('Reader', 'A'.repeat(281))).toContain('280');
    expect(validateProfile('Reader', 'Learning together.')).toBeNull();
  });

  it('maps Supabase auth codes to helpful messages', () => {
    expect(getAuthErrorMessage('email_not_confirmed', 'fallback')).toContain('Confirm');
    expect(getAuthErrorMessage('over_email_send_rate_limit', 'fallback')).toContain('wait');
    expect(getAuthErrorMessage('invalid_credentials', 'fallback')).toContain('incorrect');
    expect(getAuthErrorMessage('unknown', 'fallback')).toBe('fallback');
  });

  it('describes active account sanctions', () => {
    const now = Date.parse('2026-06-12T12:00:00.000Z');
    expect(
      getAccountRestrictionMessage({
        id: 'member',
        displayName: 'Member',
        accountStatus: 'banned',
      }, now),
    ).toContain('banned');
    expect(
      getAccountRestrictionMessage({
        id: 'member',
        displayName: 'Member',
        accountStatus: 'suspended',
        suspendedUntil: '2026-06-13T12:00:00.000Z',
      }, now),
    ).toContain('suspended until');
    expect(
      getAccountRestrictionMessage({
        id: 'member',
        displayName: 'Member',
        accountStatus: 'suspended',
        suspendedUntil: '2026-06-11T12:00:00.000Z',
      }, now),
    ).toBeNull();
  });
});
