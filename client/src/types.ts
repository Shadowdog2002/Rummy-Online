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
  name?: string;
}

export interface PlayerInfo {
  id: string;
  username: string;
  timeLeft: number;
}

export interface GameState {
  roomId: string;
  phase: 'waiting' | 'ready' | 'playing' | 'showing' | 'finished';
  myHand: Card[];
  opponentCardCount: number;
  topOpenCard: Card | null;
  deckCount: number;
  currentTurn: number;
  drawnCard: Card | null;
  wildJokerCard: Card | null;
  players: [PlayerInfo, PlayerInfo];
  winner: string | null;
  clockMode: 'turn' | 'countdown';
  timedOut: string | null;
}

export interface ShowState {
  roomId: string;
  phase: 'showing' | 'finished';
  showingPlayerId: string;
  showingHand: Card[];
  showGroups: Group[];
  showHandOrder: string[];
  wildJokerCard: Card | null;
  winner: string | null;
  players: [{ id: string; username: string }, { id: string; username: string }];
  showValidateError: string | null;
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
