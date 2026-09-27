import { describe, expect, it } from 'vitest';
import { focusedScrollTarget, keyboardOverlap, type KeyboardGeometry } from '../../mobile/lib/keyboard/geometry';

const samsung: KeyboardGeometry = { outerTop: 195, outerBottom: 1510, viewportTop: 195, viewportBottom: 1510,
  keyboardTop: 928, focusTop: 1117, focusBottom: 1243, scrollY: 515 };

describe('measured Android IME reachability (same-coordinate geometry)', () => {
  it('proves old Fitness Goal range fails and overlap-bounded range reaches input, context and Save', () => {
    const content = 1838, closedHeight = 1315, oldMax = content - closedHeight;
    expect(oldMax).toBe(523);
    const neededForSave = samsung.scrollY + 1441 - 928;
    expect(neededForSave).toBe(1028);
    expect(oldMax).toBeLessThan(neededForSave);
    const overlap = keyboardOverlap(samsung);
    expect(overlap).toBe(582); // measured overlap, not full 672px IME inset
    const openMax = content - (closedHeight - overlap);
    expect(openMax).toBe(1105);
    for (const bottom of [1243, 1325, 1441]) expect(openMax).toBeGreaterThanOrEqual(samsung.scrollY + bottom - 928);
  });
  it('creates a reachable short Banking Goal even when closed scroll range is zero', () => {
    const content = 1315, saveBottom = 1360;
    const intrinsicContent = 1242; // flexGrow minimum disappears when viewport shrinks
    expect(content - 1315).toBe(0);
    expect(intrinsicContent - (1315 - keyboardOverlap(samsung))).toBeGreaterThanOrEqual(saveBottom - 928);
  });
  it('uses the settled IME boundary rather than the full viewport to reveal focus', () => {
    expect(focusedScrollTarget({ ...samsung, keyboardTop: null })).toBeNull();
    expect(focusedScrollTarget({ ...samsung, viewportBottom: 928 })).toBe(830);
  });
  it('does not double avoid an already resized parent or its bottom safe area', () => {
    expect(keyboardOverlap({ ...samsung, outerBottom: 928 })).toBe(0);
    expect(keyboardOverlap({ ...samsung, outerBottom: 838 })).toBe(0);
    expect(keyboardOverlap({ ...samsung, outerBottom: 1200 })).toBe(272);
  });
  it('restores the closed viewport without extra empty space', () => {
    expect(keyboardOverlap({ ...samsung, keyboardTop: null })).toBe(0);
  });
  it.each([800, 1000, 1200])('responds to changing IME geometry at %i without device constants', top => {
    expect(keyboardOverlap({ ...samsung, keyboardTop: top })).toBe(1510 - top);
  });
  it('is invariant under window translation and density conversion', () => {
    expect(keyboardOverlap({ ...samsung, outerTop: 245, outerBottom: 1560, keyboardTop: 978 })).toBe(582);
    expect(keyboardOverlap({ ...samsung, outerTop: 104, outerBottom: 1510 / 1.875, keyboardTop: 928 / 1.875 })).toBeCloseTo(582 / 1.875);
  });
  it('handles a tall large-text input and focus above the viewport', () => {
    expect(focusedScrollTarget({ ...samsung, viewportBottom: 928, focusTop: 100, focusBottom: 1000 })).toBe(420);
    expect(focusedScrollTarget({ ...samsung, focusTop: 100, focusBottom: 150 })).toBe(420);
  });
  it('does not move visible or absent focus and caps overlap to host height', () => {
    expect(focusedScrollTarget({ ...samsung, focusTop: 300, focusBottom: 400 })).toBeNull();
    expect(focusedScrollTarget({ ...samsung, focusTop: null, focusBottom: null })).toBeNull();
    expect(keyboardOverlap({ ...samsung, keyboardTop: 100 })).toBe(1315);
  });
});
