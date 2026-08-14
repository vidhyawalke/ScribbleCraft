import React, { useState, useEffect, useRef } from 'react';
import { CanvasElement } from '../types';
import { loadGoogleFont } from '../utils/googleFonts';

interface StickyNoteElementProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdateText: (id: string, newText: string) => void;
}

export const StickyNoteSvgDefs: React.FC = () => (
  <div className="svg-defs-container">
    <svg width="0" height="0">
      <defs>
        <clipPath id="stickyClip" clipPathUnits="objectBoundingBox">
          <path
            d="M 0 0 Q 0 0.69, 0.03 0.96 0.03 0.96, 1 0.96 Q 0.96 0.69, 0.96 0 0.96 0, 0 0"
            strokeLinejoin="round"
            strokeLinecap="square"
          />
        </clipPath>
      </defs>
    </svg>
  </div>
);

export const StickyNoteElement: React.FC<StickyNoteElementProps> = ({
  element,
  isSelected,
  onSelect,
  onUpdateText,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(element.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontFamily = element.fontFamily || 'Kalam';
  const fontSize = element.fontSize || 24;
  const rotation = element.stickyRotation ?? 0;
  const bgColor = element.stickyBg || element.fillColor || '#bbebff';

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
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${rotation}deg)`,
        zIndex: element.zIndex,
        outline: isSelected ? '2px solid #4f46e5' : 'none',
        outlineOffset: '6px',
        borderRadius: '4px',
        cursor: 'move',
      }}
    >
      <div className="sticky-outer">
        <div className="sticky-wrapper">
          {/* Subtle Paper Tape */}
          {element.stickyTape !== false && <div className="sticky-tape" />}

          {/* Sticky Note Clipped Body */}
          <div
            className="sticky-content-box"
            style={{
              background: `linear-gradient(180deg, ${bgColor} 0%, ${bgColor} 70%, rgba(0,0,0,0.06) 100%)`,
              fontFamily: `'${fontFamily}', cursive`,
              fontSize: `${fontSize}px`,
            }}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                className="sticky-content-textarea"
                style={{
                  fontFamily: `'${fontFamily}', cursive`,
                  fontSize: `${fontSize}px`,
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                {text || 'Double-click to type note...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
