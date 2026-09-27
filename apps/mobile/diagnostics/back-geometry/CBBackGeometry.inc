// Diagnostic profile only. Included into RNScreens; never modifies layout.
#import <React/RCTBridgeModule.h>
#import <QuartzCore/QuartzCore.h>
#import <CoreText/CoreText.h>

static __weak UIView *CBObservedBack;
static NSMutableArray *CBSamples;
static NSMapTable *CBViewIds;
static NSUInteger CBNextId;
static NSUInteger CBLayoutCount;
static CFTimeInterval CBStarted;
static BOOL CBCapturing;
static NSDictionary *CBFabricMetrics;
static NSString * const CBGeometrySource = @"__CB_SOURCE_COMMIT__";

static NSNumber *CBNumber(CGFloat value) { return std::isfinite(value) ? @(value) : @0; }
static NSDictionary *CBRect(CGRect r) {
  return @{ @"x": CBNumber(r.origin.x), @"y": CBNumber(r.origin.y),
    @"width": CBNumber(r.size.width), @"height": CBNumber(r.size.height),
    @"centerY": CBNumber(CGRectGetMidY(r)) };
}
static NSDictionary *CBInsets(UIEdgeInsets i) {
  return @{ @"top": CBNumber(i.top), @"left": CBNumber(i.left),
    @"bottom": CBNumber(i.bottom), @"right": CBNumber(i.right) };
}
static NSNumber *CBId(UIView *v) {
  if (!CBViewIds) CBViewIds = [NSMapTable weakToStrongObjectsMapTable];
  NSNumber *value = [CBViewIds objectForKey:v];
  if (!value) { value = @(++CBNextId); [CBViewIds setObject:value forKey:v]; }
  return value;
}
#include "CBBackTrace.inc"

static NSDictionary *CBLayer(CALayer *layer, NSUInteger depth) {
  NSMutableArray *children = [NSMutableArray new];
  if (depth < 5) for (CALayer *child in layer.sublayers) {
    if (children.count >= 30) break;
    [children addObject:CBLayer(child, depth + 1)];
  }
  CATransform3D t = layer.transform;
  return @{ @"class": NSStringFromClass(layer.class), @"frame": CBRect(layer.frame),
    @"bounds": CBRect(layer.bounds), @"position": @[@(layer.position.x), @(layer.position.y)],
    @"anchorPoint": @[@(layer.anchorPoint.x), @(layer.anchorPoint.y)],
    @"masksToBounds": @(layer.masksToBounds), @"cornerRadius": @(layer.cornerRadius),
    @"opacity": @(layer.opacity), @"hidden": @(layer.hidden),
    @"hasContents": @(layer.contents != nil), @"hasMask": @(layer.mask != nil),
    @"presentationFrame": layer.presentationLayer ? CBRect(layer.presentationLayer.frame) : (id)NSNull.null,
    @"transform": @[@(t.m11),@(t.m12),@(t.m13),@(t.m14),@(t.m21),@(t.m22),@(t.m23),@(t.m24),
      @(t.m31),@(t.m32),@(t.m33),@(t.m34),@(t.m41),@(t.m42),@(t.m43),@(t.m44)],
    @"children": children };
}

// Only inspect the one Ionicons Back glyph; never serialize attributed strings.
@interface UIView (CBGeometryTextIntrospection)
- (NSAttributedString *)attributedText;
@end
static NSDictionary *CBGlyph(UIView *view) {
  if (![view respondsToSelector:@selector(attributedText)]) return nil;
  NSAttributedString *text = [view attributedText];
  if (text.length != 1 || [text.string characterAtIndex:0] != 0xf229) return nil;
  UIFont *font = [text attribute:NSFontAttributeName atIndex:0 effectiveRange:NULL];
  if (![font isKindOfClass:UIFont.class] || ![font.familyName.lowercaseString containsString:@"ionicons"]) return nil;
  NSMutableDictionary *result = [@{
    @"fontPointSize": @(font.pointSize), @"ascender": @(font.ascender),
    @"descender": @(font.descender), @"leading": @(font.leading), @"lineHeight": @(font.lineHeight),
    @"capHeight": @(font.capHeight), @"xHeight": @(font.xHeight),
    @"baselineOffsetAttribute": [text attribute:NSBaselineOffsetAttributeName atIndex:0 effectiveRange:NULL] ?: @0
  } mutableCopy];
  CTFontRef ct = CTFontCreateWithName((__bridge CFStringRef)font.fontName, font.pointSize, NULL);
  UniChar ch = 0xf229; CGGlyph glyph = 0;
  if (CTFontGetGlyphsForCharacters(ct, &ch, &glyph, 1)) {
    CGRect ink; CTFontGetBoundingRectsForGlyphs(ct, kCTFontOrientationDefault, &glyph, &ink, 1);
    result[@"fontGlyphBoundsYUp"] = CBRect(ink);
  }
  CFRelease(ct);
  // Reconstructed TextKit baseline is labelled; painted bounds below are actual
  // view-layer output and are the primary check, not this reconstruction.
  NSTextStorage *storage = [[NSTextStorage alloc] initWithAttributedString:text];
  NSLayoutManager *manager = [NSLayoutManager new];
  NSTextContainer *container = [[NSTextContainer alloc] initWithSize:view.bounds.size];
  container.lineFragmentPadding = 0;
  [manager addTextContainer:container]; [storage addLayoutManager:manager];
  [manager ensureLayoutForTextContainer:container];
  if (manager.numberOfGlyphs) {
    CGPoint location = [manager locationForGlyphAtIndex:0];
    CGRect line = [manager lineFragmentRectForGlyphAtIndex:0 effectiveRange:NULL];
    result[@"reconstructedTextKitBaselineY"] = @(line.origin.y + location.y);
    result[@"reconstructedTextKitUsedRect"] = CBRect([manager usedRectForTextContainer:container]);
  }
  CGSize size = view.bounds.size;
  CGFloat scale = view.window.screen.scale ?: 1;
  if (size.width > 0 && size.height > 0 && size.width <= 200 && size.height <= 200) {
    size_t width = (size_t)ceil(size.width * scale), height = (size_t)ceil(size.height * scale);
    NSMutableData *pixels = [NSMutableData dataWithLength:width * height * 4];
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(pixels.mutableBytes, width, height, 8, width * 4,
      colorSpace, kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
    CGColorSpaceRelease(colorSpace);
    if (context) {
      CGContextTranslateCTM(context, 0, height); CGContextScaleCTM(context, scale, -scale);
      [view.layer renderInContext:context]; CGContextRelease(context);
      const unsigned char *p = (const unsigned char *)pixels.bytes;
      size_t xmin = width, ymin = height, xmax = 0, ymax = 0, count = 0;
      for (size_t y = 0; y < height; y++) for (size_t x = 0; x < width; x++) {
        if (p[(y * width + x) * 4 + 3] > 32) {
          xmin = MIN(xmin,x); ymin = MIN(ymin,y); xmax = MAX(xmax,x); ymax = MAX(ymax,y); count++;
        }
      }
      result[@"paintCoverage"] = @((double)count / (width * height));
      if (count && (double)count / (width * height) < 0.7) {
        CGRect ink = CGRectMake(xmin/scale,ymin/scale,(xmax-xmin+1)/scale,(ymax-ymin+1)/scale);
        result[@"paintBoundsLocal"] = CBRect(ink);
        result[@"paintBoundsWindow"] = CBRect([view convertRect:ink toView:view.window]);
        result[@"paintMethod"] = @"actual layer render alpha bounds; verify no opaque background";
      } else result[@"paintUnavailable"] = @"empty layer rendering or opaque background; do not infer glyph bounds";
    }
  }
  return result;
}
static NSDictionary *CBView(UIView *v, NSString *path, BOOL includePaint) {
  CGRect windowRect = [v convertRect:v.bounds toView:v.window];
  CGPoint windowCenter = [v convertPoint:CGPointMake(CGRectGetMidX(v.bounds), CGRectGetMidY(v.bounds)) toView:v.window];
  CGSize intrinsic = v.intrinsicContentSize;
  CGAffineTransform t = v.transform;
  NSString *className = NSStringFromClass(v.class);
  NSString *lower = className.lowercaseString;
  BOOL backgroundCandidate = [lower containsString:@"glass"] || [lower containsString:@"background"] ||
    [lower containsString:@"button"] || [lower containsString:@"capsule"] || [v isKindOfClass:UIVisualEffectView.class];
  NSMutableDictionary *d = [@{
    @"id": CBId(v), @"path": path, @"class": className,
    @"frameInParent": CBRect(v.frame), @"bounds": CBRect(v.bounds),
    @"centerInParent": @[@(v.center.x),@(v.center.y)], @"windowBounds": CBRect(windowRect),
    @"windowCenter": @[@(windowCenter.x),@(windowCenter.y)],
    @"safeAreaInsets": CBInsets(v.safeAreaInsets), @"layoutMargins": CBInsets(v.layoutMargins),
    @"alignmentRectInsets": CBInsets(v.alignmentRectInsets),
    @"alignmentRectForFrame": CBRect([v alignmentRectForFrame:v.frame]),
    @"intrinsicSize": @[@(intrinsic.width),@(intrinsic.height)],
    @"transform": @[@(t.a),@(t.b),@(t.c),@(t.d),@(t.tx),@(t.ty)],
    @"clipsToBounds": @(v.clipsToBounds), @"hidden": @(v.hidden), @"alpha": @(v.alpha),
    @"presentationFrameInParent": v.layer.presentationLayer ? CBRect(v.layer.presentationLayer.frame) : (id)NSNull.null,
    @"opaque": @(v.opaque), @"userInteractionEnabled": @(v.userInteractionEnabled),
    @"translatesAutoresizingMaskIntoConstraints": @(v.translatesAutoresizingMaskIntoConstraints),
    @"ambiguousLayout": @(v.hasAmbiguousLayout), @"backgroundCandidate": @(backgroundCandidate),
    @"isObservedHeaderSubview": @(v == CBObservedBack),
    @"isBackAccessibilityElement": @([v.accessibilityLabel isEqualToString:@"Back"])
  } mutableCopy];
  if (v.superview) d[@"parentId"] = CBId(v.superview);
  if ([v isKindOfClass:UIButton.class]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    UIButton *button = (UIButton *)v;
    d[@"contentInsets"] = CBInsets(button.contentEdgeInsets);
    d[@"imageInsets"] = CBInsets(button.imageEdgeInsets);
    d[@"titleInsets"] = CBInsets(button.titleEdgeInsets);
#pragma clang diagnostic pop
  }
  CGFloat r,g,b,a;
  if ([v.backgroundColor getRed:&r green:&g blue:&b alpha:&a]) d[@"backgroundRGBA"] = @[@(r),@(g),@(b),@(a)];
  NSMutableArray *constraints = [NSMutableArray new];
  for (NSLayoutConstraint *c in v.constraints) {
    [constraints addObject:@{ @"firstAttribute": @(c.firstAttribute), @"secondAttribute": @(c.secondAttribute),
      @"firstViewId": [c.firstItem isKindOfClass:UIView.class] ? CBId(c.firstItem) : @0,
      @"secondViewId": [c.secondItem isKindOfClass:UIView.class] ? CBId(c.secondItem) : @0,
      @"relation": @(c.relation), @"multiplier": @(c.multiplier), @"constant": @(c.constant),
      @"priority": @(c.priority), @"active": @(c.active) }];
  }
  d[@"constraints"] = constraints;
  if (includePaint) {
    NSDictionary *glyph = CBGlyph(v); if (glyph) d[@"backGlyph"] = glyph;
    if (backgroundCandidate) d[@"layers"] = CBLayer(v.layer,0);
  }
  return d;
}
static void CBWalk(UIView *v, NSString *path, NSMutableArray *views, BOOL paint) {
  if (views.count >= 250) return;
  [views addObject:CBView(v,path,paint)];
  NSUInteger i = 0;
  for (UIView *child in v.subviews) CBWalk(child,[path stringByAppendingFormat:@"/%lu",(unsigned long)i++],views,paint);
}
static void CBCapture(NSString *moment, BOOL paint) {
  UIView *back = CBObservedBack;
  if (!back.window || CBCapturing || CBSamples.count >= 24) return;
  CBCapturing = YES;
  UIView *nav = back;
  while (nav && ![nav isKindOfClass:UINavigationBar.class]) nav = nav.superview;
  NSMutableArray *views = [NSMutableArray new];
  if (nav) CBWalk(nav,@"navigationBar",views,paint);
  else CBWalk(back,@"header-not-in-navigation-bar",views,paint);
  NSMutableArray *ancestors = [NSMutableArray new];
  UIView *ancestor = nav.superview;
  while (ancestor && ancestors.count < 12) { [ancestors addObject:CBView(ancestor,@"ancestor",NO)]; ancestor = ancestor.superview; }
  NSMutableDictionary *sample = [@{ @"moment": moment, @"elapsedSeconds": @(CACurrentMediaTime()-CBStarted),
    @"views": views, @"ancestors": ancestors, @"layoutCount": @(CBLayoutCount) } mutableCopy];
  if (CBFabricMetrics) sample[@"fabricMetrics"] = CBFabricMetrics;
  if ([nav isKindOfClass:UINavigationBar.class]) {
    UIBarButtonItem *item = ((UINavigationBar *)nav).topItem.leftBarButtonItem;
    if (item.customView) sample[@"barButtonCustomViewId"] = CBId(item.customView);
    if (item) sample[@"barButtonImageInsets"] = CBInsets(item.imageInsets);
  }
  [CBSamples addObject:sample]; CBCapturing = NO;
}
@interface CBGeometryFrameProbe : NSObject
@property(nonatomic) NSInteger remaining;
@property(nonatomic, strong) CADisplayLink *link;
- (void)tick:(CADisplayLink *)sender;
@end
@implementation CBGeometryFrameProbe
- (void)tick:(CADisplayLink *)sender {
  CBCapture([NSString stringWithFormat:@"display-frame-%ld",(long)(5-self.remaining)],YES);
  if (--self.remaining == 0) { [sender invalidate]; self.link = nil; }
}
@end
static void CBBackDidMount(UIView *back) {
  if (!back.window || CBObservedBack == back) return;
  CBObservedBack = back; CBSamples = [NSMutableArray new];
  CBLayoutCount = 0; CBStarted = CACurrentMediaTime();
  CBTraceAttach(back);
  CBCapture(@"didMoveToWindow",NO);
  __weak UIView *expected = back;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (expected != CBObservedBack || !expected.window) return;
    CBCapture(@"next-main-runloop",YES);
    CBGeometryFrameProbe *probe = [CBGeometryFrameProbe new]; probe.remaining = 4;
    probe.link = [CADisplayLink displayLinkWithTarget:probe selector:@selector(tick:)];
    [probe.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  });
  for (NSNumber *delay in @[@0.25,@1.0,@2.0]) dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
    (int64_t)(delay.doubleValue*NSEC_PER_SEC)),dispatch_get_main_queue(), ^{
      if (expected == CBObservedBack) CBCapture([NSString stringWithFormat:@"settled-%@s",delay],YES);
    });
}
static void CBBackDidLayout(UIView *back) {
  CBTraceConstraintsEvent(back,@"header.layoutSubviews.afterSuper");
  if (back == CBObservedBack && ++CBLayoutCount <= 4) CBCapture(@"layoutSubviews",NO);
}
@interface CBBackGeometry : NSObject <RCTBridgeModule>
@end
@implementation CBBackGeometry
RCT_EXPORT_MODULE(CBBackGeometry)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
RCT_EXPORT_METHOD(exportGeometry:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (!CBObservedBack.window || !CBSamples.count) { reject(@"no_header",@"Open the diagnostic Health Connections screen first.",nil); return; }
  CBCapture(@"founder-export-settled",YES);
  NSDictionary *report = @{ @"schema": @2, @"nativeResizeTrace": CBTraceReport(), @"sourceCommit": CBGeometrySource,
    @"osVersion": UIDevice.currentDevice.systemVersion, @"screenScale": @(CBObservedBack.window.screen.scale),
    @"samples": CBSamples, @"privacy": @"Geometry only. No account, health, text content or credentials.",
    @"baselineEvidence": @"TextKit baseline reconstructed; paintBounds are rendered layer measurements when available.",
    @"backgroundEvidence": @"UIKit class/layer candidates; confirm visual owner from hierarchy and physical appearance." };
  NSError *error;
  NSData *data = [NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:&error];
  if (!data) { reject(@"serialization",@"Geometry could not be serialized.",error); return; }
  NSURL *url = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByAppendingPathComponent:@"caloriebank-back-geometry.json"];
  if (![data writeToURL:url options:NSDataWritingAtomic error:&error]) { reject(@"write",@"Geometry export could not be written.",error); return; }
  UIActivityViewController *share = [[UIActivityViewController alloc] initWithActivityItems:@[url] applicationActivities:nil];
  UIViewController *presenter = CBObservedBack.window.rootViewController;
  while (presenter.presentedViewController) presenter = presenter.presentedViewController;
  share.popoverPresentationController.sourceView = presenter.view;
  share.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds),CGRectGetMidY(presenter.view.bounds),1,1);
  [presenter presentViewController:share animated:YES completion:^{ resolve(@YES); }];
}
@end
