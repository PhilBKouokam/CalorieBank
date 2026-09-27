// Diagnostic-only interposition. Every original implementation executes once,
// with the original arguments/result. Never invokes layout or changes constraints.
#import <objc/runtime.h>
#import <dlfcn.h>

static NSMutableArray *CBTraceEvents;
static NSHashTable<UIView *> *CBTraceViews;
static BOOL CBTracing;
static NSUInteger CBTraceDropped;
static NSUInteger CBTransitionStacks;
static NSUInteger CBHeaderTransitionStacks;
static CFTimeInterval CBTraceEpoch;
static CFTimeInterval CBMountEpoch;
static NSDate *CBTraceDate;
static BOOL CBTraceRelevant(UIView *v) {
  return v && ([NSStringFromClass(v.class) isEqualToString:@"RNSScreenStackHeaderSubview"] ||
    [CBTraceViews containsObject:v]);
}
static void CBTraceRegister(UIView *v) {
  if (!CBTraceViews) CBTraceViews = [NSHashTable weakObjectsHashTable];
  if (v) [CBTraceViews addObject:v];
}
static NSDictionary *CBTraceGeometry(UIView *v) {
  return @{ @"frame": CBRect(v.frame), @"bounds": CBRect(v.bounds),
    @"center": @[@(v.center.x),@(v.center.y)],
    @"autoresizingMask": @(v.autoresizingMask),
    @"translatesAutoresizingMaskIntoConstraints": @(v.translatesAutoresizingMaskIntoConstraints) };
}
static NSDictionary *CBConstraintItem(id item) {
  if (!item) return @{};
  if ([item isKindOfClass:UIView.class]) return @{ @"viewId": CBId(item), @"class": NSStringFromClass([item class]) };
  if ([item isKindOfClass:UILayoutGuide.class]) return @{ @"class": NSStringFromClass([item class]),
    @"owningViewId": ((UILayoutGuide *)item).owningView ? CBId(((UILayoutGuide *)item).owningView) : @0 };
  return @{ @"class": NSStringFromClass([item class]) };
}
static NSDictionary *CBTraceConstraint(NSLayoutConstraint *c, UIView *owner) {
  return @{ @"class": NSStringFromClass(c.class), @"constraintId": @((uintptr_t)(__bridge void *)c),
    @"owner": CBConstraintItem(owner), @"firstItem": CBConstraintItem(c.firstItem),
    @"secondItem": CBConstraintItem(c.secondItem), @"firstAttribute": @(c.firstAttribute),
    @"secondAttribute": @(c.secondAttribute), @"priority": @(c.priority), @"active": @(c.active),
    @"constant": CBNumber(c.constant), @"multiplier": CBNumber(c.multiplier), @"relation": @(c.relation) };
}
static NSDictionary *CBTraceConstraints(UIView *v) {
  NSMutableArray *owned = [NSMutableArray new], *affecting = [NSMutableArray new];
  NSMutableArray<UIView *> *chain = [NSMutableArray new];
  for (UIView *p=v; p && chain.count<20; p=p.superview) [chain addObject:p];
  for (UIView *p in chain) for (NSLayoutConstraint *c in p.constraints) {
    if (owned.count>=200) break;
    if (c.firstItem==v || c.secondItem==v || p==v) [owned addObject:CBTraceConstraint(c,p)];
  }
  for (NSLayoutConstraint *c in [v constraintsAffectingLayoutForAxis:UILayoutConstraintAxisVertical]) {
    if (affecting.count>=100) break;
    UIView *owner=nil;
    for (UIView *p in chain) if ([p.constraints containsObject:c]) { owner=p; break; }
    [affecting addObject:CBTraceConstraint(c,owner)];
  }
  CGSize intrinsic=v.intrinsicContentSize;
  return @{ @"ownedAndAncestorConstraints": owned, @"verticalAffecting": affecting,
    @"intrinsicSize": @[@(intrinsic.width),@(intrinsic.height)], @"ambiguousLayout": @(v.hasAmbiguousLayout),
    @"verticalCompressionResistance": @([v contentCompressionResistancePriorityForAxis:UILayoutConstraintAxisVertical]),
    @"verticalHugging": @([v contentHuggingPriorityForAxis:UILayoutConstraintAxisVertical]) };
}
static void CBTraceEvent(UIView *v, NSString *event, NSDictionary *details, BOOL transition) {
  if (CBTracing || CBCapturing || !NSThread.isMainThread || !CBTraceRelevant(v)) return;
  CBTracing=YES;
  if (!CBTraceEpoch) { CBTraceEpoch=CACurrentMediaTime(); CBTraceDate=NSDate.date; }
  if (!CBTraceEvents) CBTraceEvents=[NSMutableArray new];
  // Reserve room for the critical transitions even if routine fitting is noisy.
  if (CBTraceEvents.count>=1800 && !transition) { CBTraceDropped++; CBTracing=NO; return; }
  if (CBTraceEvents.count>=1900) { CBTraceDropped++; CBTracing=NO; return; }
  NSMutableDictionary *e=[@{ @"timeSinceTraceStartMs": @((CACurrentMediaTime()-CBTraceEpoch)*1000),
    @"viewId": CBId(v), @"class": NSStringFromClass(v.class), @"event": event,
    @"details": details ?: @{}, @"geometry": CBTraceGeometry(v) } mutableCopy];
  if (transition) {
    e[@"transition48to36"]=@YES;
    BOOL header=[NSStringFromClass(v.class) isEqualToString:@"RNSScreenStackHeaderSubview"];
    if (header ? CBHeaderTransitionStacks++<8 : CBTransitionStacks++<8) {
      e[@"callStackSymbols"]=NSThread.callStackSymbols;
      e[@"callStackAddresses"]=NSThread.callStackReturnAddresses;
    }
    e[@"constraintSnapshot"]=CBTraceConstraints(v);
  }
  [CBTraceEvents addObject:e]; CBTracing=NO;
}
static BOOL CBIsTransition(CGFloat before, CGFloat after) { return fabs(before-48)<0.5 && fabs(after-36)<0.5; }
static void CBTraceMutation(UIView *v, NSString *event, NSDictionary *before) {
  if (!before) return;
  CGFloat oldHeight=[before[@"bounds"][@"height"] doubleValue];
  BOOL changed=![before isEqual:CBTraceGeometry(v)];
  if (changed) CBTraceEvent(v,event,@{ @"before": before },CBIsTransition(oldHeight,v.bounds.size.height));
}
static NSDictionary *CBTraceBefore(UIView *v) {
  return !CBTracing && !CBCapturing && NSThread.isMainThread && CBTraceRelevant(v) ? CBTraceGeometry(v) : nil;
}
static void CBTraceAttach(UIView *back) {
  for (UIView *v=back; v; v=v.superview) {
    CBTraceRegister(v);
    if ([v isKindOfClass:UINavigationBar.class]) break;
  }
  if (back.window && !CBMountEpoch) CBMountEpoch=CACurrentMediaTime();
  CBTraceEvent(back,@"didMoveToWindow",@{},NO);
}
static void CBTraceConstraintsEvent(UIView *v, NSString *event) {
  if (CBTracing || CBCapturing || !CBTraceRelevant(v)) return;
  CBTracing=YES;
  NSDictionary *details=CBTraceConstraints(v);
  CBTracing=NO;
  CBTraceEvent(v,event,details,NO);
}
static UIView *CBConstraintObservedView(NSLayoutConstraint *c) {
  if ([c.firstItem isKindOfClass:UIView.class] && CBTraceRelevant(c.firstItem)) return c.firstItem;
  if ([c.secondItem isKindOfClass:UIView.class] && CBTraceRelevant(c.secondItem)) return c.secondItem;
  return nil;
}
// Interpose base implementations instead of replacing UIKit private classes or
// adding sizing behavior. Scope recording to the Back chain; all other calls pass through.
static void CBInstallTraceHooks(void) {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    for (NSString *name in @[@"setFrame:",@"setBounds:"]) {
      SEL selector=NSSelectorFromString(name);
      Method method=class_getInstanceMethod(UIView.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UIView *v, CGRect value) {
        NSDictionary *before=CBTraceBefore(v);
        ((void(*)(id,SEL,CGRect))original)(v,selector,value);
        CBTraceMutation(v,name,before);
      }));
    }
    {
      SEL selector=@selector(setCenter:); Method method=class_getInstanceMethod(UIView.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UIView *v, CGPoint value) {
        NSDictionary *before=CBTraceBefore(v);
        ((void(*)(id,SEL,CGPoint))original)(v,selector,value); CBTraceMutation(v,@"setCenter:",before);
      }));
    }
    {
      SEL selector=@selector(setTranslatesAutoresizingMaskIntoConstraints:);
      Method method=class_getInstanceMethod(UIView.class,selector); IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UIView *v, BOOL value) {
        NSDictionary *before=CBTraceBefore(v);
        ((void(*)(id,SEL,BOOL))original)(v,selector,value); CBTraceMutation(v,@"setTranslatesAutoresizingMaskIntoConstraints:",before);
      }));
    }
    for (NSString *name in @[@"layoutSubviews",@"updateConstraints",@"invalidateIntrinsicContentSize"]) {
      SEL selector=NSSelectorFromString(name); Method method=class_getInstanceMethod(UIView.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UIView *v) {
        NSDictionary *before=CBTraceBefore(v);
        if (before) CBTraceEvent(v,[name stringByAppendingString:@".enter"],@{},NO);
        ((void(*)(id,SEL))original)(v,selector);
        if (before) { CBTraceMutation(v,[name stringByAppendingString:@".changed"],before); CBTraceEvent(v,[name stringByAppendingString:@".exit"],@{},NO); }
      }));
    }
    for (NSString *name in @[@"sizeThatFits:",@"systemLayoutSizeFittingSize:"]) {
      SEL selector=NSSelectorFromString(name); Method method=class_getInstanceMethod(UIView.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^CGSize(UIView *v, CGSize value) {
        CGSize result=((CGSize(*)(id,SEL,CGSize))original)(v,selector,value);
        CBTraceEvent(v,name,@{ @"input": @[@(value.width),@(value.height)], @"result": @[@(result.width),@(result.height)] },NO);
        return result;
      }));
    }
    {
      SEL selector=@selector(systemLayoutSizeFittingSize:withHorizontalFittingPriority:verticalFittingPriority:);
      Method method=class_getInstanceMethod(UIView.class,selector); IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^CGSize(UIView *v, CGSize value, UILayoutPriority h, UILayoutPriority vertical) {
        CGSize result=((CGSize(*)(id,SEL,CGSize,UILayoutPriority,UILayoutPriority))original)(v,selector,value,h,vertical);
        CBTraceEvent(v,@"systemLayoutSizeFittingSize:priorities:",@{ @"input": @[@(value.width),@(value.height)],
          @"result": @[@(result.width),@(result.height)], @"horizontalPriority": @(h), @"verticalPriority": @(vertical) },NO);
        return result;
      }));
    }
    for (NSString *name in @[@"addConstraint:",@"removeConstraint:"]) {
      SEL selector=NSSelectorFromString(name); Method method=class_getInstanceMethod(UIView.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UIView *v, NSLayoutConstraint *constraint) {
        ((void(*)(id,SEL,id))original)(v,selector,constraint);
        if (CBTraceRelevant(v)) CBTraceEvent(v,name,CBTraceConstraint(constraint,v),NO);
      }));
    }
    {
      SEL selector=@selector(setConstant:); Method method=class_getInstanceMethod(NSLayoutConstraint.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(NSLayoutConstraint *c, CGFloat value) {
        CGFloat before=c.constant;
        ((void(*)(id,SEL,CGFloat))original)(c,selector,value);
        UIView *v=CBConstraintObservedView(c);
        if (v && before!=c.constant) CBTraceEvent(v,@"constraint.setConstant:",CBTraceConstraint(c,nil),NO);
      }));
    }
    {
      SEL selector=@selector(setPriority:); Method method=class_getInstanceMethod(NSLayoutConstraint.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(NSLayoutConstraint *c, UILayoutPriority value) {
        UILayoutPriority before=c.priority;
        ((void(*)(id,SEL,UILayoutPriority))original)(c,selector,value);
        UIView *v=CBConstraintObservedView(c);
        if (v && before!=c.priority) CBTraceEvent(v,@"constraint.setPriority:",CBTraceConstraint(c,nil),NO);
      }));
    }
    {
      SEL selector=@selector(setActive:); Method method=class_getInstanceMethod(NSLayoutConstraint.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(NSLayoutConstraint *c, BOOL value) {
        BOOL before=c.active;
        ((void(*)(id,SEL,BOOL))original)(c,selector,value);
        UIView *v=CBConstraintObservedView(c);
        if (v && before!=c.active) CBTraceEvent(v,@"constraint.setActive:",CBTraceConstraint(c,nil),NO);
      }));
    }
    {
      SEL selector=@selector(setLeftBarButtonItem:); Method method=class_getInstanceMethod(UINavigationItem.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(UINavigationItem *item, UIBarButtonItem *button) {
        CBTraceEvent(button.customView,@"navigationItem.setLeftBarButtonItem.enter",@{},NO);
        ((void(*)(id,SEL,id))original)(item,selector,button);
        CBTraceEvent(button.customView,@"navigationItem.setLeftBarButtonItem.exit",@{},NO);
      }));
    }
    // UIKit can update a backing layer directly, bypassing UIView's public setters.
    {
      SEL selector=@selector(setBounds:); Method method=class_getInstanceMethod(CALayer.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(CALayer *layer, CGRect value) {
        UIView *v=[layer.delegate isKindOfClass:UIView.class] ? (UIView *)layer.delegate : nil;
        NSDictionary *before=(v.layer==layer) ? CBTraceBefore(v) : nil;
        ((void(*)(id,SEL,CGRect))original)(layer,selector,value);
        CBTraceMutation(v,@"CALayer.setBounds:",before);
      }));
    }
    {
      SEL selector=@selector(setPosition:); Method method=class_getInstanceMethod(CALayer.class,selector);
      IMP original=method_getImplementation(method);
      method_setImplementation(method,imp_implementationWithBlock(^(CALayer *layer, CGPoint value) {
        UIView *v=[layer.delegate isKindOfClass:UIView.class] ? (UIView *)layer.delegate : nil;
        NSDictionary *before=(v.layer==layer) ? CBTraceBefore(v) : nil;
        ((void(*)(id,SEL,CGPoint))original)(layer,selector,value);
        CBTraceMutation(v,@"CALayer.setPosition:",before);
      }));
    }
  });
}
@interface CBTraceLoader : NSObject
@end
@implementation CBTraceLoader
+ (void)load { CBInstallTraceHooks(); }
@end

