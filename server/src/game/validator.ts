/**
 * Hand validation for Indian Rummy.
 */

import { Card, Rank, Group, GroupType } from './types';
import { RANK_ORDER } from './deck';

export type { GroupType, Group };

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function isJoker(card: Card, wildRank: Rank | null): boolean {
  if (card.isJoker) return true;
  if (wildRank && card.rank === wildRank) return true;
  return false;
}

/** Check if a sorted array of rank numbers is consecutive */
function isConsecutiveRanks(ranks: number[]): boolean {
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

/** Pure sequence: ≥3 cards, same suit, consecutive ranks, NO jokers. A can be low (A-2-3) or high (Q-K-A). */
function isLife(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3) return false;
  if (cards.some(c => isJoker(c, wildRank))) return false;
  const suits = new Set(cards.map(c => c.suit));
  if (suits.size !== 1) return false;
  const ranks = cards.map(c => RANK_ORDER[c.rank!]);
  // Try A=1 (low ace: A-2-3...)
  if (isConsecutiveRanks(ranks)) return true;
  // Try A=14 (high ace: Q-K-A)
  return isConsecutiveRanks(ranks.map(r => r === 1 ? 14 : r));
}

/** Impure sequence: ≥3 cards, same suit, consecutive ranks, jokers allowed as substitutes. A can be low or high. */
function isSecondLife(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3) return false;
  const naturalCards = cards.filter(c => !isJoker(c, wildRank));
  const jokerCount = cards.length - naturalCards.length;

  if (jokerCount === 0) return isLife(cards, wildRank);

  const suits = new Set(naturalCards.map(c => c.suit));
  if (suits.size !== 1) return false;

  // Try both A=1 (low) and A=14 (high, for Q-K-A)
  for (const useHighAce of [false, true]) {
    const ranks = naturalCards
      .map(c => { const r = RANK_ORDER[c.rank!]; return useHighAce && r === 1 ? 14 : r; })
      .sort((a, b) => a - b);

    let gapsNeeded = 0;
    let valid = true;
    for (let i = 1; i < ranks.length; i++) {
      const diff = ranks[i] - ranks[i - 1];
      if (diff === 0) { valid = false; break; }
      gapsNeeded += diff - 1;
    }
    if (valid && gapsNeeded <= jokerCount) return true;
  }
  return false;
}

/** Triplet: 3–4 cards of same rank, different suits, jokers allowed */
function isTriplet(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const naturalCards = cards.filter(c => !isJoker(c, wildRank));

  const ranks = new Set(naturalCards.map(c => c.rank));
  if (ranks.size !== 1) return false;

  const suits = naturalCards.map(c => c.suit);
  if (new Set(suits).size !== suits.length) return false;

  return true;
}

export function validateShow(
  groups: Group[],
  hand: Card[],
  wildRank: Rank | null
): ValidationResult {
  const groupCardIds = groups.flatMap(g => g.cards.map(c => c.id));
  if (groupCardIds.length !== 13) {
    return { valid: false, error: 'All 13 cards must be grouped (leave 1 card ungrouped as discard)' };
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

  if (lifeGroups.length < 1) {
    return { valid: false, error: 'You need at least one pure sequence (life)' };
  }

  const totalSequences = lifeGroups.length + secondLifeGroups.length;
  if (tripletGroups.length > 0 && totalSequences < 2) {
    return {
      valid: false,
      error: 'You need at least 2 sequences (life + second life) before using triplets',
    };
  }

  return { valid: true };
}
