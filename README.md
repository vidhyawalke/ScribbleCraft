# ScribbleCraft

A collaborative whiteboard app built with React, TypeScript, and WebRTC. Draw shapes, write text, add sticky notes, and sketch with others in real time — no sign-in required.

---

## Features

- **Drawing tools** — Rectangle, diamond, ellipse, arrow, line, freehand pencil, and text
- **Sticky notes** — Paper-style notes with custom colors, rotations, and handwriting fonts
- **Real-time collaboration** — Share a room link; others join instantly with live cursors (WebRTC + PeerJS)
- **Infinite canvas** — Pan and zoom freely across your board
- **Multi-board support** — Create and switch between multiple boards, saved in the browser
- **Export** — Save your board as a PNG image or JSON backup
- **Undo / Redo** — Full history stack with `Ctrl+Z` / `Ctrl+Y`

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for bundling
- **Canvas 2D API** for rendering
- **PeerJS / WebRTC** for peer-to-peer collaboration
- **BroadcastChannel API** for same-device tab sync

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Selection | `V` or `1` |
| Rectangle | `R` or `2` |
| Diamond | `D` or `3` |
| Ellipse | `O` or `4` |
| Arrow | `A` or `5` |
| Line | `L` or `6` |
| Pencil | `P` or `7` |
| Text | `T` or `8` |
| Sticky Note | `S` or `9` |
| Eraser | `E` or `0` |
| Pan | `H` or hold `Space` |
| Delete | `Delete` / `Backspace` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` or `Ctrl+Shift+Z` |
| Zoom In/Out | `Ctrl++` / `Ctrl+-` |
| Reset View | `Ctrl+0` |
| Deselect | `Escape` |

---

## Getting Started

```bash
npm install
npm run dev
```

---

## Author

**Vidhya Walke** — [LinkedIn](https://www.linkedin.com/in/vidhyawalke/) · [GitHub](https://github.com/vidhyawalke)
