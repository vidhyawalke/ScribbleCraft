# ScribbleCraft 🎨

A fast, beautiful, and collaborative whiteboard application built with React, TypeScript, Canvas 2D, and **Socket.io**. Draw shapes, write text, stick notes, and collaborate with your team in real time — no sign-in or API keys required.

---

## ✨ Key Features

- **Real-Time Collaboration (Socket.io)** — Instant room sharing with ultra-low latency (<15ms), 60fps live collaborator cursors, and element syncing.
- **Drawing Tools** — Rectangle, diamond, ellipse, arrow, line, freehand pencil, text, and eraser.
- **Realistic Sticky Notes** — Paper-textured sticky notes with handwriting fonts, rotation, and tape effects.
- **Infinite Canvas** — Smooth panning, zooming, and customizable grid patterns (dots, lines, none).
- **Multi-Board Workspace** — Create, switch, rename, and backup multiple boards stored locally.
- **Export Options** — One-click export to high-resolution PNG, SVG, or JSON backup.
- **Undo / Redo** — Full multi-state history stack (`Ctrl+Z` / `Ctrl+Y`).
- **Connection Status Indicator** — Visual real-time indicator (`🟢 Live Room`, `🟠 Connecting...`, `⚪ Offline`).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, HTML5 Canvas 2D, Lucide Icons
- **Real-Time Engine**: Socket.io (WebSockets) + BroadcastChannel API (same-device multi-tab sync)
- **Backend Server**: Node.js, Express, Socket.io
- **Styling**: Modern CSS design system with glassmorphism, glowing badges, and micro-animations

---

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Run Development Server

Running `npm run dev` starts both the **Vite client** (port `5173`) and the **Socket.io Collaboration Server** (port `3001`):

```bash
npm run dev
```

- Web App: `http://localhost:5173`
- Socket Server: `http://localhost:3001`
- Server Health Check: `http://localhost:3001/health`

### 3. Share Collaboration Room

Open `http://localhost:5173/?room=my-room` or click **"Share Room"** in the top header to copy your live collaboration link. Any peer joining that link will instantly connect to the same collaborative room!

---

## ⌨️ Keyboard Shortcuts

| Tool / Action | Shortcut |
| :--- | :--- |
| **Selection** | `V` or `1` |
| **Rectangle** | `R` or `2` |
| **Diamond** | `D` or `3` |
| **Ellipse** | `O` or `4` |
| **Arrow** | `A` or `5` |
| **Line** | `L` or `6` |
| **Pencil** | `P` or `7` |
| **Text** | `T` or `8` |
| **Sticky Note** | `S` or `9` |
| **Eraser** | `E` or `0` |
| **Pan Canvas** | `H` or hold `Space` |
| **Delete Selected** | `Delete` / `Backspace` |
| **Undo** | `Ctrl+Z` |
| **Redo** | `Ctrl+Y` or `Ctrl+Shift+Z` |
| **Zoom In / Out** | `Ctrl++` / `Ctrl+-` |
| **Reset Zoom** | `Ctrl+0` |
| **Deselect All** | `Escape` |

---

## 🌐 Production Deployment

- **Frontend**: Deploy on Vercel, Netlify, or Cloudflare Pages. Set `VITE_SOCKET_URL` environment variable to your deployed socket server URL.
- **Socket Server**: Deploy `server/index.js` on Render, Railway, Fly.io, or any Node.js container service.

---

## 👤 Author

**Vidhya Walke** — [LinkedIn](https://www.linkedin.com/in/vidhyawalke/) · [GitHub](https://github.com/vidhyawalke)
