# Local-First Voice AI Assistant 🎙️⚡

A high-performance, cross-platform, local-first Voice AI Assistant with dual deployment:
1. **Lightweight Desktop Client (<15MB native footprint):** Built with **Tauri v2 + Rust** and styled with a sleek **G-Helper** aesthetic.
2. **Synchronized Web Application:** Fully compatible browser export with Web Speech API and storage fallback.

---

## 🌟 Key Features

- **Gboard-like Streaming Voice Dictation:**
  - **Push-to-Talk Mode:** Hold `Space` (or mic button) to speak with instant transcription.
  - **Voice-Activated Mode (VAD):** Continuous listening with real-time speech activity detection, noise gating, and silence timeout.
  - **Smart Punctuation & Auto-Capitalization:** Automatic punctuation parsing (`"comma"`, `"period"`, `"question mark"`, `"new line"`).
  - **Fluid Audio Waveform Visualizer:** Animated glowing canvas reacting in real-time to microphone audio levels.
- **Pluggable LLM Engine:**
  - Local offline execution via **Ollama** (`/api/chat` with tool schemas) and **llama.cpp**.
  - Cloud fallbacks: **Google Gemini** (`gemini-2.0-flash`), **OpenAI** (`gpt-4o-mini`), and **Anthropic Claude**.
- **System Tools via Schema-Validated Tool Calling:**
  - `scan_filesystem`: High-speed multi-threaded file crawler powered by Rust (`ignore` & `walkdir` crates) with extension and regex filtering.
  - `schedule_task`: Persistent SQLite task and reminder scheduler (`rusqlite`) with background cron checks and native desktop notifications.
  - `system_status`: Real-time hardware telemetry (CPU %, RAM, swap, and disk partition stats via `sysinfo`).
  - `open_file_path`: Direct OS file manager/application launcher.
  - `send_desktop_notification`: Native OS desktop notification banners.
- **Sleek G-Helper Aesthetic:**
  - Compact dark OLED theme with live hardware load pills, model quick-switcher, and interactive tool cards.

---

## 📁 Project Architecture

```
c:\Local Voice Assisted LLM\
├── .github/workflows/release.yml # Cross-platform matrix build (.exe, .AppImage, .dmg)
├── src-tauri/                    # Tauri v2 Native Rust Backend
│   ├── Cargo.toml                # Rust dependencies (rusqlite, sysinfo, ignore, etc.)
│   ├── tauri.conf.json           # Compact window configuration
│   └── src/
│       ├── main.rs               # Desktop executable entrypoint
│       ├── lib.rs                # Tauri command registry & background worker
│       ├── db/mod.rs             # SQLite database migrations & task CRUD
│       └── commands/
│           ├── scanner.rs        # Multi-threaded filesystem crawler
│           ├── scheduler.rs      # SQLite persistent task manager & notification engine
│           ├── system.rs         # Real-time hardware telemetry monitor
│           └── audio.rs          # PCM audio chunk & Whisper health probe
├── src/                          # React + TypeScript + Tailwind Frontend
│   ├── components/               # G-Helper UI components
│   │   ├── Header.tsx            # Live telemetry header & mode pill
│   │   ├── ChatInterface.tsx     # Message bubbles, interactive tool cards, dictation input
│   │   ├── AudioVisualizer.tsx   # Canvas glowing waveform visualizer
│   │   ├── TaskManagerModal.tsx  # SQLite task dashboard
│   │   ├── FileExplorerModal.tsx # Filesystem crawler modal
│   │   └── SettingsModal.tsx     # LLM and Voice configuration modal
│   ├── hooks/
│   │   ├── useAudioPipeline.ts   # PTT / VAD / Web Speech / Whisper streamer
│   │   └── useAgentOrchestrator.ts # Tool-calling loop & recursive reasoning
│   ├── services/
│   │   ├── tauriBridge.ts        # Unified bridge (Tauri IPC vs Browser Fallback)
│   │   ├── llmAdapters.ts        # Ollama, Gemini, OpenAI, Anthropic clients
│   │   ├── vadService.ts         # Energy VAD & WebAudio frame processor
│   │   └── toolsSchema.ts        # Strict JSON Schemas for system tools
│   ├── types/index.ts            # TypeScript interfaces
│   ├── App.tsx                   # Main layout container
│   ├── main.tsx                  # React DOM root
│   └── index.css                 # Dark Tailwind styles & animations
├── Dockerfile                    # Production Nginx container
├── docker-compose.yml            # Docker stack with web client & Ollama
└── vite.config.ts                # Dual-mode bundler
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode

#### Web Application Mode (Browser):
```bash
npm run dev
```
Open [http://localhost:1420](http://localhost:1420) in your browser.

#### Desktop Native Mode (Tauri v2):
```bash
npm run tauri:dev
```

---

## 🛠️ Configuration

Click the **Settings (⚙️)** icon in the top header to configure:
1. **LLM Provider:**
   - **Ollama:** `http://localhost:11434` with model `llama3.1:latest` (or `qwen2.5`, `mistral`, `deepseek-r1`).
   - **Google Gemini:** Enter your Gemini API key and select `gemini-2.0-flash`.
   - **OpenAI:** Enter your API key and choose `gpt-4o-mini` or `gpt-4o`.
2. **Voice & Dictation:**
   - **Mode:** Push-to-Talk (Space bar) or Continuous Voice Activation (VAD).
   - **VAD Sensitivity:** Adjust slider to ignore background noise.
   - **Smart Punctuation:** Automatically format spoken punctuation commands.

---

## 📦 Building for Production & Distribution

### Standalone Desktop Binaries (.exe, .AppImage, .dmg)
```bash
npm run tauri:build
```
The optimized native binary (<15MB) will be generated in `src-tauri/target/release/`.

### Web Client Build (Docker)
```bash
docker compose up -d
```
Accessible at [http://localhost:3000](http://localhost:3000).
