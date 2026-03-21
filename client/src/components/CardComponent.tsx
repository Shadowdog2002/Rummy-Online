import { Card } from '../types';

interface Props {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
  groupLabel?: string;
  isDrawnCard?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

const RED_SUITS = new Set(['H', 'D']);

export default function CardComponent({ card, selected, onClick, small, faceDown, groupLabel, isDrawnCard }: Props) {
  if (faceDown) {
    return (
      <div
        className={`
          ${small ? 'w-12 h-16' : 'w-16 h-24'}
          rounded-lg bg-blue-800 border-2 border-blue-600
          flex items-center justify-center
          shadow-md select-none
        `}
      >
        <span className="text-blue-400 text-lg">🂠</span>
      </div>
    );
  }

  const isRed = card.suit ? RED_SUITS.has(card.suit) : false;
  const suitSymbol = card.suit ? SUIT_SYMBOLS[card.suit] : '';
  const displayRank = card.isJoker ? '🃏' : card.rank ?? '';

  return (
    <div
      onClick={onClick}
      className={`
        ${small ? 'w-12 h-16 text-xs' : 'w-16 h-24 text-sm'}
        rounded-lg bg-white border-2 shadow-md
        flex flex-col justify-between p-1
        select-none cursor-pointer transition-transform relative
        ${selected ? 'border-yellow-400 -translate-y-3 shadow-yellow-400/50' : isDrawnCard ? 'border-cyan-400 shadow-cyan-400/50' : 'border-gray-200 hover:-translate-y-1'}
        ${card.isJoker && !selected && !isDrawnCard ? 'border-purple-400' : ''}
      `}
    >
      {groupLabel && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
          <span className={`font-bold bg-blue-600 text-white rounded-b-md leading-tight ${small ? 'text-[7px] px-0.5' : 'text-[9px] px-1'}`}>
            {groupLabel}
          </span>
        </div>
      )}
      {card.isJoker ? (
        <div className="flex items-center justify-center h-full text-2xl">🃏</div>
      ) : (
        <>
          <div className={`font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {displayRank}
            <span className="ml-0.5">{suitSymbol}</span>
          </div>
          <div className={`text-center leading-none ${small ? 'text-base' : 'text-xl'} ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {suitSymbol}
          </div>
          <div className={`font-bold leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {displayRank}
            <span className="ml-0.5">{suitSymbol}</span>
          </div>
        </>
      )}
    </div>
  );
}
