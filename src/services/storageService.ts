import { Board } from '../types';

const BOARDS_PREFIX = 'scribble_craft_boards_';
const ACTIVE_BOARD_KEY = 'scribble_craft_active_board_id';

const DEFAULT_BOARD_1: Board = {
  id: 'board1',
  name: 'board1',
  bgColor: '#fdfbf7',
  gridType: 'dots',
  createdAt: Date.now() - 3600000 * 24,
  updatedAt: Date.now(),
  elements: [
    {
      id: 'sticky_main',
      type: 'sticky',
      x: 420,
      y: 180,
      width: 280,
      height: 280,
      text: "Save multiple boards:\nboard1, board2, etc.\n\nShare room link with friends to collaborate live! 🚀",
      strokeColor: '#333333',
      fillColor: '#ffb8b8',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      fontFamily: 'Caveat',
      fontSize: 28,
      stickyBg: '#ffb8b8',
      stickyRotation: -0.5,
      stickyTape: true,
      zIndex: 1,
    }
  ]
};

const DEFAULT_BOARD_2: Board = {
  id: 'board2',
  name: 'board2',
  bgColor: '#fdfbf7',
  gridType: 'dots',
  createdAt: Date.now() - 3600000 * 12,
  updatedAt: Date.now(),
  elements: []
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
        if (boards.length > 0) {
          // Sanitize any legacy cached text from earlier versions
          const sanitized = boards.map((b) => ({
            ...b,
            elements: b.elements.map((el) => {
              if (el.text && (el.text.includes('OAuth') || el.text.includes('Excalidraw'))) {
                return {
                  ...el,
                  text: el.text
                    .replace(/Sign in with OAuth 2\.0 to sync your workspace!/g, 'Share room link with friends to collaborate live!')
                    .replace(/OAuth 2\.0 multi-board saving/g, 'Live Real-Time Collaboration')
                    .replace(/OAuth 2\.0 Auth Flow 🔑[\s\S]*persistent state/g, 'Live Collaboration 👥\n- Real-time WebRTC sync\n- Remote collaborator cursors\n- Shareable room links')
                    .replace(/Excalidraw/g, 'ScribbleCraft')
                };
              }
              return el;
            })
          }));
          return sanitized;
        }
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
