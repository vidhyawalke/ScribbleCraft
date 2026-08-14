<p align="center">
  <img src="public/logo.png" alt="ScribbleCraft Logo" width="280" />
</p>

<h1 align="center">ScribbleCraft</h1>

<p align="center">
  <em>A fast, expressive collaborative whiteboard with realistic paper sticky notes, Google handwriting typography, and live real-time WebRTC multiplayer collaboration. Built by Vidhya Walke.</em>
</p>

---

## Technologies

- **Vite**: Frontend build tooling and fast HMR
- **React.js (v19)**: Component-based reactive UI architecture
- **TypeScript**: End-to-end type safety
- **WebRTC & PeerJS**: Peer-to-peer data channels with Google STUN servers for cross-device real-time sync
- **BroadcastChannel API**: Zero-latency tab-to-tab state synchronization on the same machine
- **Canvas 2D API**: High-performance rasterization for drawing freehand strokes, arrows, lines, and geometric shapes
- **CSS & SVG Clip Paths**: Realistic multi-layered paper sticky note textures with shadow depth and adhesive tape

---

## Features

Here is what you can do with ScribbleCraft:

- **Choose a Tool**: Selection, hand/pan, rectangles, diamonds, ellipses, arrows, lines, freehand pencils, text, sticky notes, and eraser.
- **Draw and Move**: Click and drag on the canvas to draw shapes. Select elements to move them across the infinite canvas, or resize them using the corner bounding box handles.
- **Instant Text Typing**: Click the text tool and tap anywhere on the canvas to start typing immediately. Double-click any shape or text to edit it in place.
- **Realistic Sticky Notes**: Place realistic paper sticky notes with adhesive tape effects, custom rotations, paper colors, and handwriting Google fonts.
- **Live Real-Time Collaboration**: Share your room link with anyone. Multiple users can sketch together simultaneously with live remote collaborator cursors and instant state broadcasting without needing any sign-in.
- **Zoom & Pan**: Use Ctrl + Scroll or the bottom-left controls to zoom in and out. Hold the Spacebar and drag (or use the Hand tool) to pan smoothly across the canvas.
- **Multi-Board Management**: Create, switch, rename, and manage multiple boards saved in your browser storage.
- **Exporting**: Export your whiteboard drawings as high-resolution PNG images or backup the raw JSON schema.

---

## Keyboard Shortcuts

- **Selection Tool**: `1` or `V`
- **Rectangle Tool**: `2` or `R`
- **Diamond Tool**: `3` or `D`
- **Ellipse / Circle Tool**: `4` or `O`
- **Arrow Tool**: `5` or `A`
- **Line Tool**: `6` or `L`
- **Pencil Tool**: `7` or `P`
- **Text Tool**: `8` or `T`
- **Sticky Note Tool**: `9` or `S`
- **Eraser Tool**: `0` or `E`
- **Pan Canvas**: `H` or Hold `Space` and drag
- **Delete Selected**: `Delete` or `Backspace`
- **Undo**: `Ctrl + Z`
- **Redo**: `Ctrl + Y` or `Ctrl + Shift + Z`
- **Zoom In / Out**: `Ctrl + +` / `Ctrl + -`
- **Reset Zoom & Pan**: `Ctrl + 0`
- **Deselect**: `Escape`

---

## The Process

I started by designing a lightweight Canvas 2D engine that provides a fast, smooth foundation for rendering shapes, text, and freehand pencil strokes. From there, I focused on intuitive spatial interactions—allowing users to drag, transform, and resize elements with precision.

Next, I wanted the whiteboard to feel organic and warm rather than clinical. I engineered paper-textured sticky notes using custom SVG clip paths, drop-shadow layering, and dynamic Google Handwriting fonts (Kalam, Caveat, Architects Daughter, Patrick Hand, Reenie Beanie, and Indie Flower).

To make drawing seamless, I implemented an instant inline text engine: clicking anywhere on the board immediately opens an auto-focused live editor.

Live collaboration was the key milestone: instead of requiring sign-in or accounts, I engineered a peer-to-peer WebRTC mesh with PeerJS and fallback BroadcastChannels. Anyone who opens a shareable link can see other participants' cursors moving in real-time and co-sketch instantly.

Finally, I refined the user interface with a floating top toolbar, subscript shortcut numbers, contextual hint bars, and an inspector panel for fine-grained stroke, fill, opacity, and layer ordering.

---

## What I Learned

Building this project deepened my understanding of coordinate systems, WebRTC networking, and state management:

### 1. Peer-to-Peer WebRTC State Synchronization
Architecting room-based data channels taught me how to broadcast delta updates, handle peer handshakes, and synchronize whiteboard states across disparate network conditions without a central database.

### 2. Canvas Coordinates and Zoom-Pan Transforms
Converting between screen coordinates (mouse client coordinates) and canvas model space required working with linear algebra scaling, pan offsets, and transform matrices for accurate hit-testing and corner handle resizing.

### 3. Asynchronous Typography Loading
Integrating Google Fonts dynamically meant managing asynchronous font stylesheet injection so that custom handwriting fonts render accurately during live typing and canvas rasterization.

### 4. Undo / Redo History Stack
Creating a multi-step history manager required immutability patterns to track board states cleanly while broadcasting changes across collaborative sessions.

---

## How Can It Be Improved?

- Add drawing templates (flowcharts, mindmaps, wireframe components).
- Add image upload and SVG asset importing directly onto the canvas.
- Add lasso selection for grouping and bulk-moving multiple shapes.
- Add presentation / laser pointer mode for live team meetings.
- Add dark mode and customized canvas grid patterns.

---

## Author

**Vidhya Walke**
- **LinkedIn**: [linkedin.com/in/vidhyawalke](https://www.linkedin.com/in/vidhyawalke/)
- **GitHub**: [@vidhyawalke](https://github.com/vidhyawalke)
