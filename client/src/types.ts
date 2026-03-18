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

export type GroupType = 'life' | 'secondLife' | 'triplet';
export interface Group {
  type: GroupType;
  cards: Card[];
  name?: string; // e.g. "L1", "S2", "T1"
}

export interface PlayerInfo {
  id: string;
  username: string;
  timeLeft: number;
}

export interface GameState {
  roomId: string;
  phase: 'waiting' | 'ready' | 'playing' | 'finished';
  myHand: Card[];
  opponentCardCount: number;
  openPile: Card[];
  deckCount: number;
  currentTurn: number;
  drawnCard: Card | null;
  wildJokerCard: Card | null;
  players: [PlayerInfo, PlayerInfo];
  winner: string | null;
}

export interface LobbyRoom {
  roomId: string;
  players: string[];
}

export interface User {
  id: string;
  username: string;
  isGuest: boolean;
}
