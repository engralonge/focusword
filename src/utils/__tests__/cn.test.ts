import { cn } from '@/utils/cn';

describe('cn', () => {
  it('joins truthy class names in order', () => {
    expect(cn('base', false, null, undefined, 'active')).toBe('base active');
  });
});
