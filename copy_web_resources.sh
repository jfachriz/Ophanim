#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building React UI for Ophanim by Archangel DSP..."
npm run build

echo "Copying web resources for Ophanim.vst3 and Ophanim.component..."

# Destination in local plugin directory
if [ -d "$SCRIPT_DIR/plugin" ]; then
  mkdir -p "$SCRIPT_DIR/plugin/resources/web"
  rm -rf "$SCRIPT_DIR/plugin/resources/web"/*
  cp -R "$SCRIPT_DIR/dist/"* "$SCRIPT_DIR/plugin/resources/web/"
  echo "Copied web resources to plugin/resources/web"
fi

# Inject web resources directly into all plugin bundles (build, output, and system locations)
for bundle in \
  "$SCRIPT_DIR/build/Ophanim_artefacts/Release/VST3/Ophanim.vst3" \
  "$SCRIPT_DIR/build/Ophanim_artefacts/Release/AU/Ophanim.component" \
  "$SCRIPT_DIR/build/out/Ophanim.vst3" \
  "$SCRIPT_DIR/build/out/Ophanim.component" \
  "$HOME/Library/Audio/Plug-Ins/VST3/Ophanim.vst3" \
  "$HOME/Library/Audio/Plug-Ins/Components/Ophanim.component"; do
  if [ -d "$bundle" ]; then
    mkdir -p "$bundle/Contents/Resources/web"
    rm -rf "$bundle/Contents/Resources/web"/*
    cp -R "$SCRIPT_DIR/dist/"* "$bundle/Contents/Resources/web/"
    echo "Injected web resources into: $bundle/Contents/Resources/web"
  fi
done

# Always deploy built VST3 and AU plugin bundles to user system plugins directories
mkdir -p "$HOME/Library/Audio/Plug-Ins/VST3"
mkdir -p "$HOME/Library/Audio/Plug-Ins/Components"

SRC_VST=""
if [ -d "$SCRIPT_DIR/build/out/Ophanim.vst3" ]; then
  SRC_VST="$SCRIPT_DIR/build/out/Ophanim.vst3"
elif [ -d "$SCRIPT_DIR/build/Ophanim_artefacts/Release/VST3/Ophanim.vst3" ]; then
  SRC_VST="$SCRIPT_DIR/build/Ophanim_artefacts/Release/VST3/Ophanim.vst3"
fi

if [ -n "$SRC_VST" ]; then
  mkdir -p "$SRC_VST/Contents/Resources/web"
  cp -R "$SCRIPT_DIR/dist/"* "$SRC_VST/Contents/Resources/web/"
  rm -rf "$HOME/Library/Audio/Plug-Ins/VST3/Ophanim.vst3"
  cp -R "$SRC_VST" "$HOME/Library/Audio/Plug-Ins/VST3/"
  echo "Deployed Ophanim.vst3 -> $HOME/Library/Audio/Plug-Ins/VST3/Ophanim.vst3"
fi

SRC_AU=""
if [ -d "$SCRIPT_DIR/build/out/Ophanim.component" ]; then
  SRC_AU="$SCRIPT_DIR/build/out/Ophanim.component"
elif [ -d "$SCRIPT_DIR/build/Ophanim_artefacts/Release/AU/Ophanim.component" ]; then
  SRC_AU="$SCRIPT_DIR/build/Ophanim_artefacts/Release/AU/Ophanim.component"
fi

if [ -n "$SRC_AU" ]; then
  mkdir -p "$SRC_AU/Contents/Resources/web"
  cp -R "$SCRIPT_DIR/dist/"* "$SRC_AU/Contents/Resources/web/"
  rm -rf "$HOME/Library/Audio/Plug-Ins/Components/Ophanim.component"
  cp -R "$SRC_AU" "$HOME/Library/Audio/Plug-Ins/Components/"
  echo "Deployed Ophanim.component -> $HOME/Library/Audio/Plug-Ins/Components/Ophanim.component"
fi

echo "Ophanim web resources packaged & deployed successfully!"