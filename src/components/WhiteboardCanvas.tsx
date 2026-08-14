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
}

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Preload google fonts for any text elements
  useEffect(() => {
    elements.forEach((el) => {
      if (el.fontFamily) loadGoogleFont(el.fontFamily);
    });
  }, [elements]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Canvas Background
    ctx.fillStyle = bgColor || '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render Grid
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
    }

    // Apply Pan & Zoom transform for main canvas drawing
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Render all elements except DOM overlay sticky notes
    const sorted = [...elements, ...(currentElement ? [currentElement] : [])].sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((el) => {
      if (el.type === 'sticky') return; // Rendered via DOM component overlay

      ctx.save();
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
          if (el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
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
          if (el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
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
          if (el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
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

            // Arrowhead
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
          ctx.fillText(el.text || 'Text', el.x, el.y);
          break;
        }
      }

      // Selection bounding box outline for canvas shapes
      if (selectedId === el.id) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [elements, zoom, panOffset, selectedId, currentElement, bgColor, gridType]);

  // Handle Resize canvas element
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

  // Re-render canvas whenever renderCanvas changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasCoords = (e: React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'hand') {
      setIsPanning(true);
      setStartPoint({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pos = getCanvasCoords(e);

    if (activeTool === 'select') {
      // Find clicked element (reverse order for top-most)
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

    // Start Drawing New Element
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
      strokeColor: activeTool === 'sticky' ? '#333333' : '#1e293b',
      fillColor: activeTool === 'sticky' ? '#bbebff' : 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: activeTool === 'sticky' ? 'Kalam' : 'Architects Daughter',
      fontSize: activeTool === 'sticky' ? 24 : 22,
      stickyBg: activeTool === 'sticky' ? '#bbebff' : undefined,
      stickyRotation: activeTool === 'sticky' ? (Math.random() * 2 - 1) : 0,
      stickyTape: true,
      text: activeTool === 'sticky' ? 'New Sticky Note 📝' : activeTool === 'text' ? 'Type text...' : undefined,
      zIndex: elements.length + 1,
    };

    if (activeTool === 'sticky') {
      onUpdateElements([...elements, newEl]);
      onSelectElement(newEl.id);
      setIsDrawing(false);
    } else {
      setCurrentElement(newEl);
    }
  };

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

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDraggingElement) {
      setIsDraggingElement(false);
    }
    if (isDrawing && currentElement) {
      setIsDrawing(false);
      onUpdateElements([...elements, currentElement]);
      onSelectElement(currentElement.id);
      setCurrentElement(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 4.0);
      // Zoom centered at cursor position
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      setPanOffset({
        x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom),
        y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom),
      });
      setZoom(newZoom);
    } else {
      // Pan
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: activeTool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : activeTool === 'select' ? 'default' : 'crosshair',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Render Sticky Notes as rich interactive DOM overlays positioned with Zoom & Pan */}
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

      {/* Render Remote Collaborator Live Cursors */}
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
