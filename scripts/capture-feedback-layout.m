// Maintainer regression test: real AppKit/TextKit layout, without showing a window.
#define main FeedbackApplicationMain
#import "../skills/capture-feedback/native/Feedback.m"
#undef main

static void Require(BOOL condition, NSString *message) {
    if (!condition) { fprintf(stderr, "%s\n", message.UTF8String); exit(1); }
}

static void NoteFits(FeedbackRow *row) {
    NSTextView *editor = row.editor;
    NSLayoutManager *layout = editor.layoutManager;
    NSRange glyphs = [layout glyphRangeForTextContainer:editor.textContainer];
    Require(NSMaxRange(glyphs) == layout.numberOfGlyphs, @"The note lost glyphs outside its container.");
    NSRect text = [layout boundingRectForGlyphRange:glyphs inTextContainer:editor.textContainer];
    Require(NSMaxY(text) + editor.textContainerOrigin.y <= NSHeight(editor.bounds), @"The note clips visible text.");
    if ([editor.string hasSuffix:@"\n"])
        Require(NSMaxY(layout.extraLineFragmentRect) + editor.textContainerOrigin.y <= NSHeight(editor.bounds), @"The trailing insertion line is clipped.");
    Require(NSContainsRect(row.bounds, editor.frame), @"The note overflows its row.");
}

int main(void) {
    @autoreleasepool {
        [NSApplication sharedApplication];
        FeedbackApp *app = [[FeedbackApp alloc] init];
        app.batch = [@{@"items":[NSMutableArray array]} mutableCopy];
        [app buildPanel];
        FeedbackRow *row = [[FeedbackRow alloc] initWithFrame:NSMakeRect(0, 0, 400, 88)];
        [app.rows addObject:row]; [app.list addSubview:row]; app.scroll.hidden = NO;

        row.editor.string = @"Short note.";
        CGFloat shortHeight = [row layoutForWidth:400]; NoteFits(row);
        row.editor.string = [@"A long note with wrapping, 日本語, emoji 🧑‍💻 and blank lines.\n\n" stringByPaddingToLength:2400
            withString:@"Continue editing at the bottom of this note.\n\n" startingAtIndex:0];
        row.editor.string = [row.editor.string stringByAppendingString:@"\n"];
        CGFloat wideHeight = [row layoutForWidth:680]; NoteFits(row);
        CGFloat narrowHeight = [row layoutForWidth:345]; NoteFits(row);
        Require(narrowHeight > wideHeight && wideHeight > shortHeight, @"Notes do not grow and wrap with their available width.");

        for (NSNumber *style in @[@(NSScrollerStyleLegacy), @(NSScrollerStyleOverlay)]) {
            app.scroll.scrollerStyle = style.integerValue;
            [app layoutBatch];
            NSRect usable = [app.panel.contentView convertRect:app.panel.contentLayoutRect fromView:nil];
            Require(NSMinY(app.scroll.frame) >= 48 && NSMaxY(app.scroll.frame) <= NSMaxY(usable), @"The batch overlaps the footer or title bar.");
            Require(fabs(app.scroll.contentSize.height - 384) < 0.5, @"The title bar consumes part of the compact batch viewport.");
            Require(fabs(NSWidth(row.frame) - app.scroll.contentSize.width) < 0.5, @"A scrollbar obscures the row controls.");
            Require(row.editor.enclosingScrollView == app.scroll, @"The note uses a nested scroll area.");
            [row.editor scrollRangeToVisible:NSMakeRange(row.editor.string.length, 0)];
            Require(NSMaxY(app.scroll.documentVisibleRect) >= NSMaxY(row.editor.frame) - 8, @"The caret cannot be scrolled into view.");
        }

        [app windowWillStartLiveResize:[NSNotification notificationWithName:NSWindowWillStartLiveResizeNotification object:app.panel]];
        [app.panel setContentSize:NSMakeSize(540, 300)]; [app layoutBatch];
        row.editor.string = @"Short again."; [app layoutBatch]; NoteFits(row);
        Require(NSHeight(row.frame) == shortHeight, @"Shortening the note leaves its old height behind.");
        Require(NSEqualSizes(app.panel.contentView.bounds.size, NSMakeSize(540, 300)), @"Editing resets the user's window size.");
        Require(app.scroll.contentView.bounds.origin.y == 0, @"Shortening a note strands the viewport past the content.");
        Require(!app.panel.visible, @"The layout test must not display a window.");
        puts("Long notes, wrapping, blank lines, caret scrolling, content boundaries, and manual window size passed.");
    }
}
