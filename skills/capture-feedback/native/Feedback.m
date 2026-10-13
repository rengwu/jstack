#import <AppKit/AppKit.h>
#import <ImageIO/ImageIO.h>
#import <CommonCrypto/CommonDigest.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>

// One process while the panel is open; Foundation-only commands otherwise.
static NSFileManager *FM;
static NSString *Executable;
static void Fail(NSString *message) {
    @throw [NSException exceptionWithName:@"FeedbackError" reason:message userInfo:nil];
}
static void Check(BOOL ok, NSString *message) { if (!ok) Fail(message); }
static NSString *Join(NSString *root, NSString *name) { return [root stringByAppendingPathComponent:name]; }
static NSString *Quote(NSString *s) { return [NSString stringWithFormat:@"'%@'", [s stringByReplacingOccurrencesOfString:@"'" withString:@"'\\''"]]; }
static NSDictionary *Command(NSString *action, NSString *root) {
    NSArray *args = @[Executable, action, @"--session", root];
    NSMutableArray *quoted = [NSMutableArray array];
    for (NSString *arg in args) [quoted addObject:Quote(arg)];
    return @{@"argv":args, @"command":[quoted componentsJoinedByString:@" "]};
}
static NSData *JSON(id value) {
    NSError *error;
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:NSJSONWritingPrettyPrinted|NSJSONWritingSortedKeys error:&error];
    Check(data != nil, error.localizedDescription);
    return data;
}
static void Output(id value) {
    NSData *data = JSON(value);
    fwrite(data.bytes, 1, data.length, stdout); fputc('\n', stdout); fflush(stdout);
}
static struct stat RegularInfo(NSString *path, BOOL directory) {
    struct stat st;
    Check(lstat(path.fileSystemRepresentation, &st) == 0, [NSString stringWithFormat:@"Cannot read %@: %s", path, strerror(errno)]);
    Check(directory ? S_ISDIR(st.st_mode) : S_ISREG(st.st_mode), [@"Expected a regular " stringByAppendingFormat:@"%@: %@", directory ? @"directory" : @"file", path]);
    return st;
}
static NSData *Read(NSString *path) {
    struct stat st = RegularInfo(path, NO);
    Check(st.st_size <= 100 * 1024 * 1024, @"File exceeds 100 MB; preserve it and inspect manually.");
    NSError *error;
    NSData *data = [NSData dataWithContentsOfFile:path options:0 error:&error];
    Check(data != nil, error.localizedDescription);
    return data;
}
static BOOL UUIDString(id s) { return [s isKindOfClass:NSString.class] && [[NSUUID alloc] initWithUUIDString:s] != nil; }
static NSString *Trim(NSString *s) { return [s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet]; }

