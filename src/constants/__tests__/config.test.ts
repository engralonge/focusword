import { isConfiguredPublicUrl } from '@/constants/config';

describe('production public URL validation', () => {
  it('accepts real HTTPS URLs', () => {
    expect(isConfiguredPublicUrl('https://focusword.app/privacy')).toBe(true);
  });

  it('rejects insecure, malformed, and placeholder URLs', () => {
    expect(isConfiguredPublicUrl('http://focusword.app/privacy')).toBe(false);
    expect(isConfiguredPublicUrl('not-a-url')).toBe(false);
    expect(isConfiguredPublicUrl('https://example.com/privacy')).toBe(false);
  });
});
