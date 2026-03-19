import { useState } from 'react';
import { GroupType, Card } from '../types';
import CardComponent from './CardComponent';
import { useGameStore } from '../store/gameStore';

interface Props {
  selectedCards: Card[];
  totalCards: number;
  canShow: boolean;
  showBlockedReason: string;
  onShow: () => void;
  showError: string | null;
  readOnly?: boolean;
}

const GROUP_LABELS: Record<GroupType, { short: string; desc: string; example: string }> = {
  life: {
    short: 'Pure Sequence (Life)',
    desc: '3+ same suit, in order — NO jokers',
    example: '4♥ 5♥ 6♥',
  },
  secondLife: {
    short: 'Impure Sequence (2nd Life)',
    desc: '3+ same suit, in order — jokers allowed',
    example: '4♥ 🃏 6♥',
  },
  triplet: {
    short: 'Set (Triplet)',
    desc: '3–4 same rank, different suits — jokers allowed',
    example: '7♥ 7♦ 7♠',
  },
};

export default function GroupPanel({ selectedCards, totalCards, canShow, showBlockedReason, onShow, showError, readOnly }: Props) {
  const { groups, addGroup, removeGroup, clearSelection } = useGameStore();
  const [showHelp, setShowHelp] = useState(false);

  const groupedCardCount = groups.reduce((sum, g) => sum + g.cards.length, 0);

  function createGroup(type: GroupType) {
    if (selectedCards.length < 3) return;
    addGroup({ type, cards: selectedCards });
  }

  return (
    <div className="bg-felt rounded-xl p-4 space-y-3">

      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-green-300">
            Groups ({groups.length})
          </h3>
          <p className="text-xs text-green-600">
            {groupedCardCount}/{totalCards} cards grouped
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-24 h-2 bg-felt-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(groupedCardCount / totalCards) * 100}%` }}
            />
          </div>
          <button
            onClick={() => setShowHelp(h => !h)}
            className="text-xs text-green-500 hover:text-green-300 border border-green-700 rounded-full w-5 h-5 flex items-center justify-center"
          >
            ?
          </button>
        </div>
      </div>

      {/* Help box */}
      {showHelp && (
        <div className="bg-felt-dark rounded-lg p-3 text-xs space-y-2 border border-green-800">
          <p className="text-yellow-400 font-semibold">How to Show:</p>
          <ol className="text-green-300 space-y-1 list-decimal list-inside">
            <li>Select 3+ cards from your hand (click them — they lift up)</li>
            <li>Press a group type button below to label them</li>
            <li>Repeat until all 13 cards are in groups</li>
            <li>On your turn: draw a card, then press <strong>Show!</strong></li>
          </ol>
          <p className="text-yellow-400 font-semibold mt-2">Requirements:</p>
          <ul className="text-green-300 space-y-1 list-disc list-inside">
            <li>At least 1 <strong>Pure Sequence (Life)</strong></li>
            <li>At least 2 total sequences before adding Sets</li>
            <li>All 13 cards must be in a group</li>
          </ul>
          {Object.entries(GROUP_LABELS).map(([key, val]) => (
            <div key={key} className="mt-1">
              <span className="text-white font-medium">{val.short}:</span>
              <span className="text-green-400 ml-1">{val.desc}</span>
              <span className="text-green-600 ml-1">e.g. {val.example}</span>
            </div>
          ))}
        </div>
      )}

      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {groups.map((g, i) => (
            <div key={i} className="bg-felt-dark rounded-lg p-2 flex items-center gap-2">
              <span className="text-xs text-yellow-400 w-32 shrink-0 leading-tight">
                {g.name && (
                  <span className="font-mono font-bold bg-blue-700 text-white px-1 rounded mr-1">
                    {g.name}
                  </span>
                )}
                {GROUP_LABELS[g.type].short}
              </span>
              <div className="flex gap-1 flex-wrap flex-1">
                {g.cards.map(c => (
                  <CardComponent key={c.id} card={c} small />
                ))}
              </div>
              <button
                onClick={() => removeGroup(i)}
                className="text-red-400 hover:text-red-300 text-xs shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Label selected cards */}
      {!readOnly && (
        selectedCards.length >= 3 ? (
          <div className="space-y-2 border-t border-green-800 pt-2">
            <p className="text-xs text-green-400">
              Label {selectedCards.length} selected cards as:
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(GROUP_LABELS) as [GroupType, typeof GROUP_LABELS[GroupType]][]).map(([type, val]) => (
                <button
                  key={type}
                  onClick={() => createGroup(type)}
                  className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg leading-tight text-left"
                >
                  <div className="font-semibold">{val.short}</div>
                  <div className="text-green-300 text-[10px]">{val.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-300">
              Clear selection
            </button>
          </div>
        ) : (
          selectedCards.length > 0 && (
            <p className="text-xs text-yellow-600 border-t border-green-800 pt-2">
              Select at least 3 cards to form a group ({selectedCards.length} selected)
            </p>
          )
        )
      )}

      {/* Show button — always visible */}
      {!readOnly && (
        <div className="border-t border-green-800 pt-3">
          <button
            onClick={canShow ? onShow : undefined}
            disabled={!canShow}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-colors ${
              canShow
                ? 'bg-yellow-400 hover:bg-yellow-300 text-felt-dark cursor-pointer shadow-lg'
                : 'bg-felt-dark text-green-700 cursor-not-allowed border border-green-800'
            }`}
          >
            Show!
          </button>
          {showError && (
            <p className="text-red-400 text-xs mt-2 text-center">{showError}</p>
          )}
          {!canShow && (
            <p className="text-green-700 text-xs mt-1.5 text-center">{showBlockedReason}</p>
          )}
        </div>
      )}

    </div>
  );
}
