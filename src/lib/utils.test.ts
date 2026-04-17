import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('handles conditional objects', () => {
    expect(cn({ hidden: false, flex: true })).toBe('flex');
  });

  it('merges conflicting tailwind utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('merges conflicting text utilities', () => {
    expect(cn('text-sm text-lg')).toBe('text-lg');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles array inputs', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
});