// Dynamic public OSLogStore API avoids adding a production/pod link dependency.
// Do not treat an empty, unavailable, or privacy-redacted store as proof no warning occurred.
@protocol CBLogStoreAPI
+ (id)storeWithScope:(NSInteger)scope error:(NSError **)error;
- (id)positionWithDate:(NSDate *)date;
- (id)entriesEnumeratorWithOptions:(NSUInteger)options position:(id)position predicate:(NSPredicate *)predicate error:(NSError **)error;
- (NSString *)composedMessage;
- (NSDate *)date;
@end
static NSDictionary *CBConstraintLogs(void) {
  dlopen("/System/Library/Frameworks/OSLog.framework/OSLog",RTLD_LAZY);
  Class<CBLogStoreAPI> cls=(Class<CBLogStoreAPI>)NSClassFromString(@"OSLogStore");
  if (!cls) return @{ @"status": @"OSLogStore unavailable; absence of warnings unproven" };
  NSError *error=nil;
  id<CBLogStoreAPI> store=[cls storeWithScope:1 error:&error]; // OSLogStoreCurrentProcessIdentifier
  if (!store) return @{ @"status": @"OSLogStore access unavailable", @"errorCode": @(error.code) };
  id position=[store positionWithDate:CBTraceDate ?: NSDate.date];
  NSPredicate *filter=[NSPredicate predicateWithFormat:@"eventMessage CONTAINS[c] 'Unable to simultaneously satisfy constraints' OR eventMessage CONTAINS[c] 'Will attempt to recover by breaking constraint'"];
  id<NSFastEnumeration> entries=[store entriesEnumeratorWithOptions:0 position:position predicate:filter error:&error];
  if (!entries) return @{ @"status": @"OSLogStore enumeration unavailable", @"errorCode": @(error.code) };
  NSMutableArray *messages=[NSMutableArray new];
  for (id<CBLogStoreAPI> entry in entries) {
    if (messages.count>=20) break;
    // Offline diagnostic has no account or health text. Export only constraint warnings.
    NSString *message=[entry composedMessage];
    if (message.length>16000) message=[message substringToIndex:16000];
    [messages addObject:@{ @"message": message ?: @"", @"timeSinceTraceStartMs": @([[entry date] timeIntervalSinceDate:CBTraceDate]*1000) }];
  }
  return @{ @"status": messages.count ? @"captured current-process constraint warnings" : @"no matching warnings returned; store coverage is not guaranteed",
    @"messages": messages, @"warningsSuppressed": @NO };
}
static NSDictionary *CBTraceReport(void) {
  return @{ @"events": CBTraceEvents ?: @[], @"droppedEvents": @(CBTraceDropped),
    @"mountTimeSinceTraceStartMs": CBMountEpoch && CBTraceEpoch ? @((CBMountEpoch-CBTraceEpoch)*1000) : (id)NSNull.null,
    @"constraintWarnings": CBConstraintLogs(),
    @"coverage": @"UIView base methods and CALayer backing geometry; subclass overrides that do not call super may bypass fitting hooks. Header intrinsic/Fabric/layout also explicitly observed. No private layout API invoked." };
}
