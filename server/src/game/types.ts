export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
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
  | 'finished';

export interface RoomSettings {
  turnTimeMs: number;   // ms per turn
  jokerCount: number;   // number of printed jokers (0–4)
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
}
