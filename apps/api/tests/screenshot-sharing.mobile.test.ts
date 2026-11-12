import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { canOfferScreenshotShare, supportsScreenshotPrompt } from '../../mobile/lib/sharing/screenshot-policy';
const h = vi.hoisted(() => ({ path: '/today', callback: () => {}, state: (_s: string) => {}, remove: vi.fn(), capture: vi.fn(), release: vi.fn(), share: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: (_: string, cb: (s: string) => void) => { h.state = cb; return { remove: vi.fn() }; } }, Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: (x: unknown) => x } }));
vi.mock('expo-router', () => ({ usePathname: () => h.path }));
vi.mock('../../mobile/components/caloriebank/ScaleAwareText', () => ({ Text: 'Text' }));
vi.mock('../../mobile/lib/sharing/native-screenshot', () => ({ loadScreenshotTools: async () => ({ listen: (cb: () => void) => { h.callback = cb; return { remove: h.remove }; }, capture: h.capture, release: h.release, share: h.share }) }));
let ScreenshotSharePrompt:React.ComponentType<{ready:boolean}>;
beforeAll(async()=>{({ScreenshotSharePrompt}=await import(resolve(__dirname,'../../mobile/components/caloriebank/ScreenshotSharePrompt.tsx')));});
let view: ReactTestRenderer;
const mount = async () => { await act(async () => { view = create(React.createElement(ScreenshotSharePrompt, { ready: true })); }); };
const press = async (label: string) => { await act(async () => { view.root.findAllByType('Pressable' as never).find(n => JSON.stringify(n.findAllByType('Text' as never).map(t => t.props.children)).includes(label))!.props.onPress(); }); };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.path = '/today'; h.capture.mockResolvedValue('file:///temporary.png'); h.share.mockResolvedValue(undefined); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
it('only detects on iOS/Android14+, excluding accounts and editors', () => {
 expect(supportsScreenshotPrompt('ios', '18.3')).toBe(true); expect(supportsScreenshotPrompt('android',34)).toBe(true); expect(supportsScreenshotPrompt('android',33)).toBe(false); expect(supportsScreenshotPrompt('web',0)).toBe(false);
 for (const path of ['/settings','/sign-in','/edit-intake','/onboarding']) expect(canOfferScreenshotShare({ready:true,path,appState:'active',busy:false})).toBe(false);
 expect(canOfferScreenshotShare({ready:false,path:'/today',appState:'active',busy:false})).toBe(false);
});
it('captures locally, never shares until explicit tap, ignores repeated screenshots and clears on dismissal', async () => {
 await mount(); await act(async () => { h.callback(); h.callback(); }); expect(h.capture).toHaveBeenCalledTimes(1); expect(h.share).not.toHaveBeenCalled();
 await press('Not now'); expect(h.release).toHaveBeenCalledWith('file:///temporary.png'); expect(view.toJSON()).toBeNull();
});
it('opens share once, treats cancellation as dismissal without a success claim', async () => {
 await mount(); await act(async () => h.callback()); await press('Choose where'); expect(h.share).toHaveBeenCalledTimes(1); expect(h.release).toHaveBeenCalledTimes(1); expect(view.toJSON()).toBeNull();
});
it('rejects stale captures after route changes', async () => {
 let resolve!: (uri: string) => void; h.capture.mockReturnValue(new Promise<string>(r => { resolve = r; }));
 await mount(); await act(async () => h.callback()); h.path='/settings'; await act(async () => { view.update(React.createElement(ScreenshotSharePrompt, {ready:true})); });
 await act(async () => resolve('file:///stale.png')); expect(h.release).toHaveBeenCalledWith('file:///stale.png'); expect(view.toJSON()).toBeNull();
});
it('clears background preview and handles capture failure without sharing', async () => {
 await mount(); await act(async () => h.callback()); await act(async () => h.state('background')); expect(view.toJSON()).toBeNull(); expect(h.share).not.toHaveBeenCalled();
});
it('shows retry after share failure and releases on unmount', async () => {
 h.share.mockRejectedValue(new Error('unavailable')); await mount(); await act(async () => h.callback()); await press('Choose where'); expect(JSON.stringify(view.toJSON())).toContain('Couldn’t open sharing'); expect(h.release).not.toHaveBeenCalled();
});
it('suppresses double taps and keeps the image until an active share sheet finishes', async () => {
 let done!: () => void; h.share.mockReturnValue(new Promise<void>(r => { done=r; }));
 await mount(); await act(async () => h.callback()); await press('Choose where'); await press('Opening sharing'); expect(h.share).toHaveBeenCalledTimes(1);
 await act(async () => h.state('background')); expect(h.release).not.toHaveBeenCalled();
 await act(async () => done()); expect(h.release).toHaveBeenCalledTimes(1); expect(view.toJSON()).toBeNull();
});
it('capture failures leave the app usable without a share attempt', async () => {
 h.capture.mockRejectedValue(new Error('capture failed')); await mount(); await act(async () => h.callback()); expect(view.toJSON()).toBeNull(); expect(h.share).not.toHaveBeenCalled();
});
