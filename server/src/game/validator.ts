/**
 * Hand validation for Indian Rummy.
 *
 * Rules:
 * - A hand of 13 cards wins when ALL cards are in valid groups.
 * - Must have at least one "life" (pure sequence).
 * - Must have at least one "second life" (impure sequence, jokers allowed) OR a second pure life.
 * - Additional groups can be "triplets" (3-4 same rank, different suits, jokers allowed).
 * - Printed jokers and wild-joker cards count as jokers everywhere.
 */

import { Card, Rank } from './types';
import { RANK_ORDER } from './deck';

// A group submitted by the client: tagged with its intended type
export type GroupType = 'life' | 'secondLife' | 'triplet';
export interface Group {
  type: GroupType;
  cards: Card[];
  name?: string; // e.g. "L1", "S2", "T1"
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function isJoker(card: Card, wildRank: Rank | null): boolean {
  if (card.isJoker) return true;
  if (wildRank && card.rank === wildRank) return true;
  return false;
}

/** Pure sequence: ≥3 cards, same suit, consecutive ranks, NO jokers */
function isLife(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3) return false;
  if (cards.some(c => isJoker(c, wildRank))) return false;
  const suits = new Set(cards.map(c => c.suit));
  if (suits.size !== 1) return false;
  const ranks = cards.map(c => RANK_ORDER[c.rank!]).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** Impure sequence: ≥3 cards, same suit, consecutive ranks, jokers allowed as substitutes */
function isSecondLife(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3) return false;
  const naturalCards = cards.filter(c => !isJoker(c, wildRank));
  const jokerCount = cards.length - naturalCards.length;

  if (jokerCount === 0) return isLife(cards, wildRank); // pure sequence qualifies too

  const suits = new Set(naturalCards.map(c => c.suit));
  if (suits.size !== 1) return false;

  const ranks = naturalCards.map(c => RANK_ORDER[c.rank!]).sort((a, b) => a - b);

  // Count gaps that need jokers to fill
  let gapsNeeded = 0;
  for (let i = 1; i < ranks.length; i++) {
    const diff = ranks[i] - ranks[i - 1];
    if (diff === 0) return false; // duplicate rank
    gapsNeeded += diff - 1;
  }

  return gapsNeeded <= jokerCount;
}

/** Triplet: 3–4 cards of same rank, different suits, jokers allowed */
function isTriplet(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const naturalCards = cards.filter(c => !isJoker(c, wildRank));

  const ranks = new Set(naturalCards.map(c => c.rank));
  if (ranks.size !== 1) return false;

  const suits = naturalCards.map(c => c.suit);
  if (new Set(suits).size !== suits.length) return false; // duplicate suits

  return true;
}

export function validateShow(
  groups: Group[],
  hand: Card[],
  wildRank: Rank | null
): ValidationResult {
  // Verify all 13 cards are accounted for exactly once
  const groupCardIds = groups.flatMap(g => g.cards.map(c => c.id));
  if (groupCardIds.length !== 13) {
    return { valid: false, error: 'All 13 cards must be grouped' };
  }
  const handIds = new Set(hand.map(c => c.id));
  for (const id of groupCardIds) {
    if (!handIds.has(id)) {
      return { valid: false, error: `Card ${id} is not in your hand` };
    }
  }
  if (new Set(groupCardIds).size !== 13) {
    return { valid: false, error: 'Duplicate cards in groups' };
  }

  // Validate each group according to its declared type
  const lifeGroups: Group[] = [];
  const secondLifeGroups: Group[] = [];
  const tripletGroups: Group[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const label = group.name ?? `group ${i + 1}`;
    if (group.type === 'life') {
      if (!isLife(group.cards, wildRank)) {
        return { valid: false, error: `${label}: invalid pure sequence (Life) — must be 3+ same suit, consecutive, no jokers` };
      }
      lifeGroups.push(group);
    } else if (group.type === 'secondLife') {
      if (!isSecondLife(group.cards, wildRank)) {
        return { valid: false, error: `${label}: invalid impure sequence (2nd Life) — must be 3+ same suit, consecutive, jokers allowed` };
      }
      secondLifeGroups.push(group);
    } else if (group.type === 'triplet') {
      if (!isTriplet(group.cards, wildRank)) {
        return { valid: false, error: `${label}: invalid set (Triplet) — must be 3–4 same rank, different suits` };
      }
      tripletGroups.push(group);
    }
  }

  // Must have at least 1 life
  if (lifeGroups.length < 1) {
    return { valid: false, error: 'You need at least one pure sequence (life)' };
  }

  // Must have at least 2 sequences total before triplets are allowed
  const totalSequences = lifeGroups.length + secondLifeGroups.length;
  if (tripletGroups.length > 0 && totalSequences < 2) {
    return {
      valid: false,
      error: 'You need at least 2 sequences (life + second life) before using triplets',
    };
  }

  return { valid: true };
}
