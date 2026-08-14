import React from 'react';
import { 
  MousePointer, 
  Hand, 
  Square, 
  Diamond, 
  Circle, 
  ArrowRight, 
  Minus, 
  Pencil, 
  Type, 
  StickyNote, 
  Eraser,
  Trash2
} from 'lucide-react';
import { ToolType } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onClearCanvas: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  onClearCanvas,
}) => {
  const tools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Selection (V)', icon: <MousePointer size={18} />, shortcut: '1' },
    { id: 'hand', label: 'Pan / Hand (H)', icon: <Hand size={18} />, shortcut: '2' },
    { id: 'rectangle', label: 'Rectangle (R)', icon: <Square size={18} />, shortcut: '3' },
    { id: 'diamond', label: 'Diamond (D)', icon: <Diamond size={18} />, shortcut: '4' },
    { id: 'ellipse', label: 'Ellipse (O)', icon: <Circle size={18} />, shortcut: '5' },
    { id: 'arrow', label: 'Arrow (A)', icon: <ArrowRight size={18} />, shortcut: '6' },
    { id: 'line', label: 'Line (L)', icon: <Minus size={18} />, shortcut: '7' },
    { id: 'pencil', label: 'Pencil (P)', icon: <Pencil size={18} />, shortcut: '8' },
    { id: 'text', label: 'Text (T)', icon: <Type size={18} />, shortcut: '9' },
    { id: 'sticky', label: 'Sticky Note (S)', icon: <StickyNote size={18} />, shortcut: '0' },
    { id: 'eraser', label: 'Eraser (E)', icon: <Eraser size={18} />, shortcut: 'E' },
  ];

  return (
    <div className="floating-toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => setActiveTool(tool.id)}
          title={`${tool.label}`}
        >
          {tool.icon}
        </button>
      ))}

      <div className="divider" />

      <button
        className="tool-btn"
        onClick={onClearCanvas}
        title="Clear canvas"
      >
        <Trash2 size={18} className="text-red-500" />
      </button>
    </div>
  );
};
