/** Read-only rollover signal; never uploads evidence or runs accounting locally. */
export function subscribeToLocalDateChange(refresh: () => void, now = () => new Date()) {
  const date = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
  let previous = date();
  const timer = setInterval(() => {
    const current = date();
    if (current !== previous) { previous = current; refresh(); }
  }, 30_000);
  return () => clearInterval(timer);
}
