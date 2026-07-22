# Ophanim

**Ophanim** is a parametric reverb audio plugin developed by **Archangel DSP**.

## Features
- Dynamic Real-time Spectrum Analyzer & Parametric EQ
- Interactive Resonant Filters (Low Cut, High Cut, Bell, Shelves)
- Reverb Processing Engine
- Built with JUCE C++ & Modern React Web UI

## Building from Source

### Requirements
- macOS 10.15 or later
- Node.js (v18+) & npm / pnpm
- CMake & Xcode / Clang

### Build Steps

1. Install Frontend Dependencies:
   ```bash
   npm install
   ```

2. Package Web Resources & Deploy Plugins:
   ```bash
   bash copy_web_resources.sh
   ```

3. Build macOS VST3 Installer (.dmg):
   ```bash
   bash build_installer.sh
   ```

The compiled installer `.dmg` will be created inside the `Installer/` folder as `Ophanim-v1.0.0.dmg`.

## License
© 2026 Archangel DSP. All rights reserved.
