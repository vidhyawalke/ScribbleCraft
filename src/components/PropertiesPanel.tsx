import React from 'react';
import { 
  Type, 
  Trash2, 
  Sparkles
} from 'lucide-react';
import { CanvasElement, FillStyle } from '../types';

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  onUpdateElement: (updated: Partial<CanvasElement>) => void;
  onDeleteElement: () => void;
  onOpenFontModal: () => void;
}

const STROKE_COLORS = [
  '#1e293b', // Black / Slate
  '#dc2626', // Red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#16a34a', // Green
  '#0284c7', // Sky Blue
  '#4f46e5', // Indigo
  '#9333ea', // Purple
  '#db2777', // Pink
];

const FILL_COLORS = [
  'transparent',
  '#ffffff',
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#e0f2fe',
  '#e0e7ff',
  '#f3e8ff',
  '#fce7f3',
];

const STICKY_COLORS = [
  '#bbebff', // User default blue
  '#ffeaa7', // Yellow
  '#ffb8b8', // Pink / Coral
  '#c7f9cc', // Mint
  '#e2d4f9', // Lavender
  '#ffd3b6', // Peach
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onOpenFontModal,
}) => {
  if (!selectedElement) return null;

  const isText = selectedElement.type === 'text';
  const isSticky = selectedElement.type === 'sticky';

  return (
    <div className="properties-panel">
      {/* Element Type Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'capitalize', color: '#374151' }}>
          {selectedElement.type.replace('_', ' ')} Properties
        </span>
        <button
          className="btn-icon"
          onClick={onDeleteElement}
          title="Delete selected element"
          style={{ color: '#ef4444' }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Sticky Note Specific Color Palette */}
      {isSticky && (
        <div>
          <div className="panel-title">Sticky Paper Color</div>
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

      {/* Standard Stroke Color Palette */}
      {!isSticky && (
        <div>
          <div className="panel-title">Stroke Color</div>
          <div className="color-palette">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedElement.strokeColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onUpdateElement({ strokeColor: color })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fill Color Palette for Shapes */}
      {!isSticky && !isText && (
        <div>
          <div className="panel-title">Fill Color</div>
          <div className="color-palette">
            {FILL_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedElement.fillColor === color ? 'selected' : ''}`}
                style={{ 
                  backgroundColor: color === 'transparent' ? '#ffffff' : color, 
                  border: color === 'transparent' ? '1px dashed #9ca3af' : undefined 
                }}
                onClick={() => onUpdateElement({ fillColor: color })}
                title={color === 'transparent' ? 'Transparent' : color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fill Style (Solid, Hachure, Transparent) */}
      {!isSticky && !isText && selectedElement.fillColor !== 'transparent' && (
        <div>
          <div className="panel-title">Fill Style</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['solid', 'hachure', 'transparent'] as FillStyle[]).map((style) => (
              <button
                key={style}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  background: selectedElement.fillStyle === style ? '#4f46e5' : '#ffffff',
                  color: selectedElement.fillStyle === style ? '#ffffff' : '#374151',
                  cursor: 'pointer',
                }}
                onClick={() => onUpdateElement({ fillStyle: style })}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width */}
      {!isSticky && (
        <div>
          <div className="panel-title">Stroke Width</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 4, 6].map((width) => (
              <button
                key={width}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  background: selectedElement.strokeWidth === width ? '#4f46e5' : '#ffffff',
                  color: selectedElement.strokeWidth === width ? '#ffffff' : '#374151',
                  cursor: 'pointer',
                }}
                onClick={() => onUpdateElement({ strokeWidth: width })}
              >
                {width}px
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Handwriting Font Selector */}
      {(isText || isSticky) && (
        <div>
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Handwriting Font</span>
            <button
              onClick={onOpenFontModal}
              style={{
                background: 'none',
                border: 'none',
                color: '#4f46e5',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <Sparkles size={12} /> More Fonts
            </button>
          </div>

          <button
            onClick={onOpenFontModal}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ 
              fontFamily: `'${selectedElement.fontFamily || 'Kalam'}', cursive`, 
              fontSize: '1rem',
              color: '#111827'
            }}>
              {selectedElement.fontFamily || 'Kalam'}
            </span>
            <Type size={16} color="#6b7280" />
          </button>
        </div>
      )}

      {/* Font Size */}
      {(isText || isSticky) && (
        <div>
          <div className="panel-title">Font Size</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[16, 20, 24, 32, 40].map((size) => (
              <button
                key={size}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  background: (selectedElement.fontSize || 22) === size ? '#4f46e5' : '#ffffff',
                  color: (selectedElement.fontSize || 22) === size ? '#ffffff' : '#374151',
                  cursor: 'pointer',
                }}
                onClick={() => onUpdateElement({ fontSize: size })}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Note Rotation Angle slider */}
      {isSticky && (
        <div>
          <div className="panel-title">Paper Rotation (-5° to 5°)</div>
          <input
            type="range"
            min="-5"
            max="5"
            step="0.5"
            value={selectedElement.stickyRotation || 0}
            onChange={(e) => onUpdateElement({ stickyRotation: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Layering / Z-Index */}
      <div>
        <div className="panel-title">Layering</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              cursor: 'pointer',
            }}
            onClick={() => onUpdateElement({ zIndex: selectedElement.zIndex + 1 })}
          >
            Bring Forward
          </button>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              cursor: 'pointer',
            }}
            onClick={() => onUpdateElement({ zIndex: Math.max(0, selectedElement.zIndex - 1) })}
          >
            Send Back
          </button>
        </div>
      </div>
    </div>
  );
};
