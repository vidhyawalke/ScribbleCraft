import React, { useState, useEffect, useRef } from 'react';
import { CanvasElement } from '../types';
import { loadGoogleFont } from '../utils/googleFonts';

interface StickyNoteElementProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdateText: (id: string, newText: string) => void;
}

export const StickyNoteSvgDefs: React.FC = () => null;

export const StickyNoteElement: React.FC<StickyNoteElementProps> = ({
  element,
  isSelected,
  onSelect,
  onUpdateText,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(element.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontFamily = element.fontFamily || 'Caveat';
  const fontSize = element.fontSize || 26;
  const rotation = element.stickyRotation ?? 0;
  const bgColor = element.stickyBg || element.fillColor || '#ffeaa7';

  // Calculate filter tint based on color if not default yellow
  const getFilterStyle = () => {
    if (bgColor.includes('#ffb8b8') || bgColor.includes('pink') || bgColor.includes('#fee2e2')) {
      return 'hue-rotate(320deg) saturate(1.2)';
    }
    if (bgColor.includes('#bbebff') || bgColor.includes('blue') || bgColor.includes('#e0f2fe')) {
      return 'hue-rotate(180deg) saturate(1.3)';
    }
    if (bgColor.includes('#c7f9cc') || bgColor.includes('green') || bgColor.includes('#dcfce7')) {
      return 'hue-rotate(85deg) saturate(1.3)';
    }
    if (bgColor.includes('#e2d4f9') || bgColor.includes('purple')) {
      return 'hue-rotate(240deg) saturate(1.2)';
    }
    return 'none'; // Default yellow
  };

  useEffect(() => {
    loadGoogleFont(fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    setText(element.text || '');
  }, [element.text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    onUpdateText(element.id, text);
  };

  return (
    <div
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
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
      {/* Real Curled Sticky Note Image Background */}
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

      {/* Sticky Note Content Container */}
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
              if (e.key === 'Escape') {
                handleBlur();
              }
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
