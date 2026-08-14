import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasElement } from '../types';
import { loadGoogleFont } from '../utils/googleFonts';

interface StickyNoteElementProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdateText: (id: string, newText: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
}

export const StickyNoteSvgDefs: React.FC = () => null;

export const StickyNoteElement: React.FC<StickyNoteElementProps> = ({
  element,
  isSelected,
  onSelect,
  onUpdateText,
  onResize,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(element.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize drag state (lives in DOM event listeners to avoid canvas interference)
  const resizingRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const fontFamily = element.fontFamily || 'Caveat';
  const fontSize = element.fontSize || 26;
  const rotation = element.stickyRotation ?? 0;
  const bgColor = element.stickyBg || element.fillColor || '#ffeaa7';

  const getFilterStyle = () => {
    if (bgColor.includes('#ffb8b8') || bgColor.includes('pink') || bgColor.includes('#fee2e2'))
      return 'hue-rotate(320deg) saturate(1.2)';
    if (bgColor.includes('#bbebff') || bgColor.includes('blue') || bgColor.includes('#e0f2fe'))
      return 'hue-rotate(180deg) saturate(1.3)';
    if (bgColor.includes('#c7f9cc') || bgColor.includes('green') || bgColor.includes('#dcfce7'))
      return 'hue-rotate(85deg) saturate(1.3)';
    if (bgColor.includes('#e2d4f9') || bgColor.includes('purple'))
      return 'hue-rotate(240deg) saturate(1.2)';
    return 'none';
  };

  useEffect(() => { loadGoogleFont(fontFamily); }, [fontFamily]);
  useEffect(() => { setText(element.text || ''); }, [element.text]);
  useEffect(() => { if (isEditing && textareaRef.current) textareaRef.current.focus(); }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    onUpdateText(element.id, text);
  };

  // ─── Resize via native DOM events (so it works outside the React canvas) ─────

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: element.width || 280,
      startH: element.height || 280,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current || !onResize) return;
      const { handle: h, startX, startY, startW, startH } = resizingRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (h === 'se') { newW = Math.max(120, startW + dx); newH = Math.max(120, startH + dy); }
      else if (h === 'sw') { newW = Math.max(120, startW - dx); newH = Math.max(120, startH + dy); }
      else if (h === 'ne') { newW = Math.max(120, startW + dx); newH = Math.max(120, startH - dy); }
      else if (h === 'nw') { newW = Math.max(120, startW - dx); newH = Math.max(120, startH - dy); }
      else if (h === 's') { newH = Math.max(120, startH + dy); }
      else if (h === 'e') { newW = Math.max(120, startW + dx); }

      onResize(element.id, newW, newH);
    };

    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [element.id, element.width, element.height, onResize]);

  // ─── Resize handle style ──────────────────────────────────────────────────────

  const handleBase: React.CSSProperties = {
    position: 'absolute',
    width: '13px',
    height: '13px',
    background: '#ffffff',
    border: '2px solid #6366f1',
    borderRadius: '50%',
    zIndex: 20,
    boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
    // Show handles only when selected
    opacity: isSelected ? 1 : 0,
    pointerEvents: isSelected ? 'auto' : 'none',
    transition: 'opacity 0.15s ease',
  };

  return (
    <div
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className="sticky-container"
      style={{
        position: 'absolute',
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width || 280}px`,
        height: `${element.height || 280}px`,
        transform: `rotate(${rotation}deg)`,
        zIndex: element.zIndex,
        outline: isSelected ? '2px solid #6366f1' : 'none',
        outlineOffset: '4px',
        borderRadius: '8px',
        cursor: 'move',
        userSelect: 'none',
      }}
    >
      {/* ── Resize Handles ─────────────────────────────────────────────────── */}

      {/* Corners */}
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
        title="Resize" style={{ ...handleBase, top: '-7px', left: '-7px', cursor: 'nw-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
        title="Resize" style={{ ...handleBase, top: '-7px', right: '-7px', cursor: 'ne-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
        title="Resize" style={{ ...handleBase, bottom: '-7px', right: '-7px', cursor: 'se-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
        title="Resize" style={{ ...handleBase, bottom: '-7px', left: '-7px', cursor: 'sw-resize' }} />

      {/* Edge midpoints */}
      <div onMouseDown={(e) => handleResizeMouseDown(e, 's')}
        title="Resize height" style={{ ...handleBase, bottom: '-7px', left: '50%', marginLeft: '-6.5px', cursor: 's-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
        title="Resize width" style={{ ...handleBase, top: '50%', right: '-7px', marginTop: '-6.5px', cursor: 'e-resize' }} />

      {/* ── Background Image ──────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/sticky_note.png')",
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          filter: getFilterStyle(),
          pointerEvents: 'none',
        }}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px 28px 40px 24px',
          boxSizing: 'border-box',
          fontFamily: `'${fontFamily}', cursive, sans-serif`,
          fontSize: `${fontSize}px`,
          lineHeight: 1.35,
          color: '#1a1a1a',
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') handleBlur();
            }}
            placeholder="Type sticky note..."
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: `'${fontFamily}', cursive, sans-serif`,
              fontSize: `${fontSize}px`,
              lineHeight: 1.35,
              color: '#1a1a1a',
              textAlign: 'center',
              cursor: 'text',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {text || 'Double-click to type...'}
          </div>
        )}
      </div>
    </div>
  );
};
