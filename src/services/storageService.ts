import { Board } from '../types';

const BOARDS_PREFIX = 'scribble_craft_boards_';
const ACTIVE_BOARD_KEY = 'scribble_craft_active_board_id';

const DEFAULT_BOARD_1: Board = {
  id: 'board1',
  name: 'board1 (Welcome & Getting Started)',
  bgColor: '#fdfbf7',
  gridType: 'dots',
  createdAt: Date.now() - 3600000 * 24,
  updatedAt: Date.now(),
  elements: [
    {
      id: 'sticky_welcome',
      type: 'sticky',
      x: 100,
      y: 120,
      width: 260,
      height: 260,
      text: "Welcome to ScribbleCraft!\n\n✨ Real paper-style sticky notes\n🎨 Dynamic Google Fonts\n🔐 OAuth 2.0 multi-board saving",
      strokeColor: '#333333',
      fillColor: '#bbebff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Kalam',
      fontSize: 22,
      stickyBg: '#bbebff',
      stickyRotation: -1.5,
      stickyTape: true,
      zIndex: 1,
    },
    {
      id: 'sticky_note_2',
      type: 'sticky',
      x: 400,
      y: 150,
      width: 260,
      height: 260,
      text: "Try switching handwriting fonts in the side panel! \n\nHandwritten by Reenie Beanie ✏️",
      strokeColor: '#333333',
      fillColor: '#ffeaa7',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Reenie Beanie',
      fontSize: 32,
      stickyBg: '#ffeaa7',
      stickyRotation: 2.2,
      stickyTape: true,
      zIndex: 2,
    },
    {
      id: 'sticky_note_3',
      type: 'sticky',
      x: 700,
      y: 130,
      width: 260,
      height: 260,
      text: "Save multiple boards:\nboard1, board2, etc.\n\nSign in with OAuth 2.0 to sync your workspace! 🚀",
      strokeColor: '#333333',
      fillColor: '#ffb8b8',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Caveat',
      fontSize: 26,
      stickyBg: '#ffb8b8',
      stickyRotation: -0.8,
      stickyTape: true,
      zIndex: 3,
    },
    {
      id: 'shape_rect_demo',
      type: 'rectangle',
      x: 150,
      y: 430,
      width: 220,
      height: 120,
      strokeColor: '#4f46e5',
      fillColor: '#e0e7ff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      zIndex: 4,
    },
    {
      id: 'shape_text_demo',
      type: 'text',
      x: 180,
      y: 475,
      width: 160,
      height: 40,
      text: 'Excalidraw Style',
      strokeColor: '#3730a3',
      fillColor: 'transparent',
      fillStyle: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Architects Daughter',
      fontSize: 22,
      zIndex: 5,
    },
    {
      id: 'arrow_demo',
      type: 'arrow',
      x: 390,
      y: 490,
      width: 280,
      height: 0,
      points: [{ x: 0, y: 0 }, { x: 280, y: 0 }],
      strokeColor: '#2563eb',
      fillColor: 'transparent',
      fillStyle: 'transparent',
      strokeWidth: 3,
      strokeStyle: 'solid',
      zIndex: 6,
    },
    {
      id: 'shape_ellipse_demo',
      type: 'ellipse',
      x: 700,
      y: 430,
      width: 140,
      height: 120,
      strokeColor: '#10b981',
      fillColor: '#d1fae5',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      zIndex: 7,
    }
  ]
};

const DEFAULT_BOARD_2: Board = {
  id: 'board2',
  name: 'board2 (Sprint Planning & Doodles)',
  bgColor: '#fdfbf7',
  gridType: 'dots',
  createdAt: Date.now() - 3600000 * 12,
  updatedAt: Date.now(),
  elements: [
    {
      id: 'sticky_b2_1',
      type: 'sticky',
      x: 150,
      y: 120,
      width: 260,
      height: 260,
      text: "Sprint Goal 🎯:\n- UI overhaul\n- Custom Sticky Notes\n- Google Fonts integration",
      strokeColor: '#333333',
      fillColor: '#c7f9cc',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Patrick Hand',
      fontSize: 24,
      stickyBg: '#c7f9cc',
      stickyRotation: -1.2,
      stickyTape: true,
      zIndex: 1,
    },
    {
      id: 'sticky_b2_2',
      type: 'sticky',
      x: 460,
      y: 140,
      width: 260,
      height: 260,
      text: "OAuth 2.0 Auth Flow 🔑\n- Google OAuth\n- GitHub OAuth\n- Board sync & persistent state",
      strokeColor: '#333333',
      fillColor: '#e2d4f9',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Indie Flower',
      fontSize: 24,
      stickyBg: '#e2d4f9',
      stickyRotation: 1.5,
      stickyTape: true,
      zIndex: 2,
    }
  ]
};

export class StorageService {
  private static getKey(userId?: string): string {
    return `${BOARDS_PREFIX}${userId || 'guest'}`;
  }

  public static getBoards(userId?: string): Board[] {
    try {
      const raw = localStorage.getItem(this.getKey(userId));
      if (raw) {
        const boards: Board[] = JSON.parse(raw);
        if (boards.length > 0) return boards;
      }
    } catch (e) {
      console.error('Failed to load boards:', e);
    }
    // Return default initial boards
    const defaults = [DEFAULT_BOARD_1, DEFAULT_BOARD_2];
    this.saveBoards(defaults, userId);
    return defaults;
  }

  public static saveBoards(boards: Board[], userId?: string): void {
    try {
      localStorage.setItem(this.getKey(userId), JSON.stringify(boards));
    } catch (e) {
      console.error('Failed to save boards:', e);
    }
  }

  public static getActiveBoardId(): string {
    return localStorage.getItem(ACTIVE_BOARD_KEY) || 'board1';
  }

  public static setActiveBoardId(id: string): void {
    localStorage.setItem(ACTIVE_BOARD_KEY, id);
  }

  public static createNewBoard(name: string, userId?: string): Board {
    const boards = this.getBoards(userId);
    const newBoard: Board = {
      id: `board_${Date.now().toString(36)}`,
      name: name || `board${boards.length + 1}`,
      elements: [],
      bgColor: '#fdfbf7',
      gridType: 'dots',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    boards.push(newBoard);
    this.saveBoards(boards, userId);
    this.setActiveBoardId(newBoard.id);
    return newBoard;
  }

  public static saveBoard(board: Board, userId?: string): void {
    const boards = this.getBoards(userId);
    const index = boards.findIndex(b => b.id === board.id);
    const updated = { ...board, updatedAt: Date.now() };
    if (index >= 0) {
      boards[index] = updated;
    } else {
      boards.push(updated);
    }
    this.saveBoards(boards, userId);
  }

  public static deleteBoard(id: string, userId?: string): Board[] {
    let boards = this.getBoards(userId);
    if (boards.length <= 1) return boards; // Keep at least 1 board
    boards = boards.filter(b => b.id !== id);
    this.saveBoards(boards, userId);
    if (this.getActiveBoardId() === id) {
      this.setActiveBoardId(boards[0].id);
    }
    return boards;
  }
}
