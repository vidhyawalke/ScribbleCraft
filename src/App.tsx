import React, { useState, useEffect, useCallback } from 'react';
import { 
  Menu,
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
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
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
  const updateElements = useCallback((newElements: CanvasElement[], isRemote: boolean = false) => {
    setBoards((prev) => {
      const current = prev.find((b) => b.id === activeBoardId) || prev[0];
      if (!current) return prev;
      const updatedBoard = { ...current, elements: newElements, updatedAt: Date.now() };
      StorageService.saveBoard(updatedBoard);
      return prev.map((b) => (b.id === current.id ? updatedBoard : b));
    });

    // Save to history
    setHistory((prevHistory) => {
      const nextHistory = prevHistory.slice(0, historyIndex + 1);
      return [...nextHistory, newElements];
    });
    setHistoryIndex((prevIndex) => prevIndex + 1);

    // Broadcast to connected room collaborators
    if (!isRemote) {
      collabService.broadcastElements(newElements);
    }
  }, [activeBoardId, historyIndex, collabService]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevElements = history[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      setBoards((prev) => {
        const current = prev.find((b) => b.id === activeBoardId) || prev[0];
        if (!current) return prev;
        const updatedBoard = { ...current, elements: prevElements, updatedAt: Date.now() };
        StorageService.saveBoard(updatedBoard);
        return prev.map((b) => (b.id === current.id ? updatedBoard : b));
      });
      collabService.broadcastElements(prevElements);
    }
  }, [history, historyIndex, activeBoardId, collabService]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextElements = history[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      setBoards((prev) => {
        const current = prev.find((b) => b.id === activeBoardId) || prev[0];
        if (!current) return prev;
        const updatedBoard = { ...current, elements: nextElements, updatedAt: Date.now() };
        StorageService.saveBoard(updatedBoard);
        return prev.map((b) => (b.id === current.id ? updatedBoard : b));
      });
      collabService.broadcastElements(nextElements);
    }
  }, [history, historyIndex, activeBoardId, collabService]);

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

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    updateElements(activeBoard.elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, activeBoard.elements, updateElements]);

  // Layer ordering actions
  const handleLayerChange = (action: 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack') => {
    if (!selectedId) return;
    const index = activeBoard.elements.findIndex((el) => el.id === selectedId);
    if (index === -1) return;

    const list = [...activeBoard.elements];
    const [item] = list.splice(index, 1);

    if (action === 'bringToFront') {
      list.push(item);
    } else if (action === 'sendToBack') {
      list.unshift(item);
    } else if (action === 'bringForward') {
      const targetIndex = Math.min(list.length, index + 1);
      list.splice(targetIndex, 0, item);
    } else if (action === 'sendBackward') {
      const targetIndex = Math.max(0, index - 1);
      list.splice(targetIndex, 0, item);
    }

    const reindexed = list.map((el, i) => ({ ...el, zIndex: i + 1 }));
    updateElements(reindexed);
  };

  // Full Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Zoom Controls
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => Math.min(4.0, z + 0.1));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoom((z) => Math.max(0.2, z - 0.1));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        setPanOffset({ x: 0, y: 0 });
        return;
      }

      // Deselect or switch to selection tool on Escape
      if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
        return;
      }

      // Tool selection shortcuts
      switch (e.key) {
        case '1':
        case 'v':
        case 'V':
          setActiveTool('select');
          break;
        case '2':
        case 'r':
        case 'R':
          setActiveTool('rectangle');
          break;
        case '3':
        case 'd':
        case 'D':
          setActiveTool('diamond');
          break;
        case '4':
        case 'o':
        case 'O':
          setActiveTool('ellipse');
          break;
        case '5':
        case 'a':
        case 'A':
          setActiveTool('arrow');
          break;
        case '6':
        case 'l':
        case 'L':
          setActiveTool('line');
          break;
        case '7':
        case 'p':
        case 'P':
          setActiveTool('pencil');
          break;
        case '8':
        case 't':
        case 'T':
          setActiveTool('text');
          break;
        case '9':
        case 's':
        case 'S':
          setActiveTool('sticky');
          break;
        case '0':
        case 'e':
        case 'E':
          setActiveTool('eraser');
          break;
        case 'h':
        case 'H':
          setActiveTool('hand');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDeleteSelected]);

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
        <div className="copy-toast">
          <Check size={18} />
          Copied live collaboration room link to clipboard!
        </div>
      )}

      {/* Top Header Bar */}
      <header className="top-header">
        {/* Left: Menu & Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="menu-round-btn"
            onClick={() => setIsBoardDrawerOpen(true)}
            title="Workspace Boards Menu"
          >
            <Menu size={19} />
          </button>

          <div className="brand-badge" onClick={() => setIsBoardDrawerOpen(true)} title="Click to manage boards">
            <img 
              src="/logo.png" 
              alt="ScribbleCraft Logo" 
              style={{ 
                height: '32px', 
                width: 'auto', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                display: 'block' 
              }} 
            />
            <span className="board-tag">{activeBoard.name}</span>
            <FolderKanban size={15} color="#6366f1" />
          </div>
        </div>

        {/* Center Floating Toolbar */}
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isLocked={isToolLocked}
          setIsLocked={setIsToolLocked}
        />

        {/* Right Live Collaboration Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* User Badge / Editable Name */}
          <div className="user-name-badge">
            <div
              style={{
                width: '9px',
                height: '9px',
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
                  width: '100px',
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditingName(true)}
                title="Click to edit your display name"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {localUser.name}
                <Edit3 size={11} color="#9ca3af" />
              </span>
            )}
          </div>

          {/* Active Collaborators Counter */}
          <div
            className="online-pill"
            title={`${collaborators.length + 1} users online in room`}
          >
            <Users size={14} color="#6366f1" />
            <span>{collaborators.length + 1} Online</span>
          </div>

          {/* Share Room Link Button */}
          <button
            onClick={handleShareRoom}
            className="share-room-btn"
          >
            <Share2 size={15} />
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
          onToolComplete={() => {
            if (!isToolLocked && activeTool !== 'select' && activeTool !== 'hand') {
              setActiveTool('select');
            }
          }}
        />
      </main>

      {/* Contextual Properties Inspector Panel (Left side, matching Screenshot 3 & 4) */}
      {selectedElement && (
        <PropertiesPanel
          selectedElement={selectedElement}
          onUpdateElement={handleUpdateSelected}
          onDeleteElement={handleDeleteSelected}
          onOpenFontModal={() => setIsFontModalOpen(true)}
          onLayerChange={handleLayerChange}
        />
      )}

      {/* Bottom Floating Navigation Controls (Matching Screenshot 4) */}
      <div className="bottom-left-bar">
        {/* Zoom Controls Pill */}
        <div className="bottom-pill">
          <button
            className="btn-icon"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut size={15} />
          </button>
          <span className="zoom-text">{Math.round(zoom * 100)}%</span>
          <button
            className="btn-icon"
            onClick={() => setZoom((z) => Math.min(4.0, z + 0.1))}
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn size={15} />
          </button>
        </div>

        {/* Undo / Redo Pill */}
        <div className="bottom-pill">
          <button
            className="btn-icon"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="btn-icon"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw size={15} />
          </button>
        </div>

        {/* Grid Toggle Pill */}
        <div className="bottom-pill">
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
            <Grid size={15} />
          </button>
        </div>
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
