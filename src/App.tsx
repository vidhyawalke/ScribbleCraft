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
import { Board, CanvasElement, ToolType, Point, Collaborator, ConnectionStatus } from './types';
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(collabService.connectionStatus);
  const [transportType, setTransportType] = useState<string>(
    collabService.activeTransport === 'socket.io'
      ? 'Socket.io'
      : collabService.activeTransport === 'webrtc'
      ? 'P2P WebRTC'
      : ''
  );
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>(collabService.localUser.name);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const [boards, setBoards] = useState<Board[]>(() => StorageService.getBoards());
  const [activeBoardId, setActiveBoardId] = useState<string>(() => StorageService.getActiveBoardId());
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isBoardLocked, setIsBoardLocked] = useState<boolean>(false);
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
    const currentBoard = StorageService.getBoards().find((b) => b.id === activeBoardId);
    collabService.initRoom(
      undefined,
      currentBoard?.elements,
      currentBoard?.bgColor,
      currentBoard?.gridType
    );

    const unsubStatus = collabService.onConnectionStatusChange((status, transport) => {
      setConnectionStatus(status);
      if (transport) setTransportType(transport);
    });

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
      } else if (msg.type === 'SYNC_STATE') {
        const remoteElements = msg.payload?.elements;
        const remoteBg = msg.payload?.bgColor;
        const remoteGrid = msg.payload?.gridType;

        setBoards((prevBoards) => {
          return prevBoards.map((b) => {
            if (b.id === activeBoardId) {
              const updatedBoard = {
                ...b,
                elements: (Array.isArray(remoteElements) && remoteElements.length > 0) ? remoteElements : b.elements,
                bgColor: remoteBg || b.bgColor,
                gridType: remoteGrid || b.gridType,
                updatedAt: Date.now(),
              };
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
      } else if (msg.type === 'CHANGE_BG_COLOR' && msg.payload?.bgColor) {
        setBoards((prevBoards) => {
          return prevBoards.map((b) => {
            if (b.id === activeBoardId) {
              const updatedBoard = { ...b, bgColor: msg.payload.bgColor, updatedAt: Date.now() };
              StorageService.saveBoard(updatedBoard);
              return updatedBoard;
            }
            return b;
          });
        });
      } else if (msg.type === 'CHANGE_GRID_TYPE' && msg.payload?.gridType) {
        setBoards((prevBoards) => {
          return prevBoards.map((b) => {
            if (b.id === activeBoardId) {
              const updatedBoard = { ...b, gridType: msg.payload.gridType, updatedAt: Date.now() };
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
      unsubStatus();
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
    if (isBoardLocked) return;

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
  }, [activeBoardId, historyIndex, collabService, isBoardLocked]);

  const handleUndo = useCallback(() => {
    if (isBoardLocked) return;
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
  }, [history, historyIndex, activeBoardId, collabService, isBoardLocked]);

  const handleRedo = useCallback(() => {
    if (isBoardLocked) return;
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
  }, [history, historyIndex, activeBoardId, collabService, isBoardLocked]);

  const selectedElement = activeBoard.elements.find((el) => el.id === selectedId) || null;

  const handleUpdateSelected = (updated: Partial<CanvasElement>) => {
    if (!selectedId || isBoardLocked) return;
    const newElements = activeBoard.elements.map((el) => {
      if (el.id === selectedId) {
        return { ...el, ...updated };
      }
      return el;
    });
    updateElements(newElements);
  };

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId || isBoardLocked) return;
    updateElements(activeBoard.elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, activeBoard.elements, updateElements, isBoardLocked]);

  // Insert Image file onto whiteboard
  const handleInsertImage = useCallback((file: File, pos?: Point) => {
    if (isBoardLocked) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxWidth = 340;
        const width = Math.min(maxWidth, img.naturalWidth || 300);
        const height = (width / (img.naturalWidth || 1)) * (img.naturalHeight || 200);

        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const imageElement: CanvasElement = {
          id,
          type: 'image',
          imageUrl: dataUrl,
          x: pos?.x ?? (400 - panOffset.x / zoom),
          y: pos?.y ?? (200 - panOffset.y / zoom),
          width,
          height,
          strokeColor: '#1e293b',
          fillColor: 'transparent',
          fillStyle: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          zIndex: activeBoard.elements.length + 1,
        };

        updateElements([...activeBoard.elements, imageElement]);
        setSelectedId(id);
        setActiveTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [activeBoard.elements, isBoardLocked, panOffset, zoom, updateElements]);

  // Layer ordering actions
  const handleLayerChange = (action: 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack') => {
    if (!selectedId || isBoardLocked) return;
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

      // Deselect on Escape
      if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
        return;
      }

      // Tool selection shortcuts
      if (isBoardLocked && e.key !== 'h' && e.key !== 'H' && e.key !== '1' && e.key !== 'v' && e.key !== 'V') {
        return;
      }

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
        case 'i':
        case 'I':
          setActiveTool('image');
          break;
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
  }, [handleUndo, handleRedo, handleDeleteSelected, isBoardLocked]);

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
      {/* SVG ClipPath Defs */}
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
                height: '30px', 
                width: 'auto', 
                objectFit: 'contain',
                display: 'block' 
              }} 
            />
            <span className="board-tag">{activeBoard.name}</span>
            <FolderKanban size={14} color="#6366f1" />
          </div>
        </div>

        {/* Center Floating Toolbar */}
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isBoardLocked={isBoardLocked}
          onToggleBoardLock={() => setIsBoardLocked((l) => !l)}
          onInsertImage={handleInsertImage}
        />

        {/* Right Live Collaboration Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* User Badge / Editable Name */}
          <div className="user-name-badge">
            <div
              style={{
                width: '8px',
                height: '8px',
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
                  fontSize: '0.82rem',
                  color: '#111827',
                  width: '90px',
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

          {/* Real-time Room Status Indicator */}
          <div
            className={`status-pill ${connectionStatus}`}
            title={`Real-Time Room Engine: ${
              connectionStatus === 'connected'
                ? `Active via ${transportType || 'Cloud Sync'}`
                : connectionStatus === 'connecting'
                ? 'Connecting to room peers...'
                : 'Offline (Local mode)'
            }`}
          >
            <div className={`status-dot ${connectionStatus}`} />
            <span>
              {connectionStatus === 'connected'
                ? `Live (${transportType || 'Room'})`
                : connectionStatus === 'connecting'
                ? 'Connecting...'
                : 'Offline'}
            </span>
          </div>

          {/* Active Collaborators Counter */}
          <div
            className="online-pill"
            title={`${collaborators.length + 1} users online in room`}
          >
            <Users size={13} color="#6366f1" />
            <span>{collaborators.length + 1} Online</span>
          </div>

          {/* Share Room Link Button */}
          <button
            onClick={handleShareRoom}
            className="share-room-btn"
          >
            <Share2 size={14} />
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
          isBoardLocked={isBoardLocked}
          collaborators={collaborators}
          onMouseMoveCursor={(point) => collabService.broadcastCursor(point)}
          onInsertImage={handleInsertImage}
          onToolComplete={() => {
            if (activeTool !== 'select' && activeTool !== 'hand') {
              setActiveTool('select');
            }
          }}
        />
      </main>

      {/* Contextual Properties Inspector Panel (Left side) */}
      {selectedElement && !isBoardLocked && (
        <PropertiesPanel
          selectedElement={selectedElement}
          onUpdateElement={handleUpdateSelected}
          onDeleteElement={handleDeleteSelected}
          onOpenFontModal={() => setIsFontModalOpen(true)}
          onLayerChange={handleLayerChange}
        />
      )}

      {/* Bottom Floating Navigation Controls */}
      <div className="bottom-left-bar">
        {/* Zoom Controls Pill */}
        <div className="bottom-pill">
          <button
            className="btn-icon"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut size={14} />
          </button>
          <span className="zoom-text">{Math.round(zoom * 100)}%</span>
          <button
            className="btn-icon"
            onClick={() => setZoom((z) => Math.min(4.0, z + 0.1))}
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Undo / Redo Pill */}
        <div className="bottom-pill">
          <button
            className="btn-icon"
            onClick={handleUndo}
            disabled={historyIndex <= 0 || isBoardLocked}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1 || isBoardLocked}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw size={14} />
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
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Very Light Developer Credit at the Corner of the Page */}
      <a
        href="https://www.linkedin.com/in/vidhyawalke/"
        target="_blank"
        rel="noopener noreferrer"
        title="Vidhya Walke on LinkedIn"
        style={{
          position: 'fixed',
          bottom: '14px',
          right: '18px',
          zIndex: 800,
          fontSize: '0.72rem',
          fontWeight: 500,
          color: '#9ca3af',
          textDecoration: 'none',
          letterSpacing: '0.01em',
          transition: 'color 0.2s ease',
          opacity: 0.85,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#0077b5';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#9ca3af';
          e.currentTarget.style.opacity = '0.85';
        }}
      >
        developed by <span style={{ textDecoration: 'underline' }}>vidhya walke</span>
      </a>

      {/* Modals */}
      <FontPickerModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        selectedFont={selectedElement?.fontFamily || 'Caveat'}
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
