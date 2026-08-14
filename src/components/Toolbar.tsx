import React, { useState } from 'react';
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
  StickyNote, 
  Eraser,
  MoreVertical,
  Frame,
  Code2,
  Shapes,
  Sparkles,
  PaintBucket,
  Lasso
} from 'lucide-react';
import { ToolType } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isLocked?: boolean;
  setIsLocked?: (locked: boolean) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isLocked = false,
  setIsLocked,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'hand', label: 'Pan / Hand tool (H or hold Space)', icon: <Hand size={17} />, shortcut: '' },
    { id: 'select', label: 'Selection tool (V)', icon: <MousePointer size={17} />, shortcut: '1' },
    { id: 'rectangle', label: 'Rectangle (R)', icon: <Square size={17} />, shortcut: '2' },
    { id: 'diamond', label: 'Diamond (D)', icon: <Diamond size={17} />, shortcut: '3' },
    { id: 'ellipse', label: 'Ellipse / Circle (O)', icon: <Circle size={17} />, shortcut: '4' },
    { id: 'arrow', label: 'Arrow (A)', icon: <ArrowRight size={17} />, shortcut: '5' },
    { id: 'line', label: 'Line (L)', icon: <Minus size={17} />, shortcut: '6' },
    { id: 'pencil', label: 'Pencil / Draw (P)', icon: <Pencil size={17} />, shortcut: '7' },
    { id: 'text', label: 'Text tool (T)', icon: <Type size={17} />, shortcut: '8' },
    { id: 'sticky', label: 'Sticky Note (S)', icon: <StickyNote size={17} />, shortcut: '9' },
    { id: 'eraser', label: 'Eraser tool (E)', icon: <Eraser size={17} />, shortcut: '0' },
  ];

  const extraTools = [
    { id: 'frame', label: 'Frame tool', icon: <Frame size={16} />, shortcut: 'F' },
    { id: 'embed', label: 'Web Embed', icon: <Code2 size={16} />, shortcut: '' },
    { id: 'shape_draw', label: 'Draw to shape', icon: <Shapes size={16} />, shortcut: 'Shift+X' },
    { id: 'laser', label: 'Laser pointer', icon: <Sparkles size={16} />, shortcut: 'K' },
    { id: 'bucket', label: 'Bucket fill', icon: <PaintBucket size={16} />, shortcut: 'B' },
    { id: 'lasso', label: 'Lasso selection', icon: <Lasso size={16} />, shortcut: '' },
  ];

  const getHintText = () => {
    switch (activeTool) {
      case 'text':
        return 'Click anywhere on canvas to type text. Double-click existing text to edit.';
      case 'sticky':
        return 'Click anywhere on canvas to place a sticky note.';
      case 'pencil':
        return 'Click and drag to draw freehand strokes.';
      case 'rectangle':
      case 'diamond':
      case 'ellipse':
        return 'Hold Shift to draw symmetrical shapes. Double-click to add text inside.';
      case 'arrow':
      case 'line':
        return 'Click and drag to draw connected lines and arrows.';
      case 'eraser':
        return 'Click on elements to erase them.';
      case 'hand':
        return 'Click and drag to pan the whiteboard canvas.';
      default:
        return 'Hold Shift and click to multi-select • Drag corners to resize';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      {/* Top Floating Toolbar */}
      <div className="floating-toolbar" style={{ position: 'relative' }}>
        {/* Lock Tool Button */}
        {setIsLocked && (
          <>
            <button
              className={`tool-btn ${isLocked ? 'active' : ''}`}
              onClick={() => setIsLocked(!isLocked)}
              title={isLocked ? 'Keep selected tool active (Locked)' : 'Unlock tool after drawing'}
              style={{ width: '36px', height: '36px' }}
            >
              {isLocked ? <Lock size={15} color="#4f46e5" /> : <Unlock size={15} color="#9ca3af" />}
            </button>
            <div className="divider" />
          </>
        )}

        {/* Primary Tools */}
        {mainTools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
          >
            {tool.icon}
            {tool.shortcut && (
              <span className="tool-shortcut-sub">{tool.shortcut}</span>
            )}
          </button>
        ))}

        <div className="divider" />

        {/* Extra Tools Dropdown Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            className={`tool-btn ${showMoreMenu ? 'active' : ''}`}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="More tools"
          >
            <MoreVertical size={17} />
          </button>

          {/* Extra Tools Dropdown Menu (Screenshot 2) */}
          {showMoreMenu && (
            <div
              className="extra-tools-dropdown"
              onClick={() => setShowMoreMenu(false)}
            >
              {extraTools.map((extra) => (
                <div
                  key={extra.id}
                  className="extra-tool-item"
                  onClick={() => {
                    if (extra.id === 'laser') setActiveTool('pencil');
                    setShowMoreMenu(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {extra.icon}
                    <span>{extra.label}</span>
                  </div>
                  {extra.shortcut && (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>
                      {extra.shortcut}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contextual Shortcut / Hint Bar */}
      <div className="toolbar-hint-bar">
        {getHintText()}
      </div>
    </div>
  );
};
