import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../socket';
import { Card, GameState } from '../types';
import CardComponent from '../components/CardComponent';
import ChessClock from '../components/ChessClock';
import GroupPanel from '../components/GroupPanel';
import SortableCard from '../components/SortableCard';
import ShowScreen from '../components/ShowScreen';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    gameState, setGameState, updateClock,
    selectedCards, toggleCardSelection, clearSelection,
    groups, showError, setShowError,
    gameOverInfo, setGameOver,
    showState, setShowState,
    resetGame,
  } = useGameStore();

  const [handOrder, setHandOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!gameState) return;
    const incomingIds = gameState.myHand.map(c => c.id);
    setHandOrder(prev => {
      const kept = prev.filter(id => incomingIds.includes(id));
      const newIds = incomingIds.filter(id => !kept.includes(id));
      return [...kept, ...newIds];
    });
  }, [gameState?.myHand]);

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

  useEffect(() => {
    const socket = getSocket();

    socket.on('game:state', (state: GameState) => {
      setGameState(state);
    });

    socket.on('game:clock', (data: { players: { id: string; timeLeft: number }[]; currentTurn: number }) => {
      updateClock(data.players, data.currentTurn);
    });

    socket.on('game:showState', (state) => {
      setShowState(state);
    });

    socket.on('game:over', (info: { winner: string; winnerUsername: string; reason?: string }) => {
      setGameOver(info);
    });

    if (!useGameStore.getState().gameState) {
      socket.emit('game:request_state', { roomId });
    }

    return () => {
      socket.off('game:state');
      socket.off('game:clock');
      socket.off('game:showState');
      socket.off('game:over');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-green-400">Loading game...</p>
      </div>
    );
  }

  const socket = getSocket();
  const myIndex = gameState.players.findIndex(p => p.id === socket.id);

  if (myIndex === -1) {
    resetGame();
    navigate('/lobby');
    return null;
  }

  const opponentIndex = myIndex === 0 ? 1 : 0;
  const isMyTurn = gameState.currentTurn === myIndex;
  const myPlayer = gameState.players[myIndex];
  const opponentPlayer = gameState.players[opponentIndex];
  const drawnCard = gameState.drawnCard;

  const orderedHand: Card[] = handOrder
    .map(id => gameState.myHand.find(c => c.id === id))
    .filter((c): c is Card => c !== undefined);

  const cardGroupName = new Map<string, string>();
  groups.forEach(g => {
    if (g.name) g.cards.forEach(c => cardGroupName.set(c.id, g.name!));
  });

  const iTimedOut = gameState.timedOut === myPlayer.id;
  const canShow = isMyTurn && !!drawnCard;

  // Discard requires exactly 1 selected, ungrouped card, a drawn card, and not timed out
  const groupedCardIds = new Set(groups.flatMap(g => g.cards.map(c => c.id)));
  const discardMode = isMyTurn && !!drawnCard && !iTimedOut;
  const ungroupedSelected = selectedCards.filter(id => !groupedCardIds.has(id));
  const canDiscard = discardMode && ungroupedSelected.length === 1;

  function getShowBlockedReason(): string {
    if (!isMyTurn) return `It's ${opponentPlayer.username}'s turn`;
    if (!drawnCard) return 'Draw a card first, then show';
    return '';
  }
  const showBlockedReason = getShowBlockedReason();

  function draw(source: 'deck' | 'open') {
    if (!isMyTurn || drawnCard) return;
    socket.emit('game:draw', { roomId, source });
  }

  function discard(cardId: string) {
    if (!discardMode) return;
    socket.emit('game:discard', { roomId, cardId });
    clearSelection();
  }

  function show() {
    if (!canShow) return;
    setShowError(null);
    socket.emit('game:startShow', { roomId, groups, handOrder });
  }

  function leaveGame() {
    if (gameState?.phase === 'playing') {
      socket.emit('game:forfeit', { roomId });
    }
    resetGame();
    navigate('/lobby');
  }

  const selectedCardObjects = orderedHand.filter(c => selectedCards.includes(c.id));

  if (showState) {
    return (
      <ShowScreen
        showState={showState}
        mySocketId={socket.id ?? ''}
        roomId={roomId}
        onLeave={leaveGame}
      />
    );
  }

  if (gameOverInfo) {
    const iWon = gameOverInfo.winner === socket.id;
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-felt rounded-2xl p-10 text-center shadow-2xl max-w-sm w-full mx-4">
          <div className="text-6xl mb-4">{iWon ? '🏆' : '😔'}</div>
          <h2 className="text-3xl font-bold mb-2">
            {iWon ? 'You Win!' : 'You Lose'}
          </h2>
          {gameOverInfo.reason === 'opponent_disconnected' && (
            <p className="text-yellow-400 mb-2">Opponent disconnected</p>
          )}
          {gameOverInfo.reason === 'opponent_left' && (
            <p className="text-yellow-400 mb-2">Opponent left the game</p>
          )}
          {!iWon && (
            <p className="text-green-300 mb-4">{gameOverInfo.winnerUsername} wins!</p>
          )}
          <button
            onClick={leaveGame}
            className="mt-4 w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-felt-dark font-bold rounded-lg"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3">
      {/* Leave game */}
      <div className="flex justify-end">
        <button
          onClick={leaveGame}
          className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-900 rounded-lg"
        >
          Leave Game
        </button>
      </div>

      {/* Top bar: clocks + wild joker */}
      <div className="flex items-center justify-between">
        <ChessClock timeLeft={myPlayer.timeLeft} isActive={isMyTurn} username={`${myPlayer.username} (you)`} clockMode={gameState.clockMode} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-green-400">Wild Joker</span>
          {gameState.wildJokerCard ? (
            <CardComponent card={gameState.wildJokerCard} small />
          ) : (
            <div className="w-12 h-16 rounded bg-felt-dark border border-green-700" />
          )}
        </div>
        <ChessClock timeLeft={opponentPlayer.timeLeft} isActive={!isMyTurn} username={opponentPlayer.username} clockMode={gameState.clockMode} />
      </div>

      {/* Opponent's hand */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-green-400">{opponentPlayer.username} — {gameState.opponentCardCount} cards</p>
        <div className="flex gap-1 flex-wrap justify-center">
          {Array.from({ length: gameState.opponentCardCount }).map((_, i) => (
            <div key={i} className="w-10 h-14 rounded-md bg-blue-800 border border-blue-600 shadow" />
          ))}
        </div>
      </div>

      {/* Table: deck + open pile */}
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="flex flex-col items-center gap-1">
          <button
            disabled={!isMyTurn || !!drawnCard}
            onClick={() => draw('deck')}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="w-16 h-24 rounded-lg bg-blue-800 border-2 border-blue-600 flex items-center justify-center shadow-md hover:border-yellow-400 transition-colors cursor-pointer">
              <span className="text-blue-300 text-xs font-mono">{gameState.deckCount}</span>
            </div>
          </button>
          <span className="text-xs text-green-400">Deck</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {gameState.openPile.length > 0 ? (
            <button
              disabled={!isMyTurn || !!drawnCard}
              onClick={() => draw('open')}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="hover:border-yellow-400 transition-colors rounded-lg">
                <CardComponent card={gameState.openPile[0]} />
              </div>
            </button>
          ) : (
            <div className="w-16 h-24 rounded-lg border-2 border-dashed border-green-700" />
          )}
          <span className="text-xs text-green-400">Open Pile</span>
        </div>
      </div>

      {/* Turn indicator */}
      <div className="text-center">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
          isMyTurn ? 'bg-green-700 text-white' : 'bg-felt text-green-400'
        }`}>
          {isMyTurn
            ? iTimedOut
              ? drawnCard ? 'Time\'s up — you must Show!' : 'Time\'s up — draw a card, then Show'
              : discardMode
                ? 'You drew — group cards, then Show or Discard'
                : 'Your turn — draw a card'
            : `${opponentPlayer.username}'s turn`}
        </span>
      </div>

      {/* Timed-out banner */}
      {iTimedOut && (
        <div className="bg-red-900/70 border border-red-500 rounded-xl px-4 py-3 text-center">
          <p className="text-red-300 font-bold text-sm">⏰ Time's up! You can no longer discard.</p>
          <p className="text-red-400 text-xs mt-0.5">
            {drawnCard ? 'Group your cards and click Show to attempt a win.' : 'Draw your card, then Show to attempt a win.'}
          </p>
        </div>
      )}
      {gameState.timedOut && gameState.timedOut !== myPlayer.id && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl px-4 py-2 text-center">
          <p className="text-yellow-300 text-sm">⏰ {opponentPlayer.username}'s time ran out — they must Show.</p>
        </div>
      )}

      {/* Hand — clicking always selects for grouping */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-green-600">
          Click to select • drag to rearrange
        </p>
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
                  isDrawnCard={drawnCard?.id === card.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Discard button — only when drawn a card */}
      {discardMode && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={!canDiscard}
            onClick={() => canDiscard && discard(ungroupedSelected[0])}
            className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
              canDiscard
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
            }`}
          >
            Discard selected card
          </button>
          <span className="text-xs text-green-700">
            {canDiscard
              ? 'Click to discard the selected card and end your turn'
              : ungroupedSelected.length > 1
                ? 'Select only 1 ungrouped card to discard'
                : 'Select 1 ungrouped card to discard'}
          </span>
        </div>
      )}

      {/* Group panel (includes Show button) */}
      <GroupPanel
        selectedCards={selectedCardObjects}
        totalCards={gameState.myHand.length}
        canShow={canShow}
        showBlockedReason={showBlockedReason}
        onShow={show}
        showError={showError}
      />
    </div>
  );
}
