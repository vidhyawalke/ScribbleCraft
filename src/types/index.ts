export type ToolType = 
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pencil'
  | 'text'
  | 'sticky'
  | 'eraser';

export type FillStyle = 'solid' | 'hachure' | 'transparent';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[]; // For pencil, arrow, line
  text?: string;
  strokeColor: string;
  fillColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fontFamily?: string;
  fontSize?: number;
  stickyBg?: string;
  stickyRotation?: number;
  stickyTape?: boolean;
  opacity?: number;
  zIndex: number;
}

export interface Board {
  id: string;
  name: string;
  elements: CanvasElement[];
  createdAt: number;
  updatedAt: number;
  bgColor: string;
  gridType: 'dots' | 'lines' | 'none';
}


export interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  lastActive: number;
}

export type CollabMessageType = 
  | 'JOIN_ROOM'
  | 'SYNC_STATE'
  | 'ELEMENTS_UPDATE'
  | 'CURSOR_MOVE'
  | 'CLEAR_CANVAS'
  | 'CHANGE_BG_COLOR'
  | 'CHANGE_GRID_TYPE';

export interface CollabMessage {
  type: CollabMessageType;
  senderId: string;
  senderName: string;
  senderColor: string;
  roomId: string;
  payload: any;
  timestamp: number;
}

