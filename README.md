# Clippy - State of the Art AI Assistant

Clippy is a comprehensive, open-source AI Desktop Assistant blending cutting-edge 3D WebGL interfaces with robust native Python inferences representing a true jump in how we interact with intelligent agents locally.

![Clippy Overview](https://i.imgur.com/placeholder.png) <!-- Conceptual Image placeholder -->

## 🌟 The Philosophy
This project was completely overhauled to transcend the "amateur" tier and venture into modern, fluid, production-ready aesthetic and functional boundaries. Clippy shouldn't just respond; it should **react, bounce, dodge, listen, look and feel alive.**

## 🚀 Key Features

### 👁️ Organic 3D Visualization (React Three Fiber)
Instead of a rigid image, Clippy represents a mathematically perfect, glassmorphic entity (`MeshTransmissionMaterial` and `ContactShadows`).
- **Kinematic Physics**: Clippy is draggable and has "squash and stretch" spring physics when moved or dropped (using `@use-gesture/react` and `react-spring`).
- **Dynamic Eye Tracking**: The assistant smoothly tracks your cursor.
- **Micro-Interactions**: Pet him (moves slowly over him and he turns pink & happy) or scare him (moves rapidly and he turns red and dodges your mouse).
- **Procedural Expressions**: 8 distinct, transitionable emotional states governed directly by what he is doing or saying.

### 🧠 Core Intelligence & Offline processing
- **Wake Word Detection**: Powered by `openwakeword`, deeply optimized to consume minimum CPU.
- **Local STT & LLM**: Transcribes your voice blazingly fast with `whisper` and generates responses via `llama-cpp-python`.
- **Token Streaming**: No more waiting for the full response; text flows onto the beautiful Glassmorphic `Framer Motion` dialogue bubble instantly.
- **Audio Feedback (TTS)**: Fully integrated local Text-to-Speech syncing with real-time FFT frequency evaluation to make Clippy pulse to his own voice!

### 💻 Deep OS Integrations (Electron)
- **Zero-Barrier UI**: Clippy lives on a 100% transparent fullscreen clicking-through overlay (`win.setIgnoreMouseEvents`). Run him anywhere, over any game or app!
- **System Context**: Clippy inherently knows what OS you are running, your free RAM, and the specific application you currently have focused (using `active-win`), allowing him to answer contextual questions like "How do I do X in this app?".
- **Command Executions**: Tells him "open youtube" and the backend parses commands instantaneously directly into OS routines.
- **Global Shortcuts**: Press `Ctrl+Shift+Space` any time to wake him up.
- **System Tray**: Configure Performance Modes natively via the desktop tray or context menus.

## 🛠️ Architecture

* **Frontend**: Vite + React + TypeScript + Tailwind CSS v4 + Framer Motion.
* **Graphical Engine**: Three.js + React Three Fiber + Drei.
* **State Management**: Zustand (+ Custom Web Audio Queuing).
* **Desktop Wrapper**: Electron `v30+` + IPC pipelines + `electron-builder`.
* **Backend**: Python 3.10+ + FastAPI + WebSockets + Numpy + Asyncio Tasks.

## ⚙️ Installation & Running

1. **Install Backend Dependencies**:
    `pip install -r requirements.txt`
2. **Launch Backend**:
    `python main.py` (Starts FastAPI WebSocket server on port `8081`)
3. **Install Frontend/Electron**:
    `npm install` (Root directory) & `cd client && npm install`
4. **Run Developer Environment**:
    Open two terminals:
    - Terminal A: `cd client && npm run dev`
    - Terminal B: `npm start` (Runs Electron wrapper)

## 📦 Production Builds

To package an executable for Windows (`.exe`):
`npm run dist`

## 💡 Performance Controls
Due to the heavy PostProcessing pipelines (Bloom/Chromatic Aberration), a `Low Performance Mode` is included. Right-click the assistant and toggle the mode to optimize rendering for laptops or integrated graphics.
