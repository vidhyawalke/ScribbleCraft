# 🎨 ScribbleCraft

> **ScribbleCraft** is a lightweight, responsive collaborative whiteboard web application featuring custom paper-style sticky notes, Google handwriting fonts, live real-time WebRTC multi-user collaboration, and export capabilities.

---

## ✨ Features

- 📝 **Custom Paper Sticky Notes**: Realistic paper notes with washi tape accents, rotation tilts, custom colors, and fluid text editing.
- ✍️ **Google Handwriting Fonts**: Dynamically loads and renders organic handwriting fonts (*Kalam*, *Architects Daughter*, *Caveat*, *Indie Flower*, *Patrick Hand*, *Reenie Beanie*, etc.).
- 🚀 **Real-Time Live Collaboration**:
  - No login/sign-in required — open to any user immediately.
  - Shareable room links (`?room=XYZ`).
  - Live remote collaborator cursors with custom color flags and user badges.
  - Instant synchronization for drawings, shapes, sticky notes, and canvas actions via WebRTC & BroadcastChannel.
- 📐 **Drawing & Shapes Tools**:
  - Rectangles, diamonds, ellipses, arrows, lines, and freehand pencil.
  - Hand panning and zooming (20% to 400%).
  - Configurable canvas grids (dots, lines, none).
- 💾 **Multi-Board Management & Export**:
  - Local multi-board creation, renaming, and switching.
  - Export to PNG, SVG, and JSON backup.
  - Import saved JSON boards.
- ⚡ **Zero-Config Vercel Deployment**: Pre-configured `vercel.json` for SPA routing.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **P2P Collaboration**: PeerJS (WebRTC DataChannels + Google STUN) & BroadcastChannel API
- **Icons**: Lucide React
- **Linter**: Oxlint

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/vidhyawalke/ScribbleCraft.git
cd ScribbleCraft
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
```

---

## 🌐 Deploying to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel Dashboard](https://vercel.com).
3. Framework Preset: **Vite**.
4. Click **Deploy**. The `vercel.json` included in the root handles client-side routing automatically!
