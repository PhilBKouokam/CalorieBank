// The installed React DOM runtime lacks @types/react-dom. This isolated harness
// uses only these public methods; no dependency installation is required.
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export function createRoot(container: Element): { render(children: ReactNode): void };
}
