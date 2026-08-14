import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasElement, ToolType, Point, Collaborator, AnchorPosition } from '../types';
import { StickyNoteElement } from './StickyNoteElement';
import { loadGoogleFont } from '../utils/googleFonts';

interface WhiteboardCanvasProps {
  elements: CanvasElement[];
  activeTool: ToolType;
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElements: (elements: CanvasElement[]) => void;
  zoom: number;
  panOffset: Point;
  setPanOffset: React.Dispatch<React.SetStateAction<Point>>;
  bgColor: string;
  gridType: 'dots' | 'lines' | 'none';
  isBoardLocked?: boolean;
  collaborators?: Collaborator[];
  onMouseMoveCursor?: (point: Point) => void;
  onToolComplete?: () => void;
  onInsertImage?: (file: File, pos?: Point) => void;
}

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'rotate' | null;

interface SnapAnchor {
  elementId: string;
  anchor: AnchorPosition;
  point: Point;
}

// Global Image Cache for Canvas 2D
const imageCache: { [url: string]: HTMLImageElement } = {};

// ─── Geometry helpers ────────────────────────────────────────────────────────

/** Perpendicular distance from point p to line segment a→b */
const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

// ─────────────────────────────────────────────────────────────────────────────

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  elements,
  activeTool,
  selectedId,
  onSelectElement,
  onUpdateElements,
  zoom,
  panOffset,
  setPanOffset,
  bgColor,
  gridType,
  isBoardLocked = false,
  collaborators = [],
  onMouseMoveCursor,
  onToolComplete,
  onInsertImage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);

  // Single element drag / resize
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null);
  const [initialResizeBox, setInitialResizeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRubberBanding, setIsRubberBanding] = useState(false);
  const [rubberBandBox, setRubberBandBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [groupStartPositions, setGroupStartPositions] = useState<{ id: string; x: number; y: number }[]>([]);
  const [groupDragStart, setGroupDragStart] = useState<Point>({ x: 0, y: 0 });

  // Eraser held-down state
  const [isEraserActive, setIsEraserActive] = useState(false);

  // Wireframe snap anchor
  const [activeSnapAnchor, setActiveSnapAnchor] = useState<SnapAnchor | null>(null);

  // Inline text editor
  const [editingText, setEditingText] = useState<{
    id?: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily: string;
    strokeColor: string;
    isNew: boolean;
  } | null>(null);

  // Preload google fonts used in elements
  useEffect(() => {
    elements.forEach((el) => {
      if (el.fontFamily) loadGoogleFont(el.fontFamily);
    });
  }, [elements]);

  // Focus text editor on open
  useEffect(() => {
    if (editingText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [editingText]);

  // ─── Coordinate helpers ─────────────────────────────────────────────────────

  const getCanvasCoords = (e: React.MouseEvent | React.DragEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  };

  /**
   * Universal hit test.  Arrows/lines use distance-to-segment so that even
   * perfectly horizontal or perfectly vertical lines (height / width == 0)
   * are clickable.  Pencil strokes check every segment.
   */
  const hitTestElement = useCallback(
    (el: CanvasElement, pos: Point): boolean => {
      const tol = 10 / zoom; // tolerance in canvas-space pixels

      if (el.type === 'line' || el.type === 'arrow') {
        if (el.points && el.points.length >= 2) {
          const p1 = { x: el.x + el.points[0].x, y: el.y + el.points[0].y };
          const p2 = {
            x: el.x + el.points[el.points.length - 1].x,
            y: el.y + el.points[el.points.length - 1].y,
          };
          return distanceToSegment(pos, p1, p2) <= tol;
        }
        // Fallback when points not set yet
        return distanceToSegment(pos, { x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height }) <= tol;
      }

      if (el.type === 'pencil') {
        if (el.points && el.points.length >= 2) {
          for (let i = 0; i < el.points.length - 1; i++) {
            const p1 = { x: el.x + el.points[i].x, y: el.y + el.points[i].y };
            const p2 = { x: el.x + el.points[i + 1].x, y: el.y + el.points[i + 1].y };
            if (distanceToSegment(pos, p1, p2) <= tol) return true;
          }
          return false;
        }
      }

      // Bounding box (with tolerance) for shapes, images, text, sticky
      return (
        pos.x >= el.x - tol &&
        pos.x <= el.x + el.width + tol &&
        pos.y >= el.y - tol &&
        pos.y <= el.y + el.height + tol
      );
    },
    [zoom]
  );

  // ─── Anchor / snap helpers ──────────────────────────────────────────────────

  const getElementAnchors = (el: CanvasElement): { anchor: AnchorPosition; point: Point }[] => {
    const { x, y, width, height } = el;
    return [
      { anchor: 'top', point: { x: x + width / 2, y } },
      { anchor: 'right', point: { x: x + width, y: y + height / 2 } },
      { anchor: 'bottom', point: { x: x + width / 2, y: y + height } },
      { anchor: 'left', point: { x, y: y + height / 2 } },
    ];
  };

  const findClosestAnchor = (pos: Point, ignoreElementId?: string): SnapAnchor | null => {
    const snapDistance = 24 / zoom;
    let closest: SnapAnchor | null = null;
    let minDistance = snapDistance;

    elements.forEach((el) => {
      if (el.id === ignoreElementId || el.type === 'arrow' || el.type === 'line' || el.type === 'pencil') return;
      const anchors = getElementAnchors(el);
      anchors.forEach(({ anchor, point }) => {
        const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
        if (dist < minDistance) {
          minDistance = dist;
          closest = { elementId: el.id, anchor, point };
        }
      });
    });

    return closest;
  };

  // ─── Resize handle detection ─────────────────────────────────────────────────

  const getHandleAtPosition = (pos: Point, el: CanvasElement): ResizeHandle => {
    const handleSize = 12 / zoom;
    const { x, y, width, height } = el;

    const rotateY = y - 20 / zoom;
    const rotateX = x + width / 2;
    if (Math.hypot(pos.x - rotateX, pos.y - rotateY) <= handleSize) return 'rotate';

    if (Math.hypot(pos.x - x, pos.y - y) <= handleSize) return 'nw';
    if (Math.hypot(pos.x - (x + width), pos.y - y) <= handleSize) return 'ne';
    if (Math.hypot(pos.x - (x + width), pos.y - (y + height)) <= handleSize) return 'se';
    if (Math.hypot(pos.x - x, pos.y - (y + height)) <= handleSize) return 'sw';

    return null;
  };

  // ─── Canvas renderer ─────────────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = bgColor || '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (gridType === 'dots') {
      ctx.fillStyle = '#e5e7eb';
      const gap = 24 * zoom;
      const startX = panOffset.x % gap;
      const startY = panOffset.y % gap;
      for (let x = startX; x < canvas.width; x += gap) {
        for (let y = startY; y < canvas.height; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5 * zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (gridType === 'lines') {
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      const gap = 24 * zoom;
      const startX = panOffset.x % gap;
      const startY = panOffset.y % gap;
      ctx.beginPath();
      for (let x = startX; x < canvas.width; x += gap) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = startY; y < canvas.height; y += gap) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    // Pan / zoom transform for all elements
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const sorted = [...elements, ...(currentElement ? [currentElement] : [])].sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((el) => {
      if (el.type === 'sticky') return; // DOM overlay
      if (el.type === 'text' && editingText && editingText.id === el.id) return; // hidden while editing

      ctx.save();
      ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;
      ctx.strokeStyle = el.strokeColor || '#1e293b';
      ctx.fillStyle = el.fillColor || 'transparent';
      ctx.lineWidth = el.strokeWidth || 2;

      if (el.strokeStyle === 'dashed') ctx.setLineDash([8, 6]);
      else if (el.strokeStyle === 'dotted') ctx.setLineDash([3, 4]);
      else ctx.setLineDash([]);

      switch (el.type) {
        case 'rectangle': {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, 8);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
          if (el.text) {
            ctx.font = `${el.fontSize || 18}px '${el.fontFamily || 'Architects Daughter'}', cursive, sans-serif`;
            ctx.fillStyle = el.strokeColor || '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.text, el.x + el.width / 2, el.y + el.height / 2);
          }
          break;
        }
        case 'ellipse': {
          ctx.beginPath();
          ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, Math.abs(el.width / 2), Math.abs(el.height / 2), 0, 0, 2 * Math.PI);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
          if (el.text) {
            ctx.font = `${el.fontSize || 18}px '${el.fontFamily || 'Architects Daughter'}', cursive, sans-serif`;
            ctx.fillStyle = el.strokeColor || '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.text, el.x + el.width / 2, el.y + el.height / 2);
          }
          break;
        }
        case 'diamond': {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx, el.y);
          ctx.lineTo(el.x + el.width, cy);
          ctx.lineTo(cx, el.y + el.height);
          ctx.lineTo(el.x, cy);
          ctx.closePath();
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
          if (el.text) {
            ctx.font = `${el.fontSize || 18}px '${el.fontFamily || 'Architects Daughter'}', cursive, sans-serif`;
            ctx.fillStyle = el.strokeColor || '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.text, cx, cy);
          }
          break;
        }
        case 'image': {
          if (el.imageUrl) {
            let cached = imageCache[el.imageUrl];
            if (!cached) {
              cached = new Image();
              cached.src = el.imageUrl;
              cached.onload = () => renderCanvas();
              imageCache[el.imageUrl] = cached;
            }
            if (cached.complete && cached.naturalWidth > 0) {
              ctx.drawImage(cached, el.x, el.y, el.width, el.height);
            }
          }
          break;
        }
        case 'line':
        case 'arrow': {
          if (el.points && el.points.length >= 2) {
            const p1 = el.points[0];
            const p2 = el.points[el.points.length - 1];
            ctx.beginPath();
            ctx.moveTo(el.x + p1.x, el.y + p1.y);
            ctx.lineTo(el.x + p2.x, el.y + p2.y);
            ctx.stroke();

            if (el.type === 'arrow') {
              const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
              const headLen = 14;
              ctx.setLineDash([]);
              ctx.fillStyle = el.strokeColor;
              ctx.beginPath();
              ctx.moveTo(el.x + p2.x, el.y + p2.y);
              ctx.lineTo(el.x + p2.x - headLen * Math.cos(angle - Math.PI / 6), el.y + p2.y - headLen * Math.sin(angle - Math.PI / 6));
              ctx.lineTo(el.x + p2.x - headLen * Math.cos(angle + Math.PI / 6), el.y + p2.y - headLen * Math.sin(angle + Math.PI / 6));
              ctx.closePath();
              ctx.fill();
            }

            if (el.boundEndElementId) {
              ctx.beginPath();
              ctx.arc(el.x + p2.x, el.y + p2.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#3b82f6';
              ctx.fill();
            }
          }
          break;
        }
        case 'pencil': {
          if (el.points && el.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.x + el.points[i].x, el.y + el.points[i].y);
            }
            ctx.stroke();
          }
          break;
        }
        case 'text': {
          ctx.font = `${el.fontSize || 22}px '${el.fontFamily || 'Architects Daughter'}', cursive, sans-serif`;
          ctx.fillStyle = el.strokeColor || '#1e293b';
          ctx.textBaseline = 'top';
          ctx.setLineDash([]);
          ctx.fillText(el.text || '', el.x, el.y);
          break;
        }
      }

      // Selection box & handles
      const isThisSelected = selectedId === el.id || selectedIds.includes(el.id);
      if (isThisSelected && !editingText && !isBoardLocked) {
        const pad = 4 / zoom;
        let boxX: number, boxY: number, boxW: number, boxH: number;

        if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
          const p1 = { x: el.x + el.points[0].x, y: el.y + el.points[0].y };
          const p2 = { x: el.x + el.points[el.points.length - 1].x, y: el.y + el.points[el.points.length - 1].y };
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          boxX = minX - pad;
          boxY = minY - pad;
          boxW = Math.abs(p2.x - p1.x) + pad * 2;
          boxH = Math.abs(p2.y - p1.y) + pad * 2;
          // Ensure minimum visible box
          if (boxW < 10 / zoom) { boxX -= 5 / zoom; boxW = 10 / zoom; }
          if (boxH < 10 / zoom) { boxY -= 5 / zoom; boxH = 10 / zoom; }
        } else {
          boxX = el.x - pad;
          boxY = el.y - pad;
          boxW = el.width + pad * 2;
          boxH = el.height + pad * 2;
        }

        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Corner handles – only for single selection, not lines/arrows/pencil
        const showHandles = selectedId === el.id && selectedIds.length <= 1 && el.type !== 'line' && el.type !== 'arrow' && el.type !== 'pencil';
        if (showHandles) {
          const hr = 4.5 / zoom;
          const corners = [
            { x: boxX, y: boxY },
            { x: boxX + boxW, y: boxY },
            { x: boxX + boxW, y: boxY + boxH },
            { x: boxX, y: boxY + boxH },
          ];
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5 / zoom;
          corners.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, hr, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });

          // Rotation handle
          const rotX = boxX + boxW / 2;
          const rotY = boxY - 18 / zoom;
          ctx.beginPath();
          ctx.moveTo(rotX, boxY);
          ctx.lineTo(rotX, rotY);
          ctx.strokeStyle = '#818cf8';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(rotX, rotY, hr, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#6366f1';
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // Snap anchor dot
    if (activeSnapAnchor) {
      ctx.beginPath();
      ctx.arc(activeSnapAnchor.point.x, activeSnapAnchor.point.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
    }

    // Rubber-band selection rectangle
    if (rubberBandBox) {
      const rx = Math.min(rubberBandBox.x1, rubberBandBox.x2);
      const ry = Math.min(rubberBandBox.y1, rubberBandBox.y2);
      const rw = Math.abs(rubberBandBox.x2 - rubberBandBox.x1);
      const rh = Math.abs(rubberBandBox.y2 - rubberBandBox.y1);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.07)';
      ctx.setLineDash([]);
      ctx.fillRect(rx, ry, rw, rh);
    }

    ctx.restore();
  }, [elements, zoom, panOffset, selectedId, selectedIds, currentElement, bgColor, gridType, editingText, activeSnapAnchor, isBoardLocked, rubberBandBox]);

  // Canvas resize observer
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        renderCanvas();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Paste image via Ctrl+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isBoardLocked) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file && onInsertImage) {
            onInsertImage(file, { x: 300 - panOffset.x / zoom, y: 250 - panOffset.y / zoom });
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isBoardLocked, onInsertImage, panOffset, zoom]);

  // ─── Mouse Events ─────────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingText) {
      commitText();
      if (activeTool !== 'text') return;
    }

    // Middle-button or Hand tool → pan
    if (e.button === 1 || activeTool === 'hand') {
      setIsPanning(true);
      setStartPoint({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (isBoardLocked) return;

    const pos = getCanvasCoords(e);

    // ── Resize handle check (single, non-line selection) ──────────────────────
    if (selectedId && selectedIds.length <= 1) {
      const sel = elements.find((el) => el.id === selectedId);
      if (sel && sel.type !== 'line' && sel.type !== 'arrow' && sel.type !== 'pencil') {
        const handle = getHandleAtPosition(pos, sel);
        if (handle) {
          setActiveResizeHandle(handle);
          setStartPoint(pos);
          setInitialResizeBox({ x: sel.x, y: sel.y, width: sel.width, height: sel.height });
          return;
        }
      }
    }

    // ── Text tool ─────────────────────────────────────────────────────────────
    if (activeTool === 'text') {
      const newTextId = `text_${Date.now()}`;
      setEditingText({
        id: newTextId,
        x: pos.x,
        y: pos.y,
        text: '',
        fontSize: 24,
        fontFamily: 'Architects Daughter',
        strokeColor: '#1e293b',
        isNew: true,
      });
      return;
    }

    // ── Select tool ───────────────────────────────────────────────────────────
    if (activeTool === 'select') {
      // Click inside existing multi-selection → start group drag
      if (selectedIds.length > 1) {
        const inGroup = elements.find((el) => selectedIds.includes(el.id) && hitTestElement(el, pos));
        if (inGroup) {
          setIsDraggingGroup(true);
          setGroupDragStart(pos);
          setGroupStartPositions(
            elements.filter((el) => selectedIds.includes(el.id)).map((el) => ({ id: el.id, x: el.x, y: el.y }))
          );
          return;
        }
      }

      const clicked = [...elements].reverse().find((el) => hitTestElement(el, pos));

      if (clicked) {
        if (e.shiftKey) {
          // Shift-click: toggle element in/out of selection
          const newIds = selectedIds.includes(clicked.id)
            ? selectedIds.filter((id) => id !== clicked.id)
            : [...selectedIds, clicked.id];
          setSelectedIds(newIds);
          onSelectElement(newIds.length === 1 ? newIds[0] : null);
        } else {
          onSelectElement(clicked.id);
          setSelectedIds([clicked.id]);
          setIsDraggingElement(true);
          setDragOffset({ x: pos.x - clicked.x, y: pos.y - clicked.y });
        }
      } else {
        // Empty space → start rubber-band selection
        onSelectElement(null);
        setSelectedIds([]);
        setIsRubberBanding(true);
        setRubberBandBox({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        setStartPoint(pos);
      }
      return;
    }

    // ── Eraser tool ───────────────────────────────────────────────────────────
    if (activeTool === 'eraser') {
      setIsEraserActive(true);
      const clicked = [...elements].reverse().find((el) => hitTestElement(el, pos));
      if (clicked) {
        onUpdateElements(elements.filter((el) => el.id !== clicked.id));
        if (selectedId === clicked.id) onSelectElement(null);
        setSelectedIds((prev) => prev.filter((id) => id !== clicked.id));
      }
      return;
    }

    // ── Drawing tools ─────────────────────────────────────────────────────────
    setIsDrawing(true);
    setStartPoint(pos);

    let boundStartId: string | undefined;
    let boundStartAnchor: AnchorPosition | undefined;
    if (activeTool === 'arrow' || activeTool === 'line') {
      const snap = findClosestAnchor(pos);
      if (snap) { boundStartId = snap.elementId; boundStartAnchor = snap.anchor; }
    }

    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEl: CanvasElement = {
      id,
      type: activeTool,
      x: pos.x,
      y: pos.y,
      width: activeTool === 'sticky' ? 280 : 0,
      height: activeTool === 'sticky' ? 280 : 0,
      points: activeTool === 'pencil' || activeTool === 'line' || activeTool === 'arrow' ? [{ x: 0, y: 0 }] : undefined,
      strokeColor: activeTool === 'sticky' ? '#333333' : '#1e1e1e',
      fillColor: activeTool === 'sticky' ? '#ffeaa7' : 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: activeTool === 'sticky' ? 'Caveat' : 'Architects Daughter',
      fontSize: activeTool === 'sticky' ? 26 : 22,
      stickyBg: activeTool === 'sticky' ? '#ffeaa7' : undefined,
      stickyRotation: activeTool === 'sticky' ? -0.5 : 0,
      stickyTape: true,
      text: activeTool === 'sticky' ? 'Double-click to type note...' : undefined,
      zIndex: elements.length + 1,
      boundStartElementId: boundStartId,
      boundStartAnchor,
    };

    if (activeTool === 'sticky') {
      onUpdateElements([...elements, newEl]);
      onSelectElement(newEl.id);
      setSelectedIds([newEl.id]);
      setIsDrawing(false);
      if (onToolComplete) onToolComplete();
    } else {
      setCurrentElement(newEl);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isBoardLocked) return;
    const pos = getCanvasCoords(e);
    const clicked = [...elements].reverse().find((el) => hitTestElement(el, pos));

    if (clicked && (clicked.type === 'text' || clicked.type === 'rectangle' || clicked.type === 'diamond' || clicked.type === 'ellipse')) {
      setEditingText({
        id: clicked.id,
        x: clicked.type === 'text' ? clicked.x : clicked.x + clicked.width / 4,
        y: clicked.type === 'text' ? clicked.y : clicked.y + clicked.height / 3,
        text: clicked.text || '',
        fontSize: clicked.fontSize || 22,
        fontFamily: clicked.fontFamily || 'Architects Daughter',
        strokeColor: clicked.strokeColor || '#1e293b',
        isNew: false,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    if (onMouseMoveCursor) onMouseMoveCursor(pos);

    if (isPanning) {
      setPanOffset({ x: e.clientX - startPoint.x, y: e.clientY - startPoint.y });
      return;
    }

    if (isBoardLocked) return;

    // Continuous erasing while mouse held
    if (isEraserActive && activeTool === 'eraser') {
      const hovered = [...elements].reverse().find((el) => hitTestElement(el, pos));
      if (hovered) {
        onUpdateElements(elements.filter((el) => el.id !== hovered.id));
        if (selectedId === hovered.id) onSelectElement(null);
        setSelectedIds((prev) => prev.filter((id) => id !== hovered.id));
      }
      return;
    }

    // Rubber-band update
    if (isRubberBanding) {
      setRubberBandBox((prev) => (prev ? { ...prev, x2: pos.x, y2: pos.y } : null));
      return;
    }

    // Resize
    if (activeResizeHandle && selectedId && initialResizeBox) {
      const dx = pos.x - startPoint.x;
      const dy = pos.y - startPoint.y;
      let { x: newX, y: newY, width: newW, height: newH } = initialResizeBox;

      if (activeResizeHandle === 'se') { newW = Math.max(20, initialResizeBox.width + dx); newH = Math.max(20, initialResizeBox.height + dy); }
      else if (activeResizeHandle === 'sw') { newX += dx; newW = Math.max(20, initialResizeBox.width - dx); newH = Math.max(20, initialResizeBox.height + dy); }
      else if (activeResizeHandle === 'ne') { newY += dy; newW = Math.max(20, initialResizeBox.width + dx); newH = Math.max(20, initialResizeBox.height - dy); }
      else if (activeResizeHandle === 'nw') { newX += dx; newY += dy; newW = Math.max(20, initialResizeBox.width - dx); newH = Math.max(20, initialResizeBox.height - dy); }

      onUpdateElements(elements.map((el) => (el.id === selectedId ? { ...el, x: newX, y: newY, width: newW, height: newH } : el)));
      return;
    }

    // Group drag
    if (isDraggingGroup && selectedIds.length > 1) {
      const dx = pos.x - groupDragStart.x;
      const dy = pos.y - groupDragStart.y;
      const updated = elements.map((el) => {
        if (!selectedIds.includes(el.id)) return el;
        const start = groupStartPositions.find((s) => s.id === el.id);
        if (!start) return el;
        return { ...el, x: start.x + dx, y: start.y + dy };
      });
      onUpdateElements(updated);
      return;
    }

    // Single element drag
    if (isDraggingElement && selectedId) {
      const newX = pos.x - dragOffset.x;
      const newY = pos.y - dragOffset.y;

      const updated = elements.map((el) => {
        if (el.id === selectedId) return { ...el, x: newX, y: newY };

        // Reconnect bound arrows/lines when a shape they're connected to moves
        if (el.type === 'arrow' || el.type === 'line') {
          let pts = el.points ? [...el.points] : [{ x: 0, y: 0 }, { x: el.width, y: el.height }];
          let changed = false;

          if (el.boundStartElementId === selectedId && el.boundStartAnchor) {
            const movedEl = elements.find((item) => item.id === selectedId);
            if (movedEl) {
              const anchors = getElementAnchors({ ...movedEl, x: newX, y: newY });
              const match = anchors.find((a) => a.anchor === el.boundStartAnchor);
              if (match) { pts[0] = { x: match.point.x - el.x, y: match.point.y - el.y }; changed = true; }
            }
          }
          if (el.boundEndElementId === selectedId && el.boundEndAnchor) {
            const movedEl = elements.find((item) => item.id === selectedId);
            if (movedEl) {
              const anchors = getElementAnchors({ ...movedEl, x: newX, y: newY });
              const match = anchors.find((a) => a.anchor === el.boundEndAnchor);
              if (match) { pts[pts.length - 1] = { x: match.point.x - el.x, y: match.point.y - el.y }; changed = true; }
            }
          }
          if (changed) return { ...el, points: pts };
        }
        return el;
      });
      onUpdateElements(updated);
      return;
    }

    // Drawing
    if (isDrawing && currentElement) {
      if (currentElement.type === 'pencil') {
        const points = [...(currentElement.points || []), { x: pos.x - currentElement.x, y: pos.y - currentElement.y }];
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        setCurrentElement({ ...currentElement, points, width: Math.max(10, Math.max(...xs) - Math.min(...xs)), height: Math.max(10, Math.max(...ys) - Math.min(...ys)) });
      } else if (currentElement.type === 'arrow' || currentElement.type === 'line') {
        const snap = findClosestAnchor(pos);
        setActiveSnapAnchor(snap);
        const target = snap ? snap.point : pos;
        const w = target.x - startPoint.x;
        const h = target.y - startPoint.y;
        setCurrentElement({ ...currentElement, x: startPoint.x, y: startPoint.y, width: w, height: h, points: [{ x: 0, y: 0 }, { x: w, y: h }], boundEndElementId: snap?.elementId, boundEndAnchor: snap?.anchor });
      } else {
        const w = pos.x - startPoint.x;
        const h = pos.y - startPoint.y;
        setCurrentElement({ ...currentElement, x: w < 0 ? pos.x : startPoint.x, y: h < 0 ? pos.y : startPoint.y, width: Math.abs(w), height: Math.abs(h) });
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
    if (isEraserActive) setIsEraserActive(false);
    if (isDraggingElement) setIsDraggingElement(false);
    if (activeResizeHandle) { setActiveResizeHandle(null); setInitialResizeBox(null); }
    if (activeSnapAnchor) setActiveSnapAnchor(null);
    if (isDraggingGroup) { setIsDraggingGroup(false); setGroupStartPositions([]); }

    // Finish rubber-band
    if (isRubberBanding && rubberBandBox) {
      setIsRubberBanding(false);
      const rx1 = Math.min(rubberBandBox.x1, rubberBandBox.x2);
      const ry1 = Math.min(rubberBandBox.y1, rubberBandBox.y2);
      const rx2 = Math.max(rubberBandBox.x1, rubberBandBox.x2);
      const ry2 = Math.max(rubberBandBox.y1, rubberBandBox.y2);

      if (rx2 - rx1 > 5 || ry2 - ry1 > 5) {
        const inBox = elements.filter((el) => {
          if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
            const p1 = { x: el.x + el.points[0].x, y: el.y + el.points[0].y };
            const p2 = { x: el.x + el.points[el.points.length - 1].x, y: el.y + el.points[el.points.length - 1].y };
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            return (
              (p1.x >= rx1 && p1.x <= rx2 && p1.y >= ry1 && p1.y <= ry2) ||
              (p2.x >= rx1 && p2.x <= rx2 && p2.y >= ry1 && p2.y <= ry2) ||
              (mid.x >= rx1 && mid.x <= rx2 && mid.y >= ry1 && mid.y <= ry2)
            );
          }
          return el.x < rx2 && el.x + el.width > rx1 && el.y < ry2 && el.y + el.height > ry1;
        });

        const ids = inBox.map((el) => el.id);
        setSelectedIds(ids);
        if (ids.length === 1) onSelectElement(ids[0]);
        else if (ids.length > 1) onSelectElement(null);
      }
      setRubberBandBox(null);
    }

    if (isDrawing && currentElement) {
      setIsDrawing(false);
      onUpdateElements([...elements, currentElement]);
      onSelectElement(currentElement.id);
      setSelectedIds([currentElement.id]);
      setCurrentElement(null);
      if (onToolComplete) onToolComplete();
    }
  };

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 4.0);
      setPanOffset({
        x: e.clientX - (e.clientX - panOffset.x) * (newZoom / zoom),
        y: e.clientY - (e.clientY - panOffset.y) * (newZoom / zoom),
      });
    } else {
      setPanOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isBoardLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/') && onInsertImage) {
      onInsertImage(file, getCanvasCoords(e));
    }
  };

  // ─── Text commit ──────────────────────────────────────────────────────────────

  const commitText = () => {
    if (!editingText) return;
    const trimmed = editingText.text.trim();

    if (editingText.isNew) {
      if (trimmed) {
        // Measure actual width using canvas 2d context
        let textWidth = Math.max(80, trimmed.length * (editingText.fontSize || 24) * 0.55);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${editingText.fontSize || 24}px '${editingText.fontFamily || 'Architects Daughter'}', cursive, sans-serif`;
            textWidth = Math.max(80, ctx.measureText(trimmed).width + 24);
          }
        }
        const newEl: CanvasElement = {
          id: editingText.id || `text_${Date.now()}`,
          type: 'text',
          x: editingText.x,
          y: editingText.y,
          width: textWidth,
          height: (editingText.fontSize || 24) * 1.5,
          text: trimmed,
          strokeColor: editingText.strokeColor || '#1e293b',
          fillColor: 'transparent',
          fillStyle: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          fontFamily: editingText.fontFamily || 'Architects Daughter',
          fontSize: editingText.fontSize || 24,
          zIndex: elements.length + 1,
        };
        onUpdateElements([...elements, newEl]);
        onSelectElement(newEl.id);
        setSelectedIds([newEl.id]);
      }
    } else if (editingText.id) {
      onUpdateElements(elements.map((el) => (el.id === editingText.id ? { ...el, text: trimmed } : el)));
    }

    setEditingText(null);
    // NOTE: intentionally NOT calling onToolComplete here so the text tool
    // stays active and the user can place another text element immediately.
  };

  // ─── Cursor ───────────────────────────────────────────────────────────────────

  const eraserCursorSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='12' fill='rgba(255,255,255,0.85)' stroke='%23333' stroke-width='2'/%3E%3Cline x1='9' y1='9' x2='19' y2='19' stroke='%23e11d48' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='19' y1='9' x2='9' y2='19' stroke='%23e11d48' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E") 14 14, crosshair`;

  const getCursor = () => {
    if (isBoardLocked) return 'default';
    if (activeTool === 'hand') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'eraser') return eraserCursorSvg;
    if (activeTool === 'text') return 'text';
    if (activeTool === 'select') return isDraggingElement || isDraggingGroup ? 'move' : 'default';
    return 'crosshair';
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: getCursor(),
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Inline text editor */}
      {editingText && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: `${editingText.x * zoom + panOffset.x}px`,
            top: `${editingText.y * zoom + panOffset.y}px`,
            zIndex: 1000,
            transformOrigin: '0 0',
          }}
        >
          <textarea
            ref={textInputRef}
            value={editingText.text}
            onChange={(e) => setEditingText((prev) => (prev ? { ...prev, text: e.target.value } : null))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
              else if (e.key === 'Escape') { commitText(); }
            }}
            onBlur={commitText}
            placeholder="Type text here..."
            style={{
              fontFamily: `'${editingText.fontFamily || 'Architects Daughter'}', cursive, sans-serif`,
              fontSize: `${(editingText.fontSize || 24) * zoom}px`,
              color: editingText.strokeColor || '#1e293b',
              background: 'rgba(255, 255, 255, 0.96)',
              border: '2px dashed #6366f1',
              borderRadius: '6px',
              padding: '6px 12px',
              outline: 'none',
              resize: 'both',
              minWidth: `${140 * zoom}px`,
              minHeight: `${42 * zoom}px`,
              lineHeight: 1.3,
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
            }}
          />
        </div>
      )}

      {/* Sticky Notes DOM Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {elements
          .filter((el) => el.type === 'sticky')
          .map((el) => (
            <div key={el.id} style={{ pointerEvents: isBoardLocked ? 'none' : 'auto' }}>
              <StickyNoteElement
                element={el}
                isSelected={selectedId === el.id || selectedIds.includes(el.id)}
                onSelect={(e) => {
                  e.stopPropagation();
                  if (!isBoardLocked) {
                    if (e.shiftKey) {
                      const newIds = selectedIds.includes(el.id)
                        ? selectedIds.filter((id) => id !== el.id)
                        : [...selectedIds, el.id];
                      setSelectedIds(newIds);
                      onSelectElement(newIds.length === 1 ? newIds[0] : null);
                    } else {
                      onSelectElement(el.id);
                      setSelectedIds([el.id]);
                    }
                  }
                }}
                onUpdateText={(id, text) => {
                  if (isBoardLocked) return;
                  onUpdateElements(elements.map((item) => (item.id === id ? { ...item, text } : item)));
                }}
                onResize={(id, width, height) => {
                  if (isBoardLocked) return;
                  onUpdateElements(elements.map((item) => (item.id === id ? { ...item, width, height } : item)));
                }}
              />
            </div>
          ))}
      </div>

      {/* Multi-select action bar */}
      {selectedIds.length > 1 && !isBoardLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(229, 231, 235, 0.9)',
            borderRadius: '14px',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.12)',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 500,
            fontSize: '0.84rem',
            fontWeight: 600,
            color: '#374151',
            pointerEvents: 'all',
          }}
        >
          <span style={{ color: '#6366f1', fontWeight: 700 }}>
            {selectedIds.length} elements selected
          </span>
          <div style={{ width: '1px', height: '18px', background: '#e5e7eb' }} />
          <button
            onClick={() => {
              onUpdateElements(elements.filter((el) => !selectedIds.includes(el.id)));
              setSelectedIds([]);
              onSelectElement(null);
            }}
            style={{
              background: '#fee2e2',
              border: 'none',
              borderRadius: '7px',
              padding: '5px 12px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              transition: 'all 0.1s ease',
            }}
          >
            🗑 Delete All
          </button>
          <button
            onClick={() => { setSelectedIds([]); onSelectElement(null); }}
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '7px',
              padding: '5px 12px',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            Deselect
          </button>
        </div>
      )}

      {/* Remote Collaborator Live Cursors */}
      {collaborators.map((collab) => {
        if (!collab.cursor) return null;
        const screenX = collab.cursor.x * zoom + panOffset.x;
        const screenY = collab.cursor.y * zoom + panOffset.y;
        return (
          <div
            key={collab.id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'all 0.04s ease-out',
              transform: 'translate(-2px, -2px)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={collab.color || '#6366f1'} stroke="#ffffff" strokeWidth="1.5">
              <path d="M3 3l7 18 3-7 7-3L3 3z" />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 14,
                background: collab.color || '#6366f1',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
            >
              {collab.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
