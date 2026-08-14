import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RotateCw, 
  Grid,
  Share2,
  Users,
  Check,
  Edit3
} from 'lucide-react';
import { Board, CanvasElement, ToolType, Point, Collaborator } from './types';
import { StorageService } from './services/storageService';
import { CollaborationService } from './services/collaborationService';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { StickyNoteSvgDefs } from './components/StickyNoteElement';
import { FontPickerModal } from './components/FontPickerModal';
import { BoardDrawer } from './components/BoardDrawer';

export function App() {
  const collabService = CollaborationService.getInstance();
  const [localUser, setLocalUser] = useState<Collaborator>(collabService.localUser);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>(collabService.localUser.name);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const [boards, setBoards] = useState<Board[]>(() => StorageService.getBoards());
  const [activeBoardId, setActiveBoardId] = useState<string>(() => StorageService.getActiveBoardId());
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  // History stack for Undo/Redo
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Modals state
  const [isFontModalOpen, setIsFontModalOpen] = useState<boolean>(false);
  const [isBoardDrawerOpen, setIsBoardDrawerOpen] = useState<boolean>(false);

  // Initialize Room & Real-time Syncing
  useEffect(() => {
    collabService.initRoom();

    const unsubCollab = collabService.onCollaboratorsChange((list) => {
      setCollaborators(list);
    });

    const unsubMsg = collabService.subscribe((msg) => {
      if (msg.type === 'ELEMENTS_UPDATE' && Array.isArray(msg.payload?.elements)) {
        const remoteElements: CanvasElement[] = msg.payload.elements;
        setBoards((prevBoards) => {
          return prevBoards.map((b) => {
            if (b.id === activeBoardId) {
              const updatedBoard = { ...b, elements: remoteElements, updatedAt: Date.now() };
              StorageService.saveBoard(updatedBoard);
              return updatedBoard;
            }
            return b;
          });
        });
      } else if (msg.type === 'CLEAR_CANVAS') {
        setBoards((prevBoards) => {
          return prevBoards.map((b) => {
            if (b.id === activeBoardId) {
              const updatedBoard = { ...b, elements: [], updatedAt: Date.now() };
              StorageService.saveBoard(updatedBoard);
              return updatedBoard;
            }
            return b;
          });
        });
      } else if (msg.type === 'JOIN_ROOM') {
        // Send our current board elements to new peers
        const current = StorageService.getBoards().find((b) => b.id === activeBoardId);
        if (current) {
          collabService.broadcastElements(current.elements);
        }
      }
    });

    return () => {
      unsubCollab();
      unsubMsg();
    };
  }, [activeBoardId, collabService]);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0] || {
    id: 'board1',
    name: 'board1',
    elements: [],
    bgColor: '#fdfbf7',
    gridType: 'dots',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Push state to undo/redo history and broadcast to room
  const updateElements = (newElements: CanvasElement[], isRemote: boolean = false) => {
    const updatedBoard = { ...activeBoard, elements: newElements, updatedAt: Date.now() };
    StorageService.saveBoard(updatedBoard);
    
    setBoards(boards.map((b) => (b.id === activeBoard.id ? updatedBoard : b)));

    // Save to history
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newElements]);
    setHistoryIndex(nextHistory.length);

    // Broadcast to connected room collaborators
    if (!isRemote) {
      collabService.broadcastElements(newElements);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevElements = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      updateElements(prevElements);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextElements = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      updateElements(nextElements);
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm('Clear all elements on this board?')) {
      updateElements([]);
      setSelectedId(null);
      collabService.broadcastClearCanvas();
    }
  };

  const selectedElement = activeBoard.elements.find((el) => el.id === selectedId) || null;

  const handleUpdateSelected = (updated: Partial<CanvasElement>) => {
    if (!selectedId) return;
    const newElements = activeBoard.elements.map((el) => {
      if (el.id === selectedId) {
        return { ...el, ...updated };
      }
      return el;
    });
    updateElements(newElements);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    updateElements(activeBoard.elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const handleShareRoom = () => {
    const shareUrl = collabService.getShareableUrl();
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    }).catch(() => {
      prompt('Copy live collaboration link:', shareUrl);
    });
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      collabService.updateLocalUserName(nameInput.trim());
      setLocalUser({ ...collabService.localUser });
    }
    setIsEditingName(false);
  };

  // Export handlers
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeBoard, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeBoard.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', image);
    downloadAnchor.setAttribute('download', `${activeBoard.name.replace(/\s+/g, '_')}.png`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="app-container">
      {/* SVG ClipPath Defs for Sticky Notes */}
      <StickyNoteSvgDefs />

      {/* Toast Notification */}
      {copiedToast && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            right: '24px',
            zIndex: 10000,
            background: '#10b981',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <Check size={18} />
          Copied live collaboration room link to clipboard!
        </div>
      )}

      {/* Top Header Bar */}
      <header className="top-header">
        <div className="brand-badge" onClick={() => setIsBoardDrawerOpen(true)}>
          <span className="brand-title">ScribbleCraft</span>
          <span className="board-tag">{activeBoard.name}</span>
          <FolderKanban size={16} color="#6366f1" />
        </div>

        {/* Center Floating Toolbar */}
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onClearCanvas={handleClearCanvas}
        />

        {/* Right Live Collaboration Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* User Badge / Editable Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(229, 231, 235, 0.9)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: localUser.color || '#6366f1',
              }}
            />
            {isEditingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                onBlur={handleSaveName}
                autoFocus
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#111827',
                  width: '110px',
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditingName(true)}
                title="Click to edit your display name"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {localUser.name}
                <Edit3 size={12} color="#9ca3af" />
              </span>
            )}
          </div>

          {/* Active Collaborators Counter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(243, 244, 246, 0.9)',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#4b5563',
            }}
            title={`${collaborators.length + 1} users online in room`}
          >
            <Users size={15} color="#6366f1" />
            <span>{collaborators.length + 1} Online</span>
          </div>

          {/* Share Room Link Button */}
          <button
            onClick={handleShareRoom}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Share2 size={16} />
            <span>Share Room</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main style={{ flex: 1, width: '100%', height: '100%' }}>
        <WhiteboardCanvas
          elements={activeBoard.elements}
          activeTool={activeTool}
          selectedId={selectedId}
          onSelectElement={setSelectedId}
          onUpdateElements={(elems) => updateElements(elems, false)}
          zoom={zoom}
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          bgColor={activeBoard.bgColor}
          gridType={activeBoard.gridType}
          collaborators={collaborators}
          onMouseMoveCursor={(point) => collabService.broadcastCursor(point)}
        />
      </main>

      {/* Contextual Properties Inspector Panel */}
      {selectedElement && (
        <PropertiesPanel
          selectedElement={selectedElement}
          onUpdateElement={handleUpdateSelected}
          onDeleteElement={handleDeleteSelected}
          onOpenFontModal={() => setIsFontModalOpen(true)}
        />
      )}

      {/* Bottom Floating Navigation Controls */}
      <div className="bottom-controls">
        <button
          className="btn-icon"
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="zoom-text">{Math.round(zoom * 100)}%</span>
        <button
          className="btn-icon"
          onClick={() => setZoom((z) => Math.min(4.0, z + 0.1))}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={() => { setZoom(1.0); setPanOffset({ x: 0, y: 0 }); }}
          title="Reset Zoom & Pan"
        >
          Reset
        </button>

        <div className="divider" />

        <button
          className="btn-icon"
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          title="Undo"
        >
          <RotateCcw size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          title="Redo"
        >
          <RotateCw size={16} />
        </button>

        <div className="divider" />

        <button
          className="btn-icon"
          onClick={() => {
            const nextGrid = activeBoard.gridType === 'dots' ? 'lines' : activeBoard.gridType === 'lines' ? 'none' : 'dots';
            const updated = { ...activeBoard, gridType: nextGrid };
            StorageService.saveBoard(updated);
            setBoards(boards.map((b) => (b.id === activeBoard.id ? updated : b)));
          }}
          title="Toggle Grid (Dots/Lines/None)"
        >
          <Grid size={16} />
        </button>
      </div>

      {/* Modals */}
      <FontPickerModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        selectedFont={selectedElement?.fontFamily || 'Kalam'}
        onSelectFont={(fontFamily) => handleUpdateSelected({ fontFamily })}
      />

      <BoardDrawer
        isOpen={isBoardDrawerOpen}
        onClose={() => setIsBoardDrawerOpen(false)}
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={(id) => {
          setActiveBoardId(id);
          StorageService.setActiveBoardId(id);
        }}
        onCreateBoard={(name) => {
          const newBoard = StorageService.createNewBoard(name);
          setBoards(StorageService.getBoards());
          setActiveBoardId(newBoard.id);
        }}
        onRenameBoard={(id, newName) => {
          const board = boards.find((b) => b.id === id);
          if (board) {
            StorageService.saveBoard({ ...board, name: newName });
            setBoards(StorageService.getBoards());
          }
        }}
        onDeleteBoard={(id) => {
          const updated = StorageService.deleteBoard(id);
          setBoards(updated);
          setActiveBoardId(StorageService.getActiveBoardId());
        }}
        onExportJson={handleExportJson}
        onExportPng={handleExportPng}
        onExportSvg={handleExportPng}
        onImportJson={() => {}}
      />
    </div>
  );
}

export default App;
