import React, { useRef } from 'react';
import { 
  Lock,
  Unlock,
  Hand, 
  MousePointer, 
  Square, 
  Diamond, 
  Circle, 
  ArrowRight, 
  Minus, 
  Pencil, 
  Type, 
  Image as ImageIcon,
  StickyNote, 
  Eraser
} from 'lucide-react';
import { ToolType } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isBoardLocked: boolean;
  onToggleBoardLock: () => void;
  onInsertImage: (file: File) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isBoardLocked,
  onToggleBoardLock,
  onInsertImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainTools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'hand', label: 'Pan / Hand tool (H or hold Space)', icon: <Hand size={17} />, shortcut: '' },
    { id: 'select', label: 'Selection tool (1 / V)', icon: <MousePointer size={17} />, shortcut: '1' },
    { id: 'rectangle', label: 'Rectangle (2 / R)', icon: <Square size={17} />, shortcut: '2' },
    { id: 'diamond', label: 'Diamond (3 / D)', icon: <Diamond size={17} />, shortcut: '3' },
    { id: 'ellipse', label: 'Ellipse / Circle (4 / O)', icon: <Circle size={17} />, shortcut: '4' },
    { id: 'arrow', label: 'Arrow (5 / A)', icon: <ArrowRight size={17} />, shortcut: '5' },
    { id: 'line', label: 'Line (6 / L)', icon: <Minus size={17} />, shortcut: '6' },
    { id: 'pencil', label: 'Pencil / Draw (7 / P)', icon: <Pencil size={17} />, shortcut: '7' },
    { id: 'text', label: 'Text tool (8 / T)', icon: <Type size={17} />, shortcut: '8' },
    { id: 'image', label: 'Image tool (9 / I)', icon: <ImageIcon size={17} />, shortcut: '9' },
    { id: 'sticky', label: 'Sticky Note (S)', icon: <StickyNote size={17} />, shortcut: '0' },
    { id: 'eraser', label: 'Eraser tool (0 / E)', icon: <Eraser size={17} />, shortcut: 'E' },
  ];

  const handleToolClick = (toolId: ToolType) => {
    if (isBoardLocked && toolId !== 'hand' && toolId !== 'select') return;

    if (toolId === 'image') {
      fileInputRef.current?.click();
    } else {
      setActiveTool(toolId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImage(file);
      e.target.value = '';
    }
  };

  const getHintText = () => {
    if (isBoardLocked) {
      return '🔒 Board is locked (Read-only mode). Click the lock icon to unlock and edit.';
    }
    switch (activeTool) {
      case 'text':
        return 'Click anywhere on canvas to type text. Double-click any element to edit.';
      case 'image':
        return 'Insert images to whiteboard by clicking, pasting (Ctrl+V), or dropping files.';
      case 'sticky':
        return 'Click anywhere on canvas to place a sticky note.';
      case 'arrow':
      case 'line':
        return 'Drag between shapes to connect them like a wireframe • Snap to blue anchor points';
      case 'rectangle':
      case 'diamond':
      case 'ellipse':
        return 'Click and drag to draw shape • Double-click shape to add text inside';
      case 'pencil':
        return 'Click and drag to draw freehand strokes.';
      case 'eraser':
        return 'Click on any element or line to erase it.';
      case 'hand':
        return 'Click and drag to pan the whiteboard canvas.';
      default:
        return 'Click and drag elements • Drag corner handles to resize • Connect with arrows';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      {/* Top Floating Toolbar */}
      <div className="floating-toolbar" style={{ position: 'relative' }}>
        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Lock Board Button (Matching user screenshot) */}
        <button
          className={`tool-btn ${isBoardLocked ? 'active locked-btn' : ''}`}
          onClick={onToggleBoardLock}
          title={isBoardLocked ? 'Board is Locked (Click to Unlock)' : 'Lock Board (Prevent Edits)'}
          style={{ width: '38px', height: '36px' }}
        >
          {isBoardLocked ? <Lock size={16} color="#4f46e5" /> : <Unlock size={16} color="#6b7280" />}
        </button>

        <div className="divider" />

        {/* Primary Tools */}
        {mainTools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''} ${isBoardLocked && tool.id !== 'hand' && tool.id !== 'select' ? 'disabled-tool' : ''}`}
            onClick={() => handleToolClick(tool.id)}
            title={tool.label}
            disabled={isBoardLocked && tool.id !== 'hand' && tool.id !== 'select'}
          >
            {tool.icon}
            {tool.shortcut && (
              <span className="tool-shortcut-sub">{tool.shortcut}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contextual Shortcut / Hint Bar */}
      <div className="toolbar-hint-bar">
        {getHintText()}
      </div>
    </div>
  );
};
