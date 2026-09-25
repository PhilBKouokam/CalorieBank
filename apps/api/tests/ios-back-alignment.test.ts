import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(resolve(__dirname, '../package.json'));
const { patchHeader, patchConfig, replaceOnce } = require(resolve(__dirname, '../../mobile/scripts/patch-ios-back-alignment.cjs')) as {
  patchHeader: (source: string) => string;
  patchConfig: (source: string) => string;
  replaceOnce: (source: string, from: string, to: string) => string;
};
const root = dirname(require.resolve('react-native-screens/package.json'));
const header = readFileSync(resolve(root, 'ios/RNSScreenStackHeaderSubview.mm'), 'utf8');
const config = readFileSync(resolve(root, 'ios/RNSScreenStackHeaderConfig.mm'), 'utf8');

describe('iOS native Back alignment (not just the inner React box)', () => {
  it('centers both axes in UIKit-owned bounds, preserving intrinsic Yoga size and avoiding doubled offsets', () => {
    expect(header).toContain('[self.centerXAnchor constraintEqualToAnchor:wrapper.centerXAnchor].active = YES');
    expect(header).toContain('[self.centerYAnchor constraintEqualToAnchor:wrapper.centerYAnchor].active = YES');
    expect(header).toContain('return _cbBackContentSize;');
    expect(header).toContain('_cbBackWrapper != nil ? self.bounds : self.frame');
    expect(header).toContain('width.priority = UILayoutPriorityDefaultHigh');
    expect(header).toContain('height.priority = UILayoutPriorityDefaultHigh');
    expect(header).toContain('if (_cbBackWrapper != nil) return _cbBackWrapper;');
  });

  it('leaves right items unchanged and limits the wrapper to iOS 26 and later', () => {
    const left = config.slice(config.indexOf('case RNSScreenStackHeaderSubviewTypeLeft: {'), config.indexOf('case RNSScreenStackHeaderSubviewTypeRight: {'));
    expect(left).toContain('initWithCustomView:[subview cb_centeredBackBarItemView]');
    const right = config.slice(config.indexOf('case RNSScreenStackHeaderSubviewTypeRight: {'), config.indexOf('case RNSScreenStackHeaderSubviewTypeCenter:'));
    expect(right).toContain('initWithCustomView:subview');
    expect(right).not.toContain('cb_centeredBackBarItemView');
    const wrapper = header.slice(header.indexOf('- (UIView *)cb_centeredBackBarItemView'));
    expect(wrapper).toMatch(/if \(@available\(iOS 26\.0, \*\)\)/);
    expect(wrapper).toContain('return self;');
  });

  it('is retry-safe and fails closed on unexpected dependency source', () => {
    expect(patchHeader(header)).toBe(header);
    expect(patchConfig(config)).toBe(config);
    expect(() => patchHeader('unexpected dependency')).toThrow(/anchor changed/);
    expect(() => replaceOnce('x x', 'x', 'y')).toThrow(/anchor changed/);
  });
});
