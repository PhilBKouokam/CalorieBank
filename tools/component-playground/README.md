# Synthetic production-component playground

Run `npm run playground` from the repository root, then open
http://127.0.0.1:4173. The root Node runner selects the pinned Node 20 runtime.
`npm run playground:check` bundles and verifies the transport boundary without
starting a server; `npm run playground:typecheck` checks the TS fixtures and
production components they import. No dependencies were installed.

This isolated React Native Web entry imports the actual DailyBankTargetForm,
IntakeAdjustmentEditor and StepPlanningCards. It is outside Expo Router and is
never referenced by a production entry, app config or navigation. Production
components and their approved hierarchy are unchanged. Build output lives in a
fresh OS temporary directory; no generated files are put in the repository.

Choose the component, 320/390px frame, normal/simulated 200% text, and ready,
empty, large, long-label, loading or error scenario. Loading/error apply to the
mock transport (press Save/Continue for write states); Step Planning uses its
actual unavailable/error explanations. The tiny RN Web proxy scales text/input
styles and fontScale; it does not prove native dynamic type or layout behavior.
Frame contents scroll vertically. There is no emulated native keyboard.

Safety: API client/settings transport imports resolve to the local typed stub,
including relative imports. A bundle-metafile guard rejects the real transports.
CSP `connect-src 'none'` blocks browser network requests. No credentials, real
records, authenticated app provider, storage adapter or native health module is
loaded. Drafts use the production in-memory hook without an authenticated
session; reload resets them. The Android-only native scroll implementation is
replaced with RN Web ScrollView for this browser harness only.

Current limitations: no hot reload (restart server after source changes), native
IME/Activity recreation/OS accessibility/Android underline are not qualified.
Native fixes still need focused device evidence. This is a minimal iteration
surface, not a replacement native test application or a new design system.

The Brand header fixture imports actual PlaceholderScreen with a synthetic
safe-area provider and routing stub. Its fixed decorative CB does not scale;
adjacent readable text does. Inspected 320/390px at simulated 200% after the
reported iPhone monogram clipping. This fixture does not render the whole Today
screen or prove native acceptance. To run a second preview without replacing the
existing server, set `CALORIEBANK_PLAYGROUND_PORT` (1024–65535); all servers bind
only 127.0.0.1.

For a reviewed synthetic fixture in an isolated feature worktree, set
`CALORIEBANK_PLAYGROUND_ENTRY` to its absolute `.tsx` entry path. The runner uses
the existing root dependencies; no installation or copying the tooling into that
branch is necessary. The same real-transport bundle rejection and network-blocking
CSP apply. This selects a development fixture only, never a production route.
Use `--check` with the same entry before starting its separate local port.

Versioned Expo docs consulted before implementation: SDK54 DevClient source at
https://raw.githubusercontent.com/expo/expo/sdk-54/docs/pages/versions/v54.0.0/sdk/dev-client.mdx
(the public versioned docs URL currently redirects to latest).

## Initial verification — October 18, 2026

- Bundle safety check and isolated TypeScript check passed with Node 20.20.2.
- Browser DOM geometry: all twelve ready-state combinations of the three initial
  components × 320/390px frames × 100/200% simulated text reported zero descendants
  extending past the frame's right edge.
- Screenshots inspected: target 320px at both scales; target 390px error;
  correction 320px/200% long label, 390px normal loading and large value;
  Step Planning 320px/200% ready and empty, 390px normal ready.
- Synthetic correction Save scrolled into view and completed without transport;
  indefinite mock loading displayed disabled Saving and editable controls locked.
- Actual PrivacyPolicyRow/SettingsRow are an additional fixture. Inspected
  320px/200% wrapping and 390px/200% failed-open message. Its icons use nominal-size
  placeholders and browser opening is stubbed, so icon glyph and native browser
  behavior are explicitly not qualified here.
- Large Step Planning 320px/200% fixture reported no right-edge overflow with
  six-digit calories and total steps.

These checks are rendered browser evidence only. They neither reopen nor replace
existing physical-artifact evidence. No production UI hierarchy was edited.
