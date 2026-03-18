import { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(jokerCount = 2): Card[] {
  const cards: Card[] = [];
  // One standard 52-card deck
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${suit}_${rank}`, suit, rank, isJoker: false });
    }
  }
  // Printed jokers (configurable)
  for (let i = 0; i < jokerCount; i++) {
    cards.push({ id: `JOKER_${i}`, suit: null, rank: null, isJoker: true });
  }
  return shuffle(cards);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const RANK_ORDER: Record<string, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};
