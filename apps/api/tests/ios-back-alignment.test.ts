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
    expect(header).toContain('return RCTCGSizeFromSize(_layoutMetrics.frame.size);');
    expect(header).toContain('self.type == RNSScreenStackHeaderSubviewTypeLeft) _layoutMetrics = layoutMetrics');
    expect(header).toContain('if (sizeHasChanged) [self invalidateIntrinsicContentSize]');
    expect(header).toContain('_cbBackWrapper != nil ? self.bounds : self.frame');
    expect(header).toContain('width.priority = UILayoutPriorityDefaultHigh');
    expect(header).toContain('height.priority = UILayoutPriorityDefaultHigh');
    expect(header).toContain('if (_cbBackWrapper != nil) return _cbBackWrapper;');
  });

  it('resists the measured 36-point native compression while keeping 48-point content centered', () => {
    const wrapper = header.slice(header.indexOf('- (UIView *)cb_centeredBackBarItemView'));
    expect(wrapper).toContain('setContentCompressionResistancePriority:UILayoutPriorityRequired - 1');
    expect(wrapper).toMatch(/setContentCompressionResistancePriority:UILayoutPriorityRequired - 1\s+forAxis:UILayoutConstraintAxisVertical/);
    expect(wrapper).toContain('height.priority = UILayoutPriorityDefaultHigh');
    expect(wrapper).not.toMatch(/CGAffineTransform|translateY|padding|constraintEqualToConstant/);

    // Constraint model of the captured UIKit arrangement, not a UIKit simulation.
    // Required: wrapper=36, header<=48, centers equal. Competing optional
    // constraints: header>=48 (compression) and header=wrapper (equality).
    // The old equal priorities permit every height 36..48. Raising compression
    // makes 48 the unique solution; center anchors derive -6 without an offset.
    const solutions = (compression: number, equality: number) => {
      const priorities = [...new Set([compression, equality])].sort((a, b) => b - a);
      const candidates = Array.from({ length: 49 }, (_, height) => ({
        height,
        errors: priorities.map(priority =>
          (priority === compression ? Math.max(0, 48 - height) : 0) +
          (priority === equality ? Math.abs(height - 36) : 0)),
      }));
      candidates.sort((a, b) => {
        for (let i = 0; i < priorities.length; i++) {
          if (a.errors[i] !== b.errors[i]) return a.errors[i]! - b.errors[i]!;
        }
        return 0;
      });
      return candidates.filter(candidate => candidate.errors.every((error, i) => error === candidates[0]!.errors[i]))
        .map(candidate => candidate.height);
    };
    expect(solutions(750, 750)).toEqual(Array.from({ length: 13 }, (_, i) => 36 + i));
    expect(solutions(999, 750)).toEqual([48]);
    const [contentHeight] = solutions(999, 750);
    const origin = (36 - contentHeight!) / 2;
    expect(origin + contentHeight! / 2).toBe(36 / 2);
    expect(origin).toBe(-6);
  });

  it('upgrades the existing V2 native source without changing its centering or other layout', () => {
    const addition = '    // CB_IOS_BACK_ALIGNMENT_V3: 999 beats the wrapper height equality at 750.\n' +
      '    [self setContentCompressionResistancePriority:UILayoutPriorityRequired - 1\n' +
      '                                         forAxis:UILayoutConstraintAxisVertical];\n';
    expect(header).toContain(addition);
    const previous = header.replace(addition, '');
    expect(patchHeader(previous)).toBe(header);
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
