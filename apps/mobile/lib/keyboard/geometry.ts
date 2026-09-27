/** All values share a single native screen coordinate space, in density-independent points. */
export type KeyboardGeometry = {
  outerTop: number; outerBottom: number;
  viewportTop: number; viewportBottom: number;
  keyboardTop: number | null;
  focusTop: number | null; focusBottom: number | null;
  scrollY: number;
};

export function keyboardOverlap(g: KeyboardGeometry): number {
  if (g.keyboardTop === null) return 0;
  return Math.max(0, g.outerBottom - Math.max(g.outerTop, g.keyboardTop));
}

export function focusedScrollTarget(g: KeyboardGeometry): number | null {
  if (g.keyboardTop === null || g.focusTop === null || g.focusBottom === null) return null;
  const bottom = Math.min(g.viewportBottom, g.keyboardTop);
  const height = Math.max(0, bottom - g.viewportTop);
  // A field taller than the viewport must expose its beginning; the rest stays scrollable.
  const delta = g.focusBottom - g.focusTop > height || g.focusTop < g.viewportTop
    ? g.focusTop - g.viewportTop : Math.max(0, g.focusBottom - bottom);
  return delta === 0 ? null : Math.max(0, g.scrollY + delta);
}
