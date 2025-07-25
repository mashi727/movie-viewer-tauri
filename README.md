# Movie Viewer (Tauri Version)

A cross-platform video player with chapter management built with Tauri and React.

## Features

- Play various video formats (MP4, AVI, MKV, MOV, TS, M2TS, MP3, WebM)
- Chapter/bookmark management with timestamps
- Dark/Light mode support (automatic OS detection)
- Cross-platform (Windows, macOS, Linux)
- Keyboard shortcuts for efficient navigation
- Save and load chapter lists
- YouTube chapter format import

## Development

### Prerequisites

- Node.js (v16 or later)
- Rust (latest stable)
- Platform-specific dependencies:
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools

### Setup

1. Install dependencies:
```bash
npm install
```

2. Add icon files to `src-tauri/icons/` directory

3. Run in development mode:
```bash
npm run tauri dev
```

### Building

Build for your current platform:
```bash
npm run tauri build
```

## Keyboard Shortcuts

- `Ctrl/Cmd+O` - Open video file
- `Ctrl/Cmd+L` - Load chapter file
- `Ctrl/Cmd+S` - Save chapter file
- `Ctrl/Cmd+J` - Jump to selected time
- `Ctrl/Cmd+←` - Rewind 1 minute
- `Ctrl/Cmd+→` - Forward 1 minute
- `Ctrl/Cmd+V` - Paste YouTube chapters (when table focused)
- `Space` - Play/Pause
- `Shift+>` - Forward 1 frame
- `Shift+<` - Backward 1 frame

## Controls

- **-10s / +10s** - Skip backward/forward 10 seconds
- **-1s / +1s** - Skip backward/forward 1 second
- **-.3s / +.3s** - Skip backward/forward 0.3 seconds
- **-1f / +1f** - Skip backward/forward 1 frame
- **Copy Time** - Copy current timestamp to clipboard
- **Add Row** - Add new chapter entry
- **Sort** - Sort chapters by time
- **Jump** - Jump to selected chapter time
- **Save** - Save chapter list

## Chapter File Format

Chapter files are saved as `.txt` files with the same name as the video file:

```
0:00:00.000 Opening
0:05:23.500 Chapter 1 - Introduction
0:12:45.000 Chapter 2 - Main Content
```

## License

MIT License
