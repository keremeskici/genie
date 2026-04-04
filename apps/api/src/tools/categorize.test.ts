import { describe, it, expect } from 'vitest';
import { inferCategory, VALID_CATEGORIES } from './categorize';

describe('VALID_CATEGORIES', () => {
  it('contains exactly the five expected categories', () => {
    expect(VALID_CATEGORIES).toEqual(['food', 'transport', 'entertainment', 'bills', 'transfers']);
  });
});

describe('inferCategory', () => {
  it('returns "food" for dinner description', () => {
    expect(inferCategory('dinner with Alice')).toBe('food');
  });

  it('returns "food" for lunch keyword', () => {
    expect(inferCategory('paying for lunch')).toBe('food');
  });

  it('returns "food" for restaurant keyword', () => {
    expect(inferCategory('sushi restaurant tab')).toBe('food');
  });

  it('returns "food" for coffee keyword', () => {
    expect(inferCategory('coffee at cafe')).toBe('food');
  });

  it('returns "food" for grocery keyword', () => {
    expect(inferCategory('grocery run')).toBe('food');
  });

  it('returns "transport" for uber ride', () => {
    expect(inferCategory('uber ride home')).toBe('transport');
  });

  it('returns "transport" for taxi keyword', () => {
    expect(inferCategory('taxi from airport')).toBe('transport');
  });

  it('returns "transport" for bus keyword', () => {
    expect(inferCategory('bus fare')).toBe('transport');
  });

  it('returns "transport" for gas keyword', () => {
    expect(inferCategory('gas station fill up')).toBe('transport');
  });

  it('returns "entertainment" for movie tickets', () => {
    expect(inferCategory('movie tickets')).toBe('entertainment');
  });

  it('returns "entertainment" for concert keyword', () => {
    expect(inferCategory('concert tickets')).toBe('entertainment');
  });

  it('returns "entertainment" for bar keyword', () => {
    expect(inferCategory('bar tab split')).toBe('entertainment');
  });

  it('returns "bills" for rent payment', () => {
    expect(inferCategory('rent payment')).toBe('bills');
  });

  it('returns "bills" for utility keyword', () => {
    expect(inferCategory('utility bill')).toBe('bills');
  });

  it('returns "bills" for internet keyword', () => {
    expect(inferCategory('internet bill this month')).toBe('bills');
  });

  it('returns "bills" for phone keyword', () => {
    expect(inferCategory('phone plan payment')).toBe('bills');
  });

  it('returns "transfers" for generic send description', () => {
    expect(inferCategory('sending to Bob')).toBe('transfers');
  });

  it('returns "transfers" when description is null', () => {
    expect(inferCategory(null)).toBe('transfers');
  });

  it('returns "transfers" when description is undefined', () => {
    expect(inferCategory(undefined)).toBe('transfers');
  });

  it('returns "transfers" when description is empty string', () => {
    expect(inferCategory('')).toBe('transfers');
  });

  it('returns "transfers" for random gibberish', () => {
    expect(inferCategory('random gibberish xyz')).toBe('transfers');
  });

  it('is case-insensitive — handles uppercase DINNER', () => {
    expect(inferCategory('DINNER at the steakhouse')).toBe('food');
  });

  it('is case-insensitive — handles mixed-case UBER', () => {
    expect(inferCategory('UBER ride')).toBe('transport');
  });
});
