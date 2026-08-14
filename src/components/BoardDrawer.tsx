import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  FolderKanban, 
  Edit3, 
  Trash2, 
  Download, 
  Upload, 
  Check, 
  CloudCheck,
  Search
} from 'lucide-react';
import { Board } from '../types';

interface BoardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (name: string) => void;
  onRenameBoard: (boardId: string, newName: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const BoardDrawer: React.FC<BoardDrawerProps> = ({
  isOpen,
  onClose,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
  onExportJson,
  onExportPng,
  onExportSvg,
  onImportJson,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleStartRename = (board: Board) => {
    setEditingId(board.id);
    setEditingName(board.name);
  };

  const handleSaveRename = (boardId: string) => {
    if (editingName.trim()) {
      onRenameBoard(boardId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateBoard(newBoardName.trim() || `board${boards.length + 1}`);
    setNewBoardName('');
  };

  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-card"
        style={{ maxWidth: '560px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/logo.png" 
              alt="ScribbleCraft" 
              style={{ height: '40px', width: 'auto', objectFit: 'contain' }} 
            />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderKanban size={18} color="#4f46e5" /> Workspace Boards
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>
                Manage, switch, and backup your whiteboard canvases.
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Create Board Form */}
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="New board name (e.g. board3, Wireframes)"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 16px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} /> Create Board
          </button>
        </form>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search boards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Boards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '20px' }}>
          {filteredBoards.map((board) => {
            const isActive = board.id === activeBoardId;
            const isEditing = editingId === board.id;

            return (
              <div
                key={board.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: isActive ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  background: isActive ? '#f0f3ff' : '#ffffff',
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #4f46e5',
                        fontSize: '0.9rem',
                      }}
                      autoFocus
                    />
                    <button
                      className="btn-icon"
                      onClick={() => handleSaveRename(board.id)}
                      style={{ color: '#16a34a' }}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => {
                      onSelectBoard(board.id);
                      onClose();
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isActive ? '#3730a3' : '#111827' }}>
                        {board.name}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#4f46e5', color: '#fff', borderRadius: '4px', fontWeight: 600 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                      {board.elements.length} elements • Updated {new Date(board.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isEditing && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn-icon"
                      onClick={() => handleStartRename(board)}
                      title="Rename board"
                    >
                      <Edit3 size={16} />
                    </button>

                    {boards.length > 1 && (
                      <button
                        className="btn-icon"
                        onClick={() => onDeleteBoard(board.id)}
                        title="Delete board"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Backup & Export Bar */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CloudCheck size={16} color="#10b981" /> Auto-saved to storage
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onExportPng}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Export PNG
            </button>
            <button
              onClick={onExportSvg}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Export SVG
            </button>
            <button
              onClick={onExportJson}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Download size={14} /> JSON
            </button>
            <label
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Upload size={14} /> Import
              <input
                type="file"
                accept=".json"
                onChange={onImportJson}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
