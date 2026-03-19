export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7'
  | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank | null;
  isJoker: boolean;
}

export interface Player {
  id: string;
  username: string;
  hand: Card[];
  timeLeft: number;
  ready: boolean;
}

export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'playing'
  | 'showing'
  | 'finished';

export interface RoomSettings {
  turnTimeMs: number;
  jokerCount: number;
}

export type GroupType = 'life' | 'secondLife' | 'triplet';

export interface Group {
  type: GroupType;
  cards: Card[];
  name?: string;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: [Player, Player] | [Player] | [];
  deck: Card[];
  openPile: Card[];
  currentTurn: number;
  drawnCard: Card | null;
  wildJokerCard: Card | null;
  clockInterval: ReturnType<typeof setInterval> | null;
  winner: string | null;
  hostId: string;
  settings: RoomSettings;
  showingPlayerId: string | null;
  showGroups: Group[];
  showHandOrder: string[];
  showValidateError: string | null;
}
