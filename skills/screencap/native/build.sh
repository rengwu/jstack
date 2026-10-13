#!/bin/sh
# Maintainer-only build. Skill invocations use the committed app.
set -eu
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app="$source_dir/../bin/Screencap.app"
mkdir -p "$app/Contents/MacOS"
xcrun clang -fobjc-arc -Os -Wall -Wextra -Werror -Wno-unused-parameter \
  -mmacosx-version-min=11.0 -arch arm64 -arch x86_64 \
  -framework AppKit -framework ImageIO \
  "$source_dir/Screencap.m" -o "$app/Contents/MacOS/Screencap"
strip -x "$app/Contents/MacOS/Screencap"
cp "$source_dir/Info.plist" "$app/Contents/Info.plist"
codesign --force --sign - --identifier dev.jstack.screencap "$app"
codesign --verify --strict "$app"
