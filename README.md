<p align="center">
  <img src="assets/Ophanim.png" alt="Ophanim Plugin" width="100%">
</p>

<h1 align="center">Ophanim</h1>

<p align="center">
  <b>Parametric Reverb Audio Plugin</b><br>
  Developed by <b>Archangel DSP</b>
</p>

<p align="center">
  <a href="https://github.com/sponsors/jfachriz">
    <img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?logo=github" alt="Sponsor">
  </a>
</p>

---

## Overview

**Ophanim** is a parametric audio reverb plugin developed by **Archangel DSP**. It combines a real-time visual spectrum analyzer with interactive resonant filters and a rich reverb processing engine.

---

## Features

- **Interactive Parametric EQ Graph**: Double-click to create nodes, drag to adjust frequency & gain, mouse wheel to tweak Q / slope steepness.
- **FabFilter-Style Resonant Filters**: Real-time Low Cut, High Cut, Bell, Low Shelf, and High Shelf filters with natural resonance behavior.
- **Real-Time Spectrum Analyzer**: Multi-band FFT analyzer visualization.
- **Preset System**: Factory presets and user preset save/recall functionality.
- **True Bypass**: Pristine signal bypass when powered off.

---

## Controls and Parameters

| Control | Range | Description |
| :--- | :--- | :--- |
| **DECAY** | 0% - 100% | Reverb tail decay time |
| **PRE-DELAY** | 0ms - 250ms | Initial reflection delay time |
| **MIX** | 0% - 100% | Dry/wet signal balance |
| **WIDTH** | 0% - 100% | Stereo image spatial expansion |
| **POWER** | ON / OFF | True bypass power switch |

---

## System Requirements and Formats

| Format | Output File | Target Path |
| :--- | :--- | :--- |
| **VST3 Plugin** | `Ophanim.vst3` | `~/Library/Audio/Plug-Ins/VST3/` |
| **macOS Installer** | `Ophanim-v1.0.0.dmg` | `Installer/Ophanim-v1.0.0.dmg` |

**System Requirements:** macOS 10.15 (Catalina) or later.

---

## Building from Source

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build Web UI and Deploy Plugins**:
   ```bash
   bash copy_web_resources.sh
   ```

3. **Build macOS Installer (.dmg)**:
   ```bash
   bash build_installer.sh
   ```

---

## License

Arcadia Voices is proprietary software by Archangel DSP.
All rights reserved. Single-user license included.

© 2026 Archangel DSP | [Website](https://archangeldsp.sbs) | [Support](mailto:archangeldsp@gmail.com)
