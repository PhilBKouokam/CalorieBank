/* Backport the iOS 26 custom bar-item centering from react-native-screens #3449.
 * Expo 54 pins screens 4.16.0. Scope to left items (all are our Back control);
 * do not patch Android, right items, header titles, or navigation handlers.
 */
const fs = require('node:fs');
const path = require('node:path');
const screensRoot = path.dirname(require.resolve('react-native-screens/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(screensRoot, 'package.json'), 'utf8')).version;
const marker = 'CB_IOS_BACK_ALIGNMENT_V1';
function replaceOnce(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('iOS Back patch anchor changed; review the upstream fix before building.');
  return source.replace(from, to);
}
function patchHeader(source) {
  if (source.includes(marker)) return source;
  source = replaceOnce(source, '@implementation RNSScreenStackHeaderSubview {', `@implementation RNSScreenStackHeaderSubview {
  // ${marker}: retain Yoga's content size separately from UIKit's bar-item bounds.
  CGSize _cbBackContentSize;
  __weak UIView *_cbBackWrapper;`);
  source = replaceOnce(source, 'withFrame:self.frame];', 'withFrame:(self.type == RNSScreenStackHeaderSubviewTypeLeft && _cbBackWrapper != nil ? self.bounds : self.frame)];');
  source = replaceOnce(source, '    self.bounds = CGRect{CGPointZero, frame.size};', `    _cbBackContentSize = frame.size;
    if (@available(iOS 26.0, *)) {
      if (self.type == RNSScreenStackHeaderSubviewTypeLeft) {
        [self invalidateIntrinsicContentSize];
      } else {
        self.bounds = CGRect{CGPointZero, frame.size};
      }
    } else {
      self.bounds = CGRect{CGPointZero, frame.size};
    }`);
  source = replaceOnce(source, '    [super reactSetFrame:CGRectMake(0, 0, frame.size.width, frame.size.height)];', `    _cbBackContentSize = frame.size;
    if (@available(iOS 26.0, *)) {
      if (self.type == RNSScreenStackHeaderSubviewTypeLeft) {
        [self invalidateIntrinsicContentSize];
      } else {
        [super reactSetFrame:CGRectMake(0, 0, frame.size.width, frame.size.height)];
      }
    } else {
      [super reactSetFrame:CGRectMake(0, 0, frame.size.width, frame.size.height)];
    }`);
  source = replaceOnce(source, '\n@end\n\n@implementation RNSScreenStackHeaderSubviewManager', `
- (CGSize)intrinsicContentSize
{
  if (@available(iOS 26.0, *)) {
    if (self.type == RNSScreenStackHeaderSubviewTypeLeft) {
      return _cbBackContentSize;
    }
  }
  return [super intrinsicContentSize];
}

- (UIView *)cb_centeredBackBarItemView
{
  if (@available(iOS 26.0, *)) {
    if (_cbBackWrapper != nil) return _cbBackWrapper;
    UIView *wrapper = [UIView new];
    _cbBackWrapper = wrapper;
    wrapper.translatesAutoresizingMaskIntoConstraints = NO;
    self.translatesAutoresizingMaskIntoConstraints = NO;
    [wrapper addSubview:self];
    [self.centerXAnchor constraintEqualToAnchor:wrapper.centerXAnchor].active = YES;
    [self.centerYAnchor constraintEqualToAnchor:wrapper.centerYAnchor].active = YES;
    NSLayoutConstraint *width = [wrapper.widthAnchor constraintEqualToAnchor:self.widthAnchor];
    width.priority = UILayoutPriorityDefaultHigh;
    width.active = YES;
    NSLayoutConstraint *height = [wrapper.heightAnchor constraintEqualToAnchor:self.heightAnchor];
    height.priority = UILayoutPriorityDefaultHigh;
    height.active = YES;
    [self setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
    [self setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisVertical];
    return wrapper;
  }
  return self;
}
@end

@implementation RNSScreenStackHeaderSubviewManager`);
  return source;
}
function patchConfig(source) {
  if (source.includes(marker)) return source;
  return replaceOnce(source,
    'UIBarButtonItem *buttonItem = [[UIBarButtonItem alloc] initWithCustomView:subview];\n        navitem.leftBarButtonItem = buttonItem;',
    `// ${marker}: UIKit owns the outer bounds; center Yoga content within them.
        UIBarButtonItem *buttonItem = [[UIBarButtonItem alloc] initWithCustomView:[subview cb_centeredBackBarItemView]];
        navitem.leftBarButtonItem = buttonItem;`);
}
function apply() {
  if (version !== '4.16.0') throw new Error(`Review iOS Back alignment patch for react-native-screens ${version}.`);
  const paths = ['ios/RNSScreenStackHeaderSubview.mm', 'ios/RNSScreenStackHeaderConfig.mm', 'ios/RNSScreenStackHeaderSubview.h'].map(p => path.join(screensRoot, p));
  const originals = paths.map(p => fs.readFileSync(p, 'utf8'));
  const declaration = originals[2].includes(marker) ? originals[2] : replaceOnce(originals[2], '@end\n\n@interface RNSScreenStackHeaderSubviewManager', `// ${marker}\n- (UIView *)cb_centeredBackBarItemView;\n@end\n\n@interface RNSScreenStackHeaderSubviewManager`);
  const results = [patchHeader(originals[0]), patchConfig(originals[1]), declaration];
  results.forEach((s, i) => { if (s !== originals[i]) fs.writeFileSync(paths[i], s); });
}
module.exports = { patchHeader, patchConfig, replaceOnce };
if (require.main === module) apply();