static void Save(NSString *root, NSDictionary *batch) {
    NSData *data = JSON(batch);
    NSString *temporary = Join(root, @".batch.next");
    int fd = open(temporary.fileSystemRepresentation, O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW, 0600);
    Check(fd >= 0, @"Could not save feedback. Keep this window open and check available disk space.");
    const char *bytes = data.bytes;
    size_t remaining = data.length;
    BOOL ok = YES;
    while (remaining) {
        ssize_t count = write(fd, bytes, remaining);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) { ok = NO; break; }
        bytes += count; remaining -= count;
    }
    if (ok) ok = fsync(fd) == 0;
    close(fd);
    Check(ok && rename(temporary.fileSystemRepresentation, Join(root, @"batch.json").fileSystemRepresentation) == 0,
          @"Could not save feedback. Keep this window open and check available disk space.");
}
static NSMutableDictionary *Load(NSString *input, NSString **actual) {
    Check(input.length > 0 && input.isAbsolutePath, @"Supply an absolute --session path from create.");
    RegularInfo(input, YES);
    NSString *root = input.stringByResolvingSymlinksInPath;
    NSError *error;
    id batch = [NSJSONSerialization JSONObjectWithData:Read(Join(root, @"batch.json")) options:NSJSONReadingMutableContainers error:&error];
    Check([batch isKindOfClass:NSDictionary.class], @"Invalid batch.json; preserve the session.");
    Check([batch[@"kind"] isEqual:@"jstack-capture-feedback"] && [batch[@"schemaVersion"] isEqual:@1]
          && UUIDString(batch[@"id"]) && [root.lastPathComponent isEqual:batch[@"id"]]
          && [batch[@"directory"] isEqual:root], @"Invalid session identity; preserve the session.");
    Check([batch[@"project"] isKindOfClass:NSString.class] && [batch[@"project"] isAbsolutePath], @"Invalid project path.");
    Check([@[@"draft", @"submitted"] containsObject:batch[@"status"]] && [batch[@"items"] isKindOfClass:NSArray.class], @"Invalid batch state.");
    NSMutableSet *names = [NSMutableSet set];
    for (id item in batch[@"items"]) {
        Check([item isKindOfClass:NSDictionary.class] && UUIDString(item[@"id"])
              && [item[@"image"] isEqual:[item[@"id"] stringByAppendingString:@".png"]]
              && [item[@"feedback"] isKindOfClass:NSString.class] && ![names containsObject:item[@"image"]], @"Invalid feedback item.");
        [names addObject:item[@"image"]];
        RegularInfo(Join(root, item[@"image"]), NO);
    }
    if (actual) *actual = root;
    return batch;
}
static int Lock(NSString *root) {
    int fd = open(Join(root, @".lock").fileSystemRepresentation, O_RDWR|O_CREAT|O_NOFOLLOW, 0600);
    Check(fd >= 0, @"Cannot open the session lock.");
    struct stat st;
    if (fstat(fd, &st) || !S_ISREG(st.st_mode) || flock(fd, LOCK_EX|LOCK_NB)) { close(fd); return -1; }
    return fd;
}
static NSString *Digest(NSString *root, NSDictionary *batch) {
    CC_SHA256_CTX context; CC_SHA256_Init(&context);
    NSData *data = JSON(batch);
    CC_SHA256_Update(&context, data.bytes, (CC_LONG)data.length);
    for (NSDictionary *item in batch[@"items"]) {
        @autoreleasepool {
            data = Read(Join(root, item[@"image"]));
            CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)data, NULL);
            BOOL valid = source && CGImageSourceGetCount(source) == 1 && CFEqual(CGImageSourceGetType(source), CFSTR("public.png"));
            if (source) CFRelease(source);
            Check(valid, @"A capture is not a valid PNG; preserve the session.");
            CC_SHA256_Update(&context, data.bytes, (CC_LONG)data.length);
        }
    }
    unsigned char digest[CC_SHA256_DIGEST_LENGTH]; CC_SHA256_Final(digest, &context);
    NSMutableString *hex = [NSMutableString string];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) [hex appendFormat:@"%02x", digest[i]];
    return hex;
}
static void RequireSubmitted(NSDictionary *batch) {
    Check([batch[@"status"] isEqual:@"submitted"] && [batch[@"items"] count] > 0, @"The batch has not been submitted.");
    for (NSDictionary *item in batch[@"items"]) Check(Trim(item[@"feedback"]).length > 0, @"A capture is missing feedback.");
}
static NSDictionary *Waiting(NSString *root) {
    return @{@"status":@"waiting", @"session":root, @"next":Command(@"collect", root)};
}
static BOOL WaitState(NSString *root, NSString *state, BOOL exclusive) {
    int fd = open(Join(root, @".wait").fileSystemRepresentation, O_WRONLY|O_CREAT|O_NOFOLLOW|O_NONBLOCK|(exclusive ? O_EXCL : 0), 0600);
    if (fd < 0 && exclusive && errno == EEXIST) return NO;
    Check(fd >= 0, @"Cannot write wait state.");
    @try {
        struct stat st; Check(fstat(fd, &st) == 0 && S_ISREG(st.st_mode), @"Invalid wait state.");
        NSData *data = [[state stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding];
        Check(ftruncate(fd, 0) == 0 && write(fd, data.bytes, data.length) == (ssize_t)data.length, @"Cannot save wait state.");
    } @finally { close(fd); }
    return YES;
}
static NSDictionary *Collect(NSString *root, BOOL stopWait) {
    NSDictionary *batch = Load(root, &root);
    if (stopWait) WaitState(root, @"stopped", NO);
    int lock = Lock(root);
    if (lock < 0) return Waiting(root);
    @try {
        batch = Load(root, NULL);
        if ([batch[@"status"] isEqual:@"draft"]) return Waiting(root);
        RequireSubmitted(batch);
        NSMutableArray *items = [NSMutableArray array];
        for (NSDictionary *item in batch[@"items"]) [items addObject:@{@"image":Join(root, item[@"image"]), @"feedback":item[@"feedback"]}];
        return @{@"status":@"received", @"session":root, @"project":batch[@"project"], @"items":items, @"receipt":Digest(root, batch)};
    } @finally { close(lock); }
}
static void Notify(NSArray *argv, NSString *root) {
    NSString *message = [@"capture-feedback ready: " stringByAppendingString:root];
    NSMutableArray *args = [NSMutableArray array];
    for (NSString *arg in [argv subarrayWithRange:NSMakeRange(1, argv.count - 1)]) [args addObject:[arg isEqual:@"{message}"] ? message : arg];
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/env"];
    task.arguments = [@[argv[0]] arrayByAddingObjectsFromArray:args];
    task.standardOutput = NSFileHandle.fileHandleWithNullDevice;
    task.standardError = NSFileHandle.fileHandleWithNullDevice;
    NSError *error; Check([task launchAndReturnError:&error], error.localizedDescription);
    NSTimeInterval deadline = NSProcessInfo.processInfo.systemUptime + 15;
    while (task.running && NSProcessInfo.processInfo.systemUptime < deadline) [NSThread sleepForTimeInterval:0.05];
    if (task.running) { [task terminate]; Fail(@"Notification timed out."); }
    [task waitUntilExit]; Check(task.terminationStatus == 0, [NSString stringWithFormat:@"Notification exited %d.", task.terminationStatus]);
}
static void Wait(NSString *root, NSString *seconds, NSString *notification) {
    seconds = seconds ?: @"3600";
    NSCharacterSet *nonDigits = NSCharacterSet.decimalDigitCharacterSet.invertedSet;
    Check(seconds.length && [seconds rangeOfCharacterFromSet:nonDigits].location == NSNotFound
          && seconds.integerValue >= 1 && seconds.integerValue <= 86400, @"--timeout-seconds must be an integer from 1 to 86400.");
    NSArray *notify = notification ? [NSJSONSerialization JSONObjectWithData:[notification dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : nil;
    if (notification) {
        Check([notify isKindOfClass:NSArray.class] && notify.count > 0, @"Invalid notification command.");
        for (id arg in notify) Check([arg isKindOfClass:NSString.class], @"Invalid notification argument.");
        Check([notify[0] length] > 0, @"Missing notification executable.");
    }
    Load(root, &root);
    // Preserve the no-restart guarantee for sessions from the previous version.
    BOOL oldAttempt = NO;
    for (NSString *name in @[@".wait.started", @".wait.stop", @"completion.json"]) oldAttempt |= [FM fileExistsAtPath:Join(root, name)];
    if (oldAttempt || !WaitState(root, @"waiting", YES)) {
        Output(notify ? @{@"status":@"fallback", @"reason":@"already_started", @"session":root} : Waiting(root)); return;
    }
    if (notify) Output(@{@"status":@"armed", @"session":root});
    @try {
        NSTimeInterval deadline = NSProcessInfo.processInfo.systemUptime + seconds.integerValue;
        while (NSProcessInfo.processInfo.systemUptime < deadline) {
            @autoreleasepool {
                if (![FM fileExistsAtPath:root]) { if (!notify) Output(@{@"status":@"stopped"}); return; }
                NSString *state = [[NSString alloc] initWithData:Read(Join(root, @".wait")) encoding:NSUTF8StringEncoding];
                if ([state hasPrefix:@"stopped"]) { if (!notify) Output(Waiting(root)); return; }
                // Draft images may change during editing; validate on submission.
                NSDictionary *batch = [NSJSONSerialization JSONObjectWithData:Read(Join(root, @"batch.json")) options:0 error:nil];
                if ([batch[@"status"] isEqual:@"submitted"]) {
                    NSDictionary *result = Collect(root, NO);
                    if ([result[@"status"] isEqual:@"received"]) {
                        WaitState(root, @"received", NO);
                        if (notify) { Notify(notify, root); WaitState(root, @"notified", NO); }
                        else Output(result);
                        return;
                    }
                }
            }
            [NSThread sleepForTimeInterval:1];
        }
        WaitState(root, @"timed_out", NO);
        if (!notify) Output(Waiting(root));
    } @catch (NSException *error) {
        if ([FM fileExistsAtPath:root]) WaitState(root, [@"failed: " stringByAppendingString:error.reason], NO);
        if (!notify) @throw;
    }
}
static int Complete(NSString *root, NSString *seconds) {
    Load(root, &root);
    NSString *plugin = NSBundle.mainBundle.bundlePath;
    for (int i = 0; i < 4; i++) plugin = plugin.stringByDeletingLastPathComponent;
    NSMutableArray *args = [@[@"node", Join(plugin, @"scripts/input-completion.mjs"), @"--", Executable, @"wait", @"--session", root] mutableCopy];
    if (seconds) [args addObjectsFromArray:@[@"--timeout-seconds", seconds]];
    NSTask *task = [[NSTask alloc] init]; task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/env"]; task.arguments = args;
    NSError *error; Check([task launchAndReturnError:&error], error.localizedDescription);
    [task waitUntilExit];
    // The launcher already printed the collector's startup result.
    return task.terminationStatus;
}
static void Finish(NSString *root, NSString *receipt) {
    NSDictionary *batch = Load(root, &root);
    int lock = Lock(root);
    Check(lock >= 0, @"The session is open. Close its window before cleanup.");
    @try {
        batch = Load(root, NULL); RequireSubmitted(batch);
        Check(receipt.length == 64 && [receipt isEqual:Digest(root, batch)], @"Missing or changed receipt. Collect and handle the current batch before finish.");
        NSMutableSet *known = [NSMutableSet setWithArray:@[@"batch.json", @".lock", @".wait.started", @".wait.stop", @"completion.json", @".wait"]];
        for (NSDictionary *item in batch[@"items"]) [known addObject:item[@"image"]];
        NSError *error;
        NSArray *names = [FM contentsOfDirectoryAtPath:root error:&error];
        Check(names != nil, error.localizedDescription);
        // Never recursively remove a user-provided directory or unexpected files.
        for (NSString *name in names) {
            Check([known containsObject:name], [@"Unexpected session file; nothing was deleted: " stringByAppendingString:name]);
            RegularInfo(Join(root, name), NO);
        }
        for (NSString *name in names) Check(unlink(Join(root, name).fileSystemRepresentation) == 0, @"Could not remove a handled session file.");
        Check(rmdir(root.fileSystemRepresentation) == 0, @"Could not remove the handled session directory.");
        Output(@{@"status":@"finished", @"session":root});
    } @finally { close(lock); }
}

@interface FeedbackText : NSTextView
@property NSString *itemID;
@end
@implementation FeedbackText
- (void)drawRect:(NSRect)dirtyRect {
    [super drawRect:dirtyRect];
    if (!self.string.length) {
        NSPoint origin = self.textContainerOrigin;
        origin.x += self.textContainer.lineFragmentPadding;
        [@"Add feedback…" drawAtPoint:origin withAttributes:@{NSFontAttributeName:self.font, NSForegroundColorAttributeName:NSColor.placeholderTextColor}];
    }
}
@end

@interface FeedbackList : NSView
@end
@implementation FeedbackList
- (BOOL)isFlipped { return YES; }
@end

@interface FeedbackRow : FeedbackList
@property NSImageView *thumbnail;
@property FeedbackText *editor;
@property NSButton *removeButton;
@property NSBox *separator;
- (CGFloat)layoutForWidth:(CGFloat)width;
@end
@implementation FeedbackRow
- (instancetype)initWithFrame:(NSRect)frame {
    if ((self = [super initWithFrame:frame])) {
        self.clipsToBounds = YES;
        _thumbnail = [[NSImageView alloc] initWithFrame:NSMakeRect(12, 14, 72, 60)];
        _thumbnail.imageScaling = NSImageScaleProportionallyUpOrDown;
        [_thumbnail setAccessibilityLabel:@"Captured region"];
        [self addSubview:_thumbnail];
        _editor = [[FeedbackText alloc] initWithFrame:NSMakeRect(94, 8, MAX(100, frame.size.width - 132), 64)];
        _editor.minSize = NSZeroSize; _editor.maxSize = NSMakeSize(CGFLOAT_MAX, CGFLOAT_MAX);
        _editor.verticallyResizable = NO; _editor.horizontallyResizable = NO;
        _editor.textContainer.widthTracksTextView = YES;
        _editor.textContainer.heightTracksTextView = NO;
        _editor.font = [NSFont systemFontOfSize:NSFont.systemFontSize];
        _editor.textColor = NSColor.labelColor; _editor.drawsBackground = NO;
        _editor.richText = NO; _editor.importsGraphics = NO; _editor.allowsUndo = YES;
        _editor.textContainerInset = NSMakeSize(0, 4);
        [_editor setAccessibilityLabel:@"Feedback"];
        [self addSubview:_editor];
        _removeButton = [NSButton buttonWithImage:[NSImage imageWithSystemSymbolName:@"trash" accessibilityDescription:@"Remove capture"] target:nil action:nil];
        _removeButton.bordered = NO; _removeButton.contentTintColor = NSColor.secondaryLabelColor;
        _removeButton.toolTip = @"Remove capture";
        [self addSubview:_removeButton];
        _separator = [[NSBox alloc] init]; _separator.boxType = NSBoxSeparator;
        [self addSubview:_separator];
    }
    return self;
}
- (CGFloat)layoutForWidth:(CGFloat)width {
    CGFloat editorWidth = MAX(100, width - 132);
    [self.editor setFrameSize:NSMakeSize(editorWidth, self.editor.frame.size.height)];
    self.editor.textContainer.containerSize = NSMakeSize(editorWidth, CGFLOAT_MAX);
    NSLayoutManager *layout = self.editor.layoutManager;
    [layout ensureLayoutForTextContainer:self.editor.textContainer];
    CGFloat bottom = NSMaxY([layout usedRectForTextContainer:self.editor.textContainer]);
    // A trailing newline has its own insertion line, outside usedRect.
    if (layout.extraLineFragmentTextContainer == self.editor.textContainer)
        bottom = MAX(bottom, NSMaxY(layout.extraLineFragmentRect));
    CGFloat editorHeight = MAX(64, ceil(bottom + 2 * self.editor.textContainerInset.height));
    CGFloat height = MAX(88, editorHeight + 20);
    [self setFrameSize:NSMakeSize(width, height)];
    self.editor.frame = NSMakeRect(94, 8, editorWidth, editorHeight);
    self.removeButton.frame = NSMakeRect(width - 28, 12, 20, 22);
    self.separator.frame = NSMakeRect(12, height - 1, width - 24, 1);
    return height;
}
@end

@interface FeedbackApp : NSObject <NSApplicationDelegate, NSWindowDelegate, NSTextViewDelegate>
@property NSString *root;
@property NSMutableDictionary *batch;
@property int lock;
@property NSPanel *panel;
@property NSPanel *toast;
@property FeedbackList *list;
@property NSMutableArray<FeedbackRow *> *rows;
@property BOOL layingOut;
@property BOOL userSized;
@property NSScrollView *scroll;
@property NSTextField *empty;
@property NSButton *captureButton;
@property NSButton *submitButton;
@property NSTask *captureTask;
@property BOOL saveFailed;
@property BOOL submitted;
@end

@implementation FeedbackApp
- (NSMutableArray *)items { return self.batch[@"items"]; }
- (void)showError:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Feedback couldn’t be saved";
    alert.informativeText = message;
    [alert beginSheetModalForWindow:self.panel completionHandler:nil];
}
- (BOOL)save {
    @try { Save(self.root, self.batch); self.saveFailed = NO; return YES; }
    @catch (NSException *error) {
        if (!self.saveFailed) [self showError:error.reason];
        self.saveFailed = YES; return NO;
    }
}
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSMenu *menu = [[NSMenu alloc] init];
    NSMenuItem *appMenu = [[NSMenuItem alloc] init]; [menu addItem:appMenu];
    NSMenu *application = [[NSMenu alloc] init]; appMenu.submenu = application;
    [application addItemWithTitle:@"Quit Feedback" action:@selector(terminate:) keyEquivalent:@"q"];
    NSMenuItem *editMenu = [[NSMenuItem alloc] init]; [menu addItem:editMenu];
    NSMenu *edit = [[NSMenu alloc] initWithTitle:@"Edit"]; editMenu.submenu = edit;
    for (NSArray *entry in @[@[@"Undo", @"undo:", @"z"], @[@"Cut", @"cut:", @"x"], @[@"Copy", @"copy:", @"c"], @[@"Paste", @"paste:", @"v"], @[@"Select All", @"selectAll:", @"a"]])
        [edit addItemWithTitle:entry[0] action:NSSelectorFromString(entry[1]) keyEquivalent:entry[2]];
    NSApp.mainMenu = menu;
    [self buildPanel];
    NSRect screen = NSScreen.mainScreen.visibleFrame;
    [self.panel setFrameTopLeftPoint:NSMakePoint(NSMaxX(screen) - self.panel.frame.size.width - 24, NSMaxY(screen) - 24)];
    [self.panel makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
    // Opt-in maintainer timing marker; never an agent completion event.
    if (getenv("JSTACK_FEEDBACK_METRICS")) { fprintf(stderr, "feedback-ready\n"); fflush(stderr); }
}
- (void)buildPanel {
    // Use one coordinate space for the content and title bar. The layout guide below
    // keeps scrolling content out of the title bar, including during live scrolling.
    self.panel = [[NSPanel alloc] initWithContentRect:NSMakeRect(0, 0, 400, 144)
        styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable|NSWindowStyleMaskUtilityWindow|NSWindowStyleMaskFullSizeContentView backing:NSBackingStoreBuffered defer:NO];
    self.panel.title = @"Feedback"; self.panel.delegate = self;
    self.panel.titlebarAppearsTransparent = NO;
    self.panel.floatingPanel = YES; self.panel.hidesOnDeactivate = NO;
    self.panel.becomesKeyOnlyIfNeeded = NO; self.panel.releasedWhenClosed = NO;
    self.panel.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces|NSWindowCollectionBehaviorFullScreenAuxiliary;
    self.panel.contentMinSize = NSMakeSize(360, 140); self.panel.contentMaxSize = NSMakeSize(700, 800);
    NSView *content = self.panel.contentView;
    content.wantsLayer = YES;
    content.clipsToBounds = YES;
    self.scroll = [[NSScrollView alloc] initWithFrame:NSMakeRect(0, 48, 400, 96)];
    self.scroll.translatesAutoresizingMaskIntoConstraints = NO;
    self.scroll.hasVerticalScroller = YES; self.scroll.autohidesScrollers = YES;
    self.scroll.drawsBackground = YES; self.scroll.backgroundColor = NSColor.windowBackgroundColor;
    self.scroll.clipsToBounds = YES; self.scroll.contentView.clipsToBounds = YES;
    self.scroll.automaticallyAdjustsContentInsets = NO;
    self.scroll.contentView.postsFrameChangedNotifications = YES;
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(viewportChanged:)
        name:NSViewFrameDidChangeNotification object:self.scroll.contentView];
    self.list = [[FeedbackList alloc] initWithFrame:self.scroll.contentView.bounds];
    self.list.clipsToBounds = YES;
    self.scroll.documentView = self.list; [content addSubview:self.scroll];
    [NSLayoutConstraint activateConstraints:@[
        [self.scroll.leadingAnchor constraintEqualToAnchor:content.leadingAnchor],
        [self.scroll.trailingAnchor constraintEqualToAnchor:content.trailingAnchor],
        [self.scroll.topAnchor constraintEqualToAnchor:[self.panel.contentLayoutGuide topAnchor]],
        [self.scroll.bottomAnchor constraintEqualToAnchor:content.bottomAnchor constant:-48]
    ]];
    self.rows = [NSMutableArray array];
    self.empty = [NSTextField wrappingLabelWithString:@"Capture an area, then add feedback."];
    self.empty.frame = NSMakeRect(20, 82, 360, 22); self.empty.alignment = NSTextAlignmentCenter;
    self.empty.textColor = NSColor.secondaryLabelColor;
    self.empty.autoresizingMask = NSViewWidthSizable|NSViewMinYMargin;
    [content addSubview:self.empty];
    NSBox *separator = [[NSBox alloc] initWithFrame:NSMakeRect(0, 47, 400, 1)];
    separator.boxType = NSBoxSeparator; separator.autoresizingMask = NSViewWidthSizable; [content addSubview:separator];
    self.captureButton = [NSButton buttonWithTitle:@"Capture" target:self action:@selector(capture:)];
    self.captureButton.frame = NSMakeRect(12, 10, 100, 28);
    self.captureButton.keyEquivalent = @"n"; self.captureButton.keyEquivalentModifierMask = NSEventModifierFlagCommand;
    self.captureButton.toolTip = @"Capture a rectangular region (⌘N)";
    [content addSubview:self.captureButton];
    self.submitButton = [NSButton buttonWithTitle:@"Submit" target:self action:@selector(submit:)];
    self.submitButton.frame = NSMakeRect(288, 10, 100, 28); self.submitButton.autoresizingMask = NSViewMinXMargin;
    self.submitButton.keyEquivalent = @"\r"; self.submitButton.keyEquivalentModifierMask = NSEventModifierFlagCommand;
    self.submitButton.toolTip = @"Submit batch (⌘Return)";
    [content addSubview:self.submitButton];
    [self refresh];
}
- (void)refresh {
    self.empty.hidden = self.items.count > 0;
    self.scroll.hidden = !self.items.count;
    NSMutableArray *rows = [NSMutableArray array];
    for (NSDictionary *item in self.items) {
        FeedbackRow *row;
        for (FeedbackRow *existing in self.rows)
            if ([existing.editor.itemID isEqual:item[@"id"]]) { row = existing; break; }
        if (!row) {
            row = [self rowForItem:item];
            [self.list addSubview:row];
        }
        [rows addObject:row];
    }
    for (FeedbackRow *row in self.rows) if (![rows containsObject:row]) [row removeFromSuperview];
    self.rows = rows;
    [self layoutBatch];
    [self updateSubmit];
}
- (void)layoutBatch {
    if (self.layingOut || !self.list) return;
    self.layingOut = YES;
    NSPoint origin = self.scroll.contentView.bounds.origin;
    // A native non-overlay scroller can change the available width when it appears.
    for (NSUInteger pass = 0; pass < 3; pass++) {
        [self.panel.contentView layoutSubtreeIfNeeded];
        [self.scroll tile];
        CGFloat width = self.scroll.contentSize.width, height = 0;
        for (FeedbackRow *row in self.rows) {
            [row setFrameOrigin:NSMakePoint(0, height)];
            height += [row layoutForWidth:width];
        }
        [self.list setFrameSize:NSMakeSize(width, height)];
        if (!self.userSized) {
            NSRect frame = self.panel.frame;
            CGFloat titleHeight = self.panel.contentView.bounds.size.height - self.panel.contentLayoutRect.size.height;
            CGFloat desired = titleHeight + 48 + MAX(96, MIN(384, height));
            if (fabs(self.panel.contentView.bounds.size.height - desired) > 0.5) {
                [self.panel setContentSize:NSMakeSize(self.panel.contentView.bounds.size.width, desired)];
                [self.panel setFrameTopLeftPoint:NSMakePoint(frame.origin.x, NSMaxY(frame))];
            }
        }
        [self.panel.contentView layoutSubtreeIfNeeded];
        [self.scroll reflectScrolledClipView:self.scroll.contentView];
        [self.scroll tile];
        if (fabs(self.scroll.contentSize.width - width) < 0.5) break;
    }
    origin.y = MAX(0, MIN(origin.y, self.list.frame.size.height - self.scroll.contentSize.height));
    [self.scroll.contentView scrollToPoint:origin];
    [self.scroll reflectScrolledClipView:self.scroll.contentView];
    self.layingOut = NO;
}
- (void)windowWillStartLiveResize:(NSNotification *)notification { self.userSized = YES; }
- (void)windowDidResize:(NSNotification *)notification { [self layoutBatch]; }
- (void)viewportChanged:(NSNotification *)notification {
    if (fabs(self.list.frame.size.width - self.scroll.contentSize.width) > 0.5) [self layoutBatch];
}
- (void)updateSubmit {
    BOOL ready = self.items.count > 0 && !self.saveFailed && !self.captureTask;
    for (NSDictionary *item in self.items) if (!Trim(item[@"feedback"]).length) ready = NO;
    self.submitButton.enabled = ready;
}
- (FeedbackRow *)rowForItem:(NSDictionary *)item {
    FeedbackRow *row = [[FeedbackRow alloc] initWithFrame:NSMakeRect(0, 0, self.scroll.contentSize.width, 88)];
    row.editor.string = item[@"feedback"]; row.editor.itemID = item[@"id"]; row.editor.delegate = self;
    row.removeButton.identifier = item[@"id"]; row.removeButton.target = self; row.removeButton.action = @selector(remove:);
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:Join(self.root, item[@"image"])], NULL);
    if (source) {
        CGImageRef thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)@{
            (id)kCGImageSourceCreateThumbnailFromImageAlways:@YES, (id)kCGImageSourceThumbnailMaxPixelSize:@160,
            (id)kCGImageSourceCreateThumbnailWithTransform:@YES});
        row.thumbnail.image = thumbnail ? [[NSImage alloc] initWithCGImage:thumbnail size:NSZeroSize] : nil;
        if (thumbnail) CGImageRelease(thumbnail); CFRelease(source);
    } else row.thumbnail.image = nil;
    return row;
}
- (void)textDidChange:(NSNotification *)notification {
    FeedbackText *editor = notification.object;
    for (NSMutableDictionary *item in self.items) if ([item[@"id"] isEqual:editor.itemID]) { item[@"feedback"] = editor.string; break; }
    [self save]; [self layoutBatch]; [self updateSubmit];
    editor.needsDisplay = YES;
    [editor scrollRangeToVisible:editor.selectedRange];
}
- (void)remove:(NSButton *)sender {
    NSUInteger index = [self.items indexOfObjectPassingTest:^BOOL(NSDictionary *item, NSUInteger i, BOOL *stop) { return [item[@"id"] isEqual:sender.identifier]; }];
    if (index == NSNotFound) return;
    NSMutableDictionary *item = self.items[index];
    [self.items removeObjectAtIndex:index];
    if (![self save]) { [self.items insertObject:item atIndex:index]; return; }
    NSError *error;
    if (![FM removeItemAtPath:Join(self.root, item[@"image"]) error:&error]) [self showError:error.localizedDescription];
    [self refresh];
}
- (void)capture:(id)sender {
    if (self.captureTask || ![self save]) return;
    NSString *identifier = NSUUID.UUID.UUIDString.lowercaseString;
    NSString *file = Join(self.root, [identifier stringByAppendingString:@".png"]);
    [self.panel orderOut:nil];
    NSTask *task = [[NSTask alloc] init]; self.captureTask = task;
    task.executableURL = [NSURL fileURLWithPath:@"/usr/sbin/screencapture"];
    task.arguments = @[@"-i", @"-s", @"-x", @"-t", @"png", file];
    task.standardInput = NSFileHandle.fileHandleWithNullDevice;
    task.terminationHandler = ^(NSTask *ended) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.captureTask = nil;
            [self.panel makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
            if ([FM fileExistsAtPath:file]) {
                @try {
                    RegularInfo(file, NO); chmod(file.fileSystemRepresentation, 0600);
                    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:file], NULL);
                    BOOL valid = source && CGImageSourceGetCount(source) > 0;
                    if (source) CFRelease(source);
                    Check(valid, @"The capture could not be read. Try Capture again.");
                    [self.items addObject:[@{@"id":identifier, @"image":file.lastPathComponent, @"feedback":@""} mutableCopy]];
                    [self save]; [self refresh];
                    FeedbackRow *row = self.rows.lastObject;
                    [self.panel makeFirstResponder:row.editor];
                    [row.editor scrollRangeToVisible:NSMakeRange(0, 0)];
                } @catch (NSException *error) { [self showError:error.reason]; }
            } else if (ended.terminationStatus != 0) {
                [self showError:@"Capture did not complete. If macOS requests Screen Recording access, allow it in System Settings, then try Capture again. Escape cancels a selection."];
            }
            [self updateSubmit];
        });
    };
    NSError *error;
    if (![task launchAndReturnError:&error]) {
        self.captureTask = nil; [self.panel makeKeyAndOrderFront:nil]; [self showError:error.localizedDescription];
    }
}
- (void)submit:(id)sender {
    [self updateSubmit]; if (!self.submitButton.enabled) return;
    self.batch[@"status"] = @"submitted";
    if (![self save]) { self.batch[@"status"] = @"draft"; return; }
    self.submitted = YES;
    close(self.lock); self.lock = -1;
    Output(@{@"status":@"submitted", @"session":self.root, @"next":Command(@"collect", self.root)});
    NSRect frame = self.panel.frame; [self.panel orderOut:nil];
    self.toast = [[NSPanel alloc] initWithContentRect:NSMakeRect(NSMaxX(frame) - 290, NSMaxY(frame) - 70, 290, 58)
        styleMask:NSWindowStyleMaskNonactivatingPanel backing:NSBackingStoreBuffered defer:NO];
    self.toast.floatingPanel = YES; self.toast.hidesOnDeactivate = NO;
    self.toast.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces|NSWindowCollectionBehaviorFullScreenAuxiliary;
    NSTextField *label = [NSTextField labelWithString:@"Batch submitted. Return to your agent."];
    label.frame = NSMakeRect(14, 20, 265, 20); label.font = [NSFont systemFontOfSize:12];
    [self.toast.contentView addSubview:label]; [self.toast orderFrontRegardless];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{ [NSApp terminate:nil]; });
}
- (BOOL)windowShouldClose:(NSWindow *)sender { if (![self save]) return NO; [NSApp terminate:nil]; return NO; }
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    if (!self.submitted && ![self save]) return NSTerminateCancel;
    if (self.captureTask.running) [self.captureTask terminate];
    if (self.lock >= 0) { close(self.lock); self.lock = -1; }
    if (!self.submitted) Output(@{@"status":@"draft", @"session":self.root, @"next":Command(@"launch", self.root)});
    return NSTerminateNow;
}
@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        umask(0077); FM = NSFileManager.defaultManager;
        Executable = NSBundle.mainBundle.executablePath;
        @try {
            NSArray *args = NSProcessInfo.processInfo.arguments;
            Check(args.count >= 2, @"Usage: Feedback create --project PATH | launch|show|wait|complete|collect --session PATH | finish --session PATH --receipt HASH");
            NSString *command = args[1];
            NSDictionary *allowed = @{@"create":@[@"project", @"sessions"], @"launch":@[@"session"], @"show":@[@"session"], @"collect":@[@"session"], @"wait":@[@"session", @"timeout-seconds", @"notify"], @"complete":@[@"session", @"timeout-seconds"], @"finish":@[@"session", @"receipt"]};
            Check(allowed[command] != nil, @"Unknown command.");
            NSMutableDictionary *options = [NSMutableDictionary dictionary];
            for (NSUInteger i = 2; i < args.count; i += 2) {
                NSString *flag = args[i];
                Check([flag hasPrefix:@"--"] && i + 1 < args.count, @"Each option requires a value.");
                NSString *key = [flag substringFromIndex:2];
                Check([allowed[command] containsObject:key] && !options[key], [@"Unknown or repeated option: " stringByAppendingString:flag]);
                options[key] = args[i+1];
            }
            if ([command isEqual:@"create"]) {
                NSString *project = options[@"project"];
                Check(project.isAbsolutePath, @"Supply the target project's absolute --project path.");
                project = project.stringByResolvingSymlinksInPath; RegularInfo(project, YES);
                NSString *parent = options[@"sessions"] ?: Join(NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject, @"jstack/feedback");
                Check(parent.isAbsolutePath, @"--sessions must be absolute.");
                NSError *error;
                Check([FM createDirectoryAtPath:parent withIntermediateDirectories:YES attributes:@{NSFilePosixPermissions:@0700} error:&error], error.localizedDescription);
                RegularInfo(parent, YES); parent = parent.stringByResolvingSymlinksInPath;
                NSString *identifier = NSUUID.UUID.UUIDString.lowercaseString;
                NSString *root = Join(parent, identifier);
                Check([FM createDirectoryAtPath:root withIntermediateDirectories:NO attributes:@{NSFilePosixPermissions:@0700} error:&error], error.localizedDescription);
                NSDictionary *batch = @{@"kind":@"jstack-capture-feedback", @"schemaVersion":@1, @"id":identifier, @"directory":root, @"project":project,
                    @"status":@"draft", @"items":@[]};
                Save(root, batch);
                Output(@{@"status":@"created", @"session":root, @"next":Command(@"launch", root), @"completion":Command(@"complete", root), @"wait":Command(@"wait", root)});
            } else if ([command isEqual:@"collect"]) Output(Collect(options[@"session"], YES));
            else if ([command isEqual:@"wait"]) Wait(options[@"session"], options[@"timeout-seconds"], options[@"notify"]);
            else if ([command isEqual:@"complete"]) return Complete(options[@"session"], options[@"timeout-seconds"]);
            else if ([command isEqual:@"finish"]) Finish(options[@"session"], options[@"receipt"]);
            else {
                NSString *root; NSMutableDictionary *batch = Load(options[@"session"], &root);
                Check([batch[@"status"] isEqual:@"draft"], @"Already submitted. Collect the batch instead of reopening it.");
                if ([command isEqual:@"launch"]) {
                    NSTask *task = [[NSTask alloc] init];
                    task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/open"];
                    task.arguments = @[@"-n", NSBundle.mainBundle.bundlePath, @"--args", @"show", @"--session", root];
                    NSError *error; Check([task launchAndReturnError:&error], error.localizedDescription);
                    [task waitUntilExit]; Check(task.terminationStatus == 0, @"Could not open Feedback.app.");
                    Output(@{@"status":@"opened", @"session":root});
                } else {
                    int lock = Lock(root); Check(lock >= 0, @"This session is already open.");
                    FeedbackApp *delegate = [[FeedbackApp alloc] init]; delegate.root = root; delegate.batch = Load(root, NULL); delegate.lock = lock;
                    [NSApplication sharedApplication]; NSApp.delegate = delegate; [NSApp run];
                }
            }
            return 0;
        } @catch (NSException *error) {
            NSData *data = JSON(@{@"status":@"error", @"message":error.reason ?: @"Unknown error", @"instruction":@"Preserve session files; correct the reported problem before retrying."});
            fwrite(data.bytes, 1, data.length, stderr); fputc('\n', stderr); return 1;
        }
    }
}
