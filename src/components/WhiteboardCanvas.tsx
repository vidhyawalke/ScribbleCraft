import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasElement, ToolType, Point, Collaborator } from '../types';
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
  collaborators?: Collaborator[];
  onMouseMoveCursor?: (point: Point) => void;
  onToolComplete?: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'rotate' | null;

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
  collaborators = [],
  onMouseMoveCursor,
  onToolComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  
  // Dragging / Resizing
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null);
  const [initialResizeBox, setInitialResizeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Active Inline Text Editor
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

  // Preload google fonts
  useEffect(() => {
    elements.forEach((el) => {
      if (el.fontFamily) loadGoogleFont(el.fontFamily);
    });
  }, [elements]);

  // Focus inline text editor when activated
  useEffect(() => {
    if (editingText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [editingText]);

  const getCanvasCoords = (e: React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  };

  const getHandleAtPosition = (pos: Point, el: CanvasElement): ResizeHandle => {
    const handleSize = 12 / zoom;
    const { x, y, width, height } = el;

    // Top rotation handle
    const rotateY = y - 20 / zoom;
    const rotateX = x + width / 2;
    if (Math.hypot(pos.x - rotateX, pos.y - rotateY) <= handleSize) return 'rotate';

    // Corner handles
    if (Math.hypot(pos.x - x, pos.y - y) <= handleSize) return 'nw';
    if (Math.hypot(pos.x - (x + width), pos.y - y) <= handleSize) return 'ne';
    if (Math.hypot(pos.x - (x + width), pos.y - (y + height)) <= handleSize) return 'se';
    if (Math.hypot(pos.x - x, pos.y - (y + height)) <= handleSize) return 'sw';

    return null;
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Canvas Background
    ctx.fillStyle = bgColor || '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid rendering
    if (gridType === 'dots') {
      ctx.fillStyle = '#e5e7eb';
      const gap = 24 * zoom;
      const startX = (panOffset.x % gap);
      const startY = (panOffset.y % gap);
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
      const startX = (panOffset.x % gap);
      const startY = (panOffset.y % gap);
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

    // Pan & Zoom transform
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const sorted = [...elements, ...(currentElement ? [currentElement] : [])].sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((el) => {
      if (el.type === 'sticky') return; // Handled by DOM component

      // Skip rendering text if currently editing it
      if (el.type === 'text' && editingText && editingText.id === el.id) return;

      ctx.save();
      ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;
      ctx.strokeStyle = el.strokeColor || '#1e293b';
      ctx.fillStyle = el.fillColor || 'transparent';
      ctx.lineWidth = el.strokeWidth || 2;

      if (el.strokeStyle === 'dashed') {
        ctx.setLineDash([8, 6]);
      } else if (el.strokeStyle === 'dotted') {
        ctx.setLineDash([3, 4]);
      } else {
        ctx.setLineDash([]);
      }

      switch (el.type) {
        case 'rectangle': {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, 6);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();

          // Render centered label text inside shape if present
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
          ctx.ellipse(
            el.x + el.width / 2,
            el.y + el.height / 2,
            Math.abs(el.width / 2),
            Math.abs(el.height / 2),
            0,
            0,
            2 * Math.PI
          );
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
              ctx.fillStyle = el.strokeColor;
              ctx.beginPath();
              ctx.moveTo(el.x + p2.x, el.y + p2.y);
              ctx.lineTo(
                el.x + p2.x - headLen * Math.cos(angle - Math.PI / 6),
                el.y + p2.y - headLen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                el.x + p2.x - headLen * Math.cos(angle + Math.PI / 6),
                el.y + p2.y - headLen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
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
          ctx.fillText(el.text || '', el.x, el.y);
          break;
        }
      }

      // Selection bounding box outline and handles (Screenshot 4)
      if (selectedId === el.id && !editingText) {
        const padding = 4 / zoom;
        const boxX = el.x - padding;
        const boxY = el.y - padding;
        const boxW = el.width + padding * 2;
        const boxH = el.height + padding * 2;

        ctx.strokeStyle = '#818cf8'; // Soft lavender/indigo
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // 4 Corner circular handles
        const handleRadius = 4.5 / zoom;
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
          ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Top rotation handle
        const rotX = boxX + boxW / 2;
        const rotY = boxY - 18 / zoom;
        ctx.beginPath();
        ctx.moveTo(rotX, boxY);
        ctx.lineTo(rotX, rotY);
        ctx.strokeStyle = '#818cf8';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rotX, rotY, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6366f1';
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    });

    ctx.restore();
  }, [elements, zoom, panOffset, selectedId, currentElement, bgColor, gridType, editingText]);

  // Resize canvas
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

  // Mouse Down Event
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking outside while text editing, commit text editor first
    if (editingText) {
      commitText();
      if (activeTool !== 'text') {
        return;
      }
    }

    // Middle click or Hand tool initiates panning
    if (e.button === 1 || activeTool === 'hand' || e.spaceKey) {
      setIsPanning(true);
      setStartPoint({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pos = getCanvasCoords(e);

    // Check if clicking resize handles of currently selected element
    if (selectedId) {
      const selectedEl = elements.find((el) => el.id === selectedId);
      if (selectedEl) {
        const handle = getHandleAtPosition(pos, selectedEl);
        if (handle) {
          setActiveResizeHandle(handle);
          setStartPoint(pos);
          setInitialResizeBox({ x: selectedEl.x, y: selectedEl.y, width: selectedEl.width, height: selectedEl.height });
          return;
        }
      }
    }

    // 1. Text Tool: Click anywhere to type immediately!
    if (activeTool === 'text') {
      const newTextId = `text_${Date.now()}`;
      setEditingText({
        id: newTextId,
        x: pos.x,
        y: pos.y,
        text: '',
        fontSize: 22,
        fontFamily: 'Architects Daughter',
        strokeColor: '#1e293b',
        isNew: true,
      });
      return;
    }

    // 2. Select Tool: Select and drag elements
    if (activeTool === 'select') {
      const clicked = [...elements].reverse().find((el) => {
        return (
          pos.x >= el.x &&
          pos.x <= el.x + el.width &&
          pos.y >= el.y &&
          pos.y <= el.y + el.height
        );
      });

      if (clicked) {
        onSelectElement(clicked.id);
        setIsDraggingElement(true);
        setDragOffset({ x: pos.x - clicked.x, y: pos.y - clicked.y });
      } else {
        onSelectElement(null);
      }
      return;
    }

    // 3. Eraser Tool: Delete clicked element
    if (activeTool === 'eraser') {
      const clicked = [...elements].reverse().find((el) => {
        return (
          pos.x >= el.x &&
          pos.x <= el.x + el.width &&
          pos.y >= el.y &&
          pos.y <= el.y + el.height
        );
      });
      if (clicked) {
        onUpdateElements(elements.filter((el) => el.id !== clicked.id));
      }
      return;
    }

    // 4. Drawing Geometric Shapes & Sticky Notes
    setIsDrawing(true);
    setStartPoint(pos);

    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEl: CanvasElement = {
      id,
      type: activeTool,
      x: pos.x,
      y: pos.y,
      width: activeTool === 'sticky' ? 260 : 0,
      height: activeTool === 'sticky' ? 260 : 0,
      points: activeTool === 'pencil' || activeTool === 'line' || activeTool === 'arrow' ? [{ x: 0, y: 0 }] : undefined,
      strokeColor: activeTool === 'sticky' ? '#333333' : '#1e1e1e',
      fillColor: activeTool === 'sticky' ? '#bbebff' : 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: activeTool === 'sticky' ? 'Kalam' : 'Architects Daughter',
      fontSize: activeTool === 'sticky' ? 24 : 22,
      stickyBg: activeTool === 'sticky' ? '#bbebff' : undefined,
      stickyRotation: activeTool === 'sticky' ? (Math.random() * 2 - 1) : 0,
      stickyTape: true,
      text: activeTool === 'sticky' ? 'New Sticky Note 📝' : undefined,
      zIndex: elements.length + 1,
    };

    if (activeTool === 'sticky') {
      onUpdateElements([...elements, newEl]);
      onSelectElement(newEl.id);
      setIsDrawing(false);
      if (onToolComplete) onToolComplete();
    } else {
      setCurrentElement(newEl);
    }
  };

  // Double Click Handler to edit text inside shape or text element
  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    const clicked = [...elements].reverse().find((el) => {
      return (
        pos.x >= el.x &&
        pos.x <= el.x + el.width &&
        pos.y >= el.y &&
        pos.y <= el.y + el.height
      );
    });

    if (clicked) {
      if (clicked.type === 'text' || clicked.type === 'rectangle' || clicked.type === 'diamond' || clicked.type === 'ellipse') {
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
    }
  };

  // Mouse Move Event
  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    if (onMouseMoveCursor) {
      onMouseMoveCursor(pos);
    }

    if (isPanning) {
      setPanOffset({
        x: e.clientX - startPoint.x,
        y: e.clientY - startPoint.y,
      });
      return;
    }

    // Resizing selected element
    if (activeResizeHandle && selectedId && initialResizeBox) {
      const dx = pos.x - startPoint.x;
      const dy = pos.y - startPoint.y;

      let newX = initialResizeBox.x;
      let newY = initialResizeBox.y;
      let newW = initialResizeBox.width;
      let newH = initialResizeBox.height;

      if (activeResizeHandle === 'se') {
        newW = Math.max(20, initialResizeBox.width + dx);
        newH = Math.max(20, initialResizeBox.height + dy);
      } else if (activeResizeHandle === 'sw') {
        newX = initialResizeBox.x + dx;
        newW = Math.max(20, initialResizeBox.width - dx);
        newH = Math.max(20, initialResizeBox.height + dy);
      } else if (activeResizeHandle === 'ne') {
        newY = initialResizeBox.y + dy;
        newW = Math.max(20, initialResizeBox.width + dx);
        newH = Math.max(20, initialResizeBox.height - dy);
      } else if (activeResizeHandle === 'nw') {
        newX = initialResizeBox.x + dx;
        newY = initialResizeBox.y + dy;
        newW = Math.max(20, initialResizeBox.width - dx);
        newH = Math.max(20, initialResizeBox.height - dy);
      }

      onUpdateElements(
        elements.map((el) => (el.id === selectedId ? { ...el, x: newX, y: newY, width: newW, height: newH } : el))
      );
      return;
    }

    // Dragging selected element
    if (isDraggingElement && selectedId) {
      const updated = elements.map((el) => {
        if (el.id === selectedId) {
          return {
            ...el,
            x: pos.x - dragOffset.x,
            y: pos.y - dragOffset.y,
          };
        }
        return el;
      });
      onUpdateElements(updated);
      return;
    }

    // Drawing new shape/stroke
    if (isDrawing && currentElement) {
      if (currentElement.type === 'pencil') {
        const points = [...(currentElement.points || []), { x: pos.x - currentElement.x, y: pos.y - currentElement.y }];
        const minX = Math.min(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxX = Math.max(...points.map((p) => p.x));
        const maxY = Math.max(...points.map((p) => p.y));

        setCurrentElement({
          ...currentElement,
          points,
          width: maxX - minX || 10,
          height: maxY - minY || 10,
        });
      } else {
        const width = pos.x - startPoint.x;
        const height = pos.y - startPoint.y;
        setCurrentElement({
          ...currentElement,
          x: width < 0 ? pos.x : startPoint.x,
          y: height < 0 ? pos.y : startPoint.y,
          width: Math.abs(width),
          height: Math.abs(height),
          points: currentElement.type === 'arrow' || currentElement.type === 'line' 
            ? [{ x: 0, y: 0 }, { x: width, y: height }] 
            : undefined,
        });
      }
    }
  };

  // Mouse Up Event
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDraggingElement) {
      setIsDraggingElement(false);
    }
    if (activeResizeHandle) {
      setActiveResizeHandle(null);
      setInitialResizeBox(null);
    }
    if (isDrawing && currentElement) {
      setIsDrawing(false);
      onUpdateElements([...elements, currentElement]);
      onSelectElement(currentElement.id);
      setCurrentElement(null);
      if (onToolComplete) onToolComplete();
    }
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 4.0);
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      setPanOffset({
        x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom),
        y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom),
      });
      // setZoom in parent
    } else {
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Commit Inline Text Editor
  const commitText = () => {
    if (!editingText) return;
    const trimmed = editingText.text.trim();

    if (editingText.isNew) {
      if (trimmed) {
        const textWidth = Math.max(100, trimmed.length * 12);
        const newTextEl: CanvasElement = {
          id: editingText.id || `text_${Date.now()}`,
          type: 'text',
          x: editingText.x,
          y: editingText.y,
          width: textWidth,
          height: 36,
          text: trimmed,
          strokeColor: editingText.strokeColor || '#1e293b',
          fillColor: 'transparent',
          fillStyle: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          fontFamily: editingText.fontFamily || 'Architects Daughter',
          fontSize: editingText.fontSize || 22,
          zIndex: elements.length + 1,
        };
        onUpdateElements([...elements, newTextEl]);
        onSelectElement(newTextEl.id);
      }
    } else if (editingText.id) {
      onUpdateElements(
        elements.map((el) => {
          if (el.id === editingText.id) {
            return {
              ...el,
              text: trimmed,
            };
          }
          return el;
        })
      );
    }

    setEditingText(null);
    if (onToolComplete) onToolComplete();
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: activeTool === 'hand' 
          ? (isPanning ? 'grabbing' : 'grab') 
          : activeTool === 'text'
          ? 'text'
          : activeTool === 'select' 
          ? 'default' 
          : 'crosshair',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Inline Live Text Editor (Typing immediately anywhere on canvas) */}
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
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitText();
              } else if (e.key === 'Escape') {
                commitText();
              }
            }}
            onBlur={commitText}
            placeholder="Type text here..."
            style={{
              fontFamily: `'${editingText.fontFamily || 'Architects Daughter'}', cursive, sans-serif`,
              fontSize: `${(editingText.fontSize || 22) * zoom}px`,
              color: editingText.strokeColor || '#1e293b',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '2px dashed #6366f1',
              borderRadius: '6px',
              padding: '6px 10px',
              outline: 'none',
              resize: 'both',
              minWidth: `${140 * zoom}px`,
              minHeight: `${40 * zoom}px`,
              lineHeight: 1.3,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
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
            <div key={el.id} style={{ pointerEvents: 'auto' }}>
              <StickyNoteElement
                element={el}
                isSelected={selectedId === el.id}
                onSelect={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id);
                }}
                onUpdateText={(id, text) => {
                  const updated = elements.map((item) => (item.id === id ? { ...item, text } : item));
                  onUpdateElements(updated);
                }}
              />
            </div>
          ))}
      </div>

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
