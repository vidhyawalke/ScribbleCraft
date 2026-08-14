import React from 'react';
import { 
  Trash2, 
  ChevronsDown, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUp,
  Square,
  Sparkles
} from 'lucide-react';
import { CanvasElement, StrokeStyle } from '../types';

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  onUpdateElement: (updated: Partial<CanvasElement>) => void;
  onDeleteElement: () => void;
  onOpenFontModal: () => void;
  onLayerChange?: (action: 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack') => void;
}

const STROKE_COLORS = [
  '#1e1e1e', // Black
  '#e03131', // Red
  '#2f9e44', // Green
  '#1971c2', // Blue
  '#f08c00', // Orange
];

const FILL_COLORS = [
  'transparent',
  '#ffc9c9', // Light Red / Pink
  '#b2f2bb', // Light Green
  '#a5d8ff', // Light Blue
  '#ffec99', // Light Yellow
];

const STICKY_COLORS = [
  '#bbebff', // Blue
  '#ffeaa7', // Yellow
  '#ffb8b8', // Pink
  '#c7f9cc', // Mint
  '#e2d4f9', // Lavender
  '#ffd3b6', // Peach
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onOpenFontModal,
  onLayerChange,
}) => {
  if (!selectedElement) return null;

  const isText = selectedElement.type === 'text';
  const isSticky = selectedElement.type === 'sticky';
  const isShape = selectedElement.type === 'rectangle' || selectedElement.type === 'diamond' || selectedElement.type === 'ellipse';

  return (
    <div className="properties-panel">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize', color: '#111827' }}>
          {selectedElement.type.replace('_', ' ')}
        </span>
        <button
          className="btn-icon"
          onClick={onDeleteElement}
          title="Delete selected element (Del)"
          style={{ color: '#ef4444', width: '28px', height: '28px' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Sticky Note Paper Color */}
      {isSticky && (
        <div>
          <div className="panel-title">Background</div>
          <div className="color-palette">
            {STICKY_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${(selectedElement.stickyBg || selectedElement.fillColor) === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onUpdateElement({ stickyBg: color, fillColor: color })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke Color */}
      {!isSticky && (
        <div>
          <div className="panel-title">Stroke</div>
          <div className="color-palette">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedElement.strokeColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onUpdateElement({ strokeColor: color })}
              />
            ))}
            <input
              type="color"
              value={selectedElement.strokeColor || '#1e1e1e'}
              onChange={(e) => onUpdateElement({ strokeColor: e.target.value })}
              className="color-picker-input"
              title="Custom stroke color"
            />
          </div>
        </div>
      )}

      {/* Background / Fill Color for shapes */}
      {!isSticky && !isText && (
        <div>
          <div className="panel-title">Background</div>
          <div className="color-palette">
            {FILL_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedElement.fillColor === color ? 'selected' : ''} ${color === 'transparent' ? 'transparent-pattern' : ''}`}
                style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                onClick={() => onUpdateElement({ fillColor: color, fillStyle: color === 'transparent' ? 'transparent' : 'solid' })}
              />
            ))}
            <input
              type="color"
              value={selectedElement.fillColor === 'transparent' ? '#ffffff' : selectedElement.fillColor}
              onChange={(e) => onUpdateElement({ fillColor: e.target.value, fillStyle: 'solid' })}
              className="color-picker-input"
              title="Custom background color"
            />
          </div>
        </div>
      )}

      {/* Stroke Width */}
      <div>
        <div className="panel-title">Stroke width</div>
        <div className="segmented-control">
          {[
            { width: 1.5, label: '—', desc: 'Thin' },
            { width: 3, label: '—', desc: 'Bold' },
            { width: 5, label: '—', desc: 'Extra Bold' },
          ].map((item, idx) => (
            <button
              key={idx}
              className={`segmented-btn ${selectedElement.strokeWidth === item.width || (idx === 1 && !selectedElement.strokeWidth) ? 'selected' : ''}`}
              onClick={() => onUpdateElement({ strokeWidth: item.width })}
              title={item.desc}
              style={{ fontWeight: idx === 0 ? 400 : idx === 1 ? 700 : 900 }}
            >
              <div
                style={{
                  width: '16px',
                  height: `${item.width}px`,
                  background: 'currentColor',
                  borderRadius: '2px',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Style */}
      <div>
        <div className="panel-title">Stroke style</div>
        <div className="segmented-control">
          {[
            { style: 'solid', label: '—', title: 'Solid' },
            { style: 'dashed', label: '- -', title: 'Dashed' },
            { style: 'dotted', label: '···', title: 'Dotted' },
          ].map((item) => (
            <button
              key={item.style}
              className={`segmented-btn ${selectedElement.strokeStyle === item.style || (!selectedElement.strokeStyle && item.style === 'solid') ? 'selected' : ''}`}
              onClick={() => onUpdateElement({ strokeStyle: item.style as StrokeStyle })}
              title={item.title}
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edges (for Rectangles / Shapes) */}
      {isShape && (
        <div>
          <div className="panel-title">Edges</div>
          <div className="segmented-control">
            <button
              className={`segmented-btn ${(selectedElement.opacity || 1) >= 1 ? 'selected' : ''}`}
              onClick={() => onUpdateElement({})}
              title="Sharp edges"
            >
              <Square size={16} />
            </button>
            <button
              className="segmented-btn"
              onClick={() => onUpdateElement({})}
              title="Rounded edges"
            >
              <div style={{ width: '16px', height: '16px', border: '1.5px solid currentColor', borderRadius: '4px' }} />
            </button>
          </div>
        </div>
      )}

      {/* Typography & Handwriting Fonts */}
      {(isText || isSticky) && (
        <div>
          <div className="panel-title">Font Family</div>
          <button
            onClick={onOpenFontModal}
            className="font-select-btn"
          >
            <span style={{ fontFamily: selectedElement.fontFamily || 'Kalam', fontSize: '0.95rem' }}>
              {selectedElement.fontFamily || 'Kalam'}
            </span>
            <Sparkles size={14} color="#6366f1" />
          </button>
        </div>
      )}

      {/* Opacity Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Opacity</div>
        </div>
        <div style={{ marginTop: '8px' }}>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round((selectedElement.opacity !== undefined ? selectedElement.opacity : 1) * 100)}
            onChange={(e) => onUpdateElement({ opacity: parseInt(e.target.value, 10) / 100 })}
            className="opacity-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Layers Ordering */}
      <div>
        <div className="panel-title">Layers</div>
        <div className="segmented-control">
          <button
            className="segmented-btn"
            onClick={() => onLayerChange && onLayerChange('sendToBack')}
            title="Send to back"
          >
            <ChevronsDown size={16} />
          </button>
          <button
            className="segmented-btn"
            onClick={() => onLayerChange && onLayerChange('sendBackward')}
            title="Send backward"
          >
            <ChevronDown size={16} />
          </button>
          <button
            className="segmented-btn"
            onClick={() => onLayerChange && onLayerChange('bringForward')}
            title="Bring forward"
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="segmented-btn"
            onClick={() => onLayerChange && onLayerChange('bringToFront')}
            title="Bring to front"
          >
            <ChevronsUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
