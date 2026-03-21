import { useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { ShowState, Card, Group } from '../types';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../socket';
import CardComponent from './CardComponent';
import SortableCard from './SortableCard';
import GroupPanel from './GroupPanel';

interface Props {
  showState: ShowState;
  mySocketId: string;
  roomId: string | undefined;
  onLeave: () => void;
}

const GROUP_TYPE_LABELS: Record<string, string> = {
  life: 'Life (Pure Seq)',
  secondLife: '2nd Life (Impure)',
  triplet: 'Set (Triplet)',
};

export default function ShowScreen({ showState, mySocketId, roomId, onLeave }: Props) {
  const isShowingPlayer = showState.showingPlayerId === mySocketId;
  const socket = getSocket();

  const { groups, clearSelection, selectedCards, toggleCardSelection } = useGameStore();

  const [handOrder, setHandOrder] = useState<string[]>(
    showState.showHandOrder.length
      ? showState.showHandOrder
      : showState.showingHand.map(c => c.id)
  );
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  // Keep handOrder in sync as showingHand changes (e.g. on reconnect)
  useEffect(() => {
    setHandOrder(prev => {
      const incomingIds = showState.showingHand.map(c => c.id);
      const kept = prev.filter(id => incomingIds.includes(id));
      const newIds = incomingIds.filter(id => !kept.includes(id));
      return [...kept, ...newIds];
    });
  }, [showState.showingHand]);

  // Clear selection when entering show screen
  const didClear = useRef(false);
  useEffect(() => {
    if (!didClear.current) {
      clearSelection();
      didClear.current = true;
    }
  }, [clearSelection]);

  // Sync groups to server whenever they change (showing player only)
  const isFirstSync = useRef(true);
  useEffect(() => {
    if (!isShowingPlayer) return;
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return; // skip first render — groups already sent with game:startShow
    }
    socket.emit('game:showGroups', { roomId, groups });
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync hand order to server whenever it changes (showing player only)
  useEffect(() => {
    if (!isShowingPlayer) return;
    socket.emit('game:showHandOrder', { roomId, handOrder });
  }, [handOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setHandOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function validate() {
    socket.emit('game:validateShow', { roomId });
  }

  function giveUp() {
    socket.emit('game:giveUp', { roomId });
    setConfirmGiveUp(false);
  }

  const showingUsername = showState.players.find(p => p.id === showState.showingPlayerId)?.username ?? '';
  const isFinished = showState.phase === 'finished';
  const iWon = showState.winner === mySocketId;

  // Build card objects in hand order.
  // Showing player uses local drag-sortable order; opponent follows the server-broadcast order.
  const displayOrder = isShowingPlayer
    ? handOrder
    : (showState.showHandOrder?.length ? showState.showHandOrder : showState.showingHand.map(c => c.id));
  const orderedHand: Card[] = displayOrder
    .map(id => showState.showingHand.find(c => c.id === id))
    .filter((c): c is Card => c !== undefined);

  // Map card → group label (for showing player using local groups; opponent using showState.showGroups)
  const activeGroups: Group[] = isShowingPlayer ? groups : showState.showGroups;
  const cardGroupName = new Map<string, string>();
  activeGroups.forEach(g => {
    if (g.name) g.cards.forEach(c => cardGroupName.set(c.id, g.name!));
  });

  const selectedCardObjects = orderedHand.filter(c => selectedCards.includes(c.id));

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-yellow-400">
            {isShowingPlayer ? 'Your Show' : `${showingUsername} is showing`}
          </h2>
          <p className="text-xs text-green-500">
            {isShowingPlayer
              ? 'Group 13 cards, then Validate to win'
              : 'Watching — waiting for validation'}
          </p>
        </div>
        {/* Wild joker */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-green-400">Wild Joker</span>
          {showState.wildJokerCard ? (
            <CardComponent card={showState.wildJokerCard} small />
          ) : (
            <div className="w-12 h-16 rounded bg-felt-dark border border-green-700" />
          )}
        </div>
      </div>

      {/* Result banner (finished) */}
      {isFinished && (
        <div className={`rounded-xl p-4 text-center ${iWon ? 'bg-yellow-400 text-felt-dark' : 'bg-felt border border-red-700'}`}>
          <div className="text-4xl mb-1">{iWon ? '🏆' : '😔'}</div>
          <p className="text-xl font-bold">{iWon ? 'You Win!' : 'You Lose'}</p>
          {!iWon && (
            <p className="text-sm mt-1">
              {showState.players.find(p => p.id === showState.winner)?.username ?? 'Opponent'} wins!
            </p>
          )}
          <button
            onClick={onLeave}
            className="mt-3 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
          >
            Leave Game
          </button>
        </div>
      )}

      {/* Validation error */}
      {showState.showValidateError && (
        <div className="bg-red-900/60 border border-red-600 rounded-lg px-4 py-2 text-center">
          <p className="text-red-300 text-sm font-medium">{showState.showValidateError}</p>
        </div>
      )}

      {/* Hand */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-green-600">
          {isShowingPlayer ? 'Click to select • drag to rearrange' : `${showingUsername}'s hand`}
        </p>

        {isShowingPlayer ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={handOrder} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-1 flex-wrap justify-center">
                {orderedHand.map(card => (
                  <SortableCard
                    key={card.id}
                    card={card}
                    selected={selectedCards.includes(card.id)}
                    onClick={() => toggleCardSelection(card.id)}
                    groupLabel={cardGroupName.get(card.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex gap-1 flex-wrap justify-center">
            {orderedHand.map(card => (
              <CardComponent
                key={card.id}
                card={card}
                groupLabel={cardGroupName.get(card.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Group panel */}
      {isShowingPlayer && !isFinished ? (
        <GroupPanel
          selectedCards={selectedCardObjects}
          totalCards={showState.showingHand.length}
          canShow={false}
          showBlockedReason=""
          onShow={() => {}}
          showError={null}
        />
      ) : (
        /* Read-only groups for opponent (or finished state) */
        activeGroups.length > 0 && (
          <div className="bg-felt rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-green-300">Groups ({activeGroups.length})</h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {activeGroups.map((g, i) => (
                <div key={i} className="bg-felt-dark rounded-lg p-2 flex items-center gap-2">
                  <span className="text-xs text-yellow-400 w-32 shrink-0 leading-tight">
                    {g.name && (
                      <span className="font-mono font-bold bg-blue-700 text-white px-1 rounded mr-1">
                        {g.name}
                      </span>
                    )}
                    {GROUP_TYPE_LABELS[g.type]}
                  </span>
                  <div className="flex gap-1 flex-wrap flex-1">
                    {g.cards.map(c => (
                      <CardComponent key={c.id} card={c} small />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Action buttons — showing player only, not finished */}
      {isShowingPlayer && !isFinished && (
        <div className="flex gap-3">
          <button
            onClick={validate}
            className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 text-felt-dark font-bold rounded-xl text-lg"
          >
            Validate
          </button>
          {!confirmGiveUp ? (
            <button
              onClick={() => setConfirmGiveUp(true)}
              className="px-4 py-3 bg-felt border border-red-800 text-red-400 hover:text-red-300 font-semibold rounded-xl text-sm"
            >
              Give Up
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={giveUp}
                className="px-4 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-sm"
              >
                Confirm Give Up
              </button>
              <button
                onClick={() => setConfirmGiveUp(false)}
                className="px-3 py-3 bg-felt border border-green-700 text-green-400 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Opponent waiting message */}
      {!isShowingPlayer && !isFinished && (
        <div className="text-center text-green-600 text-sm py-2">
          Waiting for {showingUsername} to validate...
        </div>
      )}
    </div>
  );
}
