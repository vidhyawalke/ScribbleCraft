import React, { useState } from 'react';
import { X, Search, Sparkles } from 'lucide-react';
import { POPULAR_HANDWRITING_FONTS, FontOption, loadGoogleFont } from '../utils/googleFonts';

interface FontPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFont: string;
  onSelectFont: (fontFamily: string) => void;
}

export const FontPickerModal: React.FC<FontPickerModalProps> = ({
  isOpen,
  onClose,
  selectedFont,
  onSelectFont,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customFontInput, setCustomFontInput] = useState('');

  if (!isOpen) return null;

  const filteredFonts = POPULAR_HANDWRITING_FONTS.filter((font) =>
    font.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFontClick = (family: string) => {
    loadGoogleFont(family);
    onSelectFont(family);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFontInput.trim()) return;
    const fontName = customFontInput.trim();
    loadGoogleFont(fontName);
    onSelectFont(fontName);
    setCustomFontInput('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-card" 
        style={{ maxWidth: '640px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#6366f1" /> Google Handwriting Fonts
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
              Choose a handwriting style for your notes & annotations.
            </p>
          </div>
          <button 
            className="btn-icon" 
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Custom Input */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search handwriting font..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Custom Google Font load field */}
        <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Or enter any Google Font name (e.g. Pacifico, Courgette)"
            value={customFontInput}
            onChange={(e) => setCustomFontInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 14px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Load Font
          </button>
        </form>

        {/* Font List Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredFonts.map((font: FontOption) => {
            loadGoogleFont(font.family);
            const isSelected = selectedFont === font.family;
            return (
              <div
                key={font.family}
                onClick={() => handleFontClick(font.family)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  background: isSelected ? '#f0f3ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? '#3730a3' : '#374151' }}>
                    {font.name}
                  </span>
                  {isSelected && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5' }}>Active</span>}
                </div>
                <div 
                  style={{ 
                    fontFamily: `'${font.family}', cursive`, 
                    fontSize: '1.25rem',
                    color: '#111827',
                    lineHeight: 1.3,
                  }}
                >
                  {font.sampleText || 'The quick brown fox jumps over the lazy dog'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
