import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getRoom, setRoom, deleteRoom, listRooms, getAllRooms } from '../game/roomStore';
import { createDeck } from '../game/deck';
import { validateShow, Group } from '../game/validator';
import { Card, GameState, Player, Rank, RoomSettings } from '../game/types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret';
const TICK_INTERVAL_MS = 100;

const DEFAULT_SETTINGS: RoomSettings = {
  turnTimeMs: 60_000,
  jokerCount: 2,
  clockMode: 'turn',
  totalTimeMs: 60_000,
  incrementMs: 0,
};

interface AuthPayload {
  id: string;
  username: string;
  isGuest: boolean;
}

function buildRoomUpdate(room: GameState) {
  return {
    roomId: room.roomId,
    players: (room.players as Player[]).map(p => ({ id: p.id, username: p.username, ready: p.ready })),
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
  };
}

function broadcastGameState(io: Server, state: GameState) {
  const [p0, p1] = state.players as [Player, Player];

  const sharedFields = {
    roomId: state.roomId,
    phase: state.phase,
    openPile: state.openPile,
    deckCount: state.deck.length,
    currentTurn: state.currentTurn,
    drawnCard: state.drawnCard,
    wildJokerCard: state.wildJokerCard,
    players: [
      { id: p0.id, username: p0.username, timeLeft: p0.timeLeft },
      { id: p1.id, username: p1.username, timeLeft: p1.timeLeft },
    ],
    winner: state.winner,
    clockMode: state.settings.clockMode,
    timedOut: state.timedOut,
  };

  io.to(p0.id).emit('game:state', { ...sharedFields, myHand: p0.hand, opponentCardCount: p1.hand.length });
  io.to(p1.id).emit('game:state', { ...sharedFields, myHand: p1.hand, opponentCardCount: p0.hand.length });
}

function broadcastShowState(io: Server, room: GameState) {
  const players = room.players as [Player, Player];
  const showingPlayerIdx = players.findIndex(p => p.id === room.showingPlayerId);
  if (showingPlayerIdx === -1) return;
  const showingPlayer = players[showingPlayerIdx];

  const payload = {
    roomId: room.roomId,
    phase: room.phase,
    showingPlayerId: room.showingPlayerId,
    showingHand: showingPlayer.hand,
    showGroups: room.showGroups,
    showHandOrder: room.showHandOrder,
    wildJokerCard: room.wildJokerCard,
    winner: room.winner,
    players: [
      { id: players[0].id, username: players[0].username },
      { id: players[1].id, username: players[1].username },
    ],
    showValidateError: room.showValidateError,
  };

  io.to(room.roomId).emit('game:showState', payload);
}

function startClock(io: Server, state: GameState) {
  if (state.clockInterval) clearInterval(state.clockInterval);

  state.clockInterval = setInterval(() => {
    const room = getRoom(state.roomId);
    if (!room || room.phase !== 'playing') {
      clearInterval(state.clockInterval!);
      return;
    }

    const players = room.players as [Player, Player];
    const currentPlayer = players[room.currentTurn];
    currentPlayer.timeLeft -= TICK_INTERVAL_MS;

    if (currentPlayer.timeLeft <= 0) {
      currentPlayer.timeLeft = 0;

      if (room.settings.clockMode === 'countdown') {
        // Countdown mode: player ran out of time → they must Show (cannot discard)
        clearInterval(state.clockInterval!);
        room.clockInterval = null;
        room.timedOut = currentPlayer.id;
        setRoom(room.roomId, room);
        broadcastGameState(io, room);
      } else {
        // Per-turn mode: auto-discard and pass turn
        if (room.drawnCard) {
          room.openPile.unshift(room.drawnCard);
          currentPlayer.hand = currentPlayer.hand.filter(c => c.id !== room.drawnCard!.id);
          room.drawnCard = null;
        } else if (currentPlayer.hand.length > 0) {
          const randomIdx = Math.floor(Math.random() * currentPlayer.hand.length);
          const [discarded] = currentPlayer.hand.splice(randomIdx, 1);
          room.openPile.unshift(discarded);
        }
        room.currentTurn = room.currentTurn === 0 ? 1 : 0;
        const next = players[room.currentTurn];
        next.timeLeft = room.settings.turnTimeMs;
        setRoom(room.roomId, room);
        broadcastGameState(io, room);
      }
    } else {
      setRoom(room.roomId, room);
      players.forEach(p => {
        io.to(p.id).emit('game:clock', {
          players: players.map(pl => ({
            id: pl.id,
            timeLeft: pl.timeLeft,
          })),
          currentTurn: room.currentTurn,
        });
      });
    }
  }, TICK_INTERVAL_MS);
}

function startGame(io: Server, state: GameState) {
  const deck = createDeck(state.settings.jokerCount);

  let wildJokerCard: Card | null = null;

  const [p0, p1] = state.players as [Player, Player];
  p0.hand = deck.splice(0, 13);
  p1.hand = deck.splice(0, 13);

  for (let i = 0; i < deck.length; i++) {
    if (!deck[i].isJoker) {
      wildJokerCard = deck.splice(i, 1)[0];
      break;
    }
  }

  const firstOpen = deck.shift()!;
  state.deck = deck;
  state.openPile = [firstOpen];
  state.wildJokerCard = wildJokerCard;
  state.phase = 'playing';
  state.currentTurn = 0;
  state.drawnCard = null;
  const startTime = state.settings.clockMode === 'countdown'
    ? state.settings.totalTimeMs
    : state.settings.turnTimeMs;
  p0.timeLeft = startTime;
  p1.timeLeft = startTime;

  setRoom(state.roomId, state);
  broadcastGameState(io, state);
  if (state.settings.clockMode === 'turn') {
    startClock(io, state);
  }
  // countdown mode: clock starts on first draw
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      (socket as Socket & { user: AuthPayload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as Socket & { user: AuthPayload }).user;
    console.log(`Connected: ${user.username} (${socket.id})`);

    socket.emit('lobby:rooms', listRooms().map(r => ({
      roomId: r.roomId,
      players: (r.players as Player[]).map(p => p.username),
    })));

    socket.on('room:create', () => {
      const roomId = uuidv4().slice(0, 6).toUpperCase();
      const player: Player = {
        id: socket.id,
        username: user.username,
        hand: [],
        timeLeft: DEFAULT_SETTINGS.turnTimeMs,
        ready: false,
      };
      const state: GameState = {
        roomId,
        phase: 'waiting',
        players: [player],
        deck: [],
        openPile: [],
        currentTurn: 0,
        drawnCard: null,
        wildJokerCard: null,
        clockInterval: null,
        winner: null,
        hostId: socket.id,
        settings: { ...DEFAULT_SETTINGS },
        showingPlayerId: null,
        showGroups: [],
        showHandOrder: [],
        showValidateError: null,
        timedOut: null,
      };
      setRoom(roomId, state);
      socket.join(roomId);
      socket.emit('room:created', { roomId });
      socket.emit('room:update', buildRoomUpdate(state));
      io.emit('lobby:rooms', listRooms().map(r => ({
        roomId: r.roomId,
        players: (r.players as Player[]).map(p => p.username),
      })));
    });

    socket.on('room:join', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room) { socket.emit('room:error', 'Room not found'); return; }
      if (room.players.length >= 2) { socket.emit('room:error', 'Room is full'); return; }
      if (room.phase === 'playing' || room.phase === 'finished') {
        socket.emit('room:error', 'Game already in progress'); return;
      }

      const player: Player = {
        id: socket.id,
        username: user.username,
        hand: [],
        timeLeft: room.settings.turnTimeMs,
        ready: false,
      };
      (room.players as Player[]).push(player);
      room.phase = 'ready';
      setRoom(roomId, room);
      socket.join(roomId);

      io.to(roomId).emit('room:update', buildRoomUpdate(room));
      io.emit('lobby:rooms', listRooms().map(r => ({
        roomId: r.roomId,
        players: (r.players as Player[]).map(p => p.username),
      })));
    });

    socket.on('room:settings', ({ roomId, settings }: { roomId: string; settings: Partial<RoomSettings> }) => {
      const room = getRoom(roomId);
      if (!room) return;
      if (room.hostId !== socket.id) return;
      if (room.phase === 'playing' || room.phase === 'showing' || room.phase === 'finished') return;

      if (settings.turnTimeMs !== undefined) {
        room.settings.turnTimeMs = Math.max(10_000, Math.min(300_000, settings.turnTimeMs));
      }
      if (settings.jokerCount !== undefined) {
        room.settings.jokerCount = Math.max(0, Math.min(4, settings.jokerCount));
      }
      if (settings.clockMode === 'turn' || settings.clockMode === 'countdown') {
        room.settings.clockMode = settings.clockMode;
      }
      if (settings.totalTimeMs !== undefined) {
        room.settings.totalTimeMs = Math.max(10_000, Math.min(600_000, settings.totalTimeMs));
      }
      if (settings.incrementMs !== undefined) {
        room.settings.incrementMs = Math.max(0, Math.min(60_000, settings.incrementMs));
      }
      setRoom(roomId, room);
      io.to(roomId).emit('room:update', buildRoomUpdate(room));
    });

    socket.on('room:ready', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'ready') return;

      const player = (room.players as Player[]).find(p => p.id === socket.id);
      if (!player) return;
      player.ready = true;
      setRoom(roomId, room);

      io.to(roomId).emit('room:update', buildRoomUpdate(room));

      if ((room.players as Player[]).every(p => p.ready)) {
        startGame(io, room);
      }
    });

    socket.on('game:draw', ({ roomId, source }: { roomId: string; source: 'deck' | 'open' }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'playing') return;
      const players = room.players as [Player, Player];
      if (players[room.currentTurn].id !== socket.id) return;
      if (room.drawnCard) return;

      let card: Card | undefined;
      if (source === 'deck') {
        if (room.deck.length === 0) {
          const top = room.openPile.shift()!;
          room.deck = room.openPile.reverse();
          room.openPile = [top];
        }
        card = room.deck.shift();
      } else {
        card = room.openPile.shift();
      }

      if (!card) return;

      players[room.currentTurn].hand.push(card);
      room.drawnCard = card;
      setRoom(roomId, room);
      broadcastGameState(io, room);

      // countdown mode: start clock on first draw (clockInterval is null until then)
      if (room.settings.clockMode === 'countdown' && !room.clockInterval) {
        startClock(io, room);
      }
    });

    socket.on('game:discard', ({ roomId, cardId }: { roomId: string; cardId: string }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'playing') return;
      const players = room.players as [Player, Player];
      if (players[room.currentTurn].id !== socket.id) return;
      if (!room.drawnCard) return;
      if (room.timedOut === socket.id) return; // timed-out player must Show

      const currentPlayer = players[room.currentTurn];
      const idx = currentPlayer.hand.findIndex(c => c.id === cardId);
      if (idx === -1) return;

      const [discarded] = currentPlayer.hand.splice(idx, 1);
      room.openPile.unshift(discarded);
      room.drawnCard = null;

      if (room.settings.clockMode === 'countdown') {
        // Add increment to the player who just finished their turn
        currentPlayer.timeLeft += room.settings.incrementMs;
      }

      room.currentTurn = room.currentTurn === 0 ? 1 : 0;

      if (room.settings.clockMode === 'turn') {
        players[room.currentTurn].timeLeft = room.settings.turnTimeMs;
      }

      setRoom(roomId, room);
      broadcastGameState(io, room);
      startClock(io, room);
    });

    // ── Show mechanic ──────────────────────────────────────────────

    socket.on('game:startShow', ({ roomId, groups, handOrder }: { roomId: string; groups: Group[]; handOrder?: string[] }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'playing') return;
      const players = room.players as [Player, Player];
      if (players[room.currentTurn].id !== socket.id) return;
      if (!room.drawnCard) return;

      // Stop the clock
      if (room.clockInterval) clearInterval(room.clockInterval);
      room.clockInterval = null;

      const showingPlayer = players[room.currentTurn];
      room.phase = 'showing';
      room.showingPlayerId = socket.id;
      room.showGroups = groups ?? [];
      const handIds = new Set(showingPlayer.hand.map(c => c.id));
      const validOrder = (handOrder ?? []).filter(id => handIds.has(id));
      const remaining = showingPlayer.hand.map(c => c.id).filter(id => !validOrder.includes(id));
      room.showHandOrder = [...validOrder, ...remaining];
      room.showValidateError = null;

      setRoom(roomId, room);
      broadcastShowState(io, room);
    });

    socket.on('game:showGroups', ({ roomId, groups }: { roomId: string; groups: Group[] }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'showing') return;
      if (room.showingPlayerId !== socket.id) return;

      room.showGroups = groups;
      room.showValidateError = null;
      setRoom(roomId, room);
      broadcastShowState(io, room);
    });

    socket.on('game:showHandOrder', ({ roomId, handOrder }: { roomId: string; handOrder: string[] }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'showing') return;
      if (room.showingPlayerId !== socket.id) return;

      room.showHandOrder = handOrder;
      setRoom(roomId, room);
      broadcastShowState(io, room);
    });

    socket.on('game:validateShow', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'showing') return;
      if (room.showingPlayerId !== socket.id) return;

      const players = room.players as [Player, Player];
      const showingPlayerIdx = players.findIndex(p => p.id === socket.id);
      const showingPlayer = players[showingPlayerIdx];
      const wildRank = room.wildJokerCard?.rank ?? null;
      const result = validateShow(room.showGroups, showingPlayer.hand, wildRank);

      if (!result.valid) {
        room.showValidateError = result.error ?? 'Invalid groups';
        setRoom(roomId, room);
        broadcastShowState(io, room);
        return;
      }

      // Valid — winner declared
      room.phase = 'finished';
      room.winner = socket.id;
      room.showValidateError = null;
      setRoom(roomId, room);
      broadcastShowState(io, room);
    });

    socket.on('game:giveUp', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'showing') return;
      if (room.showingPlayerId !== socket.id) return;

      const players = room.players as [Player, Player];
      const loserIdx = players.findIndex(p => p.id === socket.id);
      const winnerIdx = loserIdx === 0 ? 1 : 0;

      room.phase = 'finished';
      room.winner = players[winnerIdx].id;
      room.showValidateError = null;
      setRoom(roomId, room);
      broadcastShowState(io, room);
    });

    // ── Legacy show (remove — replaced by startShow) ───────────────
    // game:show is no longer used; game:startShow replaces it.

    socket.on('game:forfeit', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room || (room.phase !== 'playing' && room.phase !== 'showing')) return;
      const players = room.players as [Player, Player];
      const loserIndex = players.findIndex(p => p.id === socket.id);
      if (loserIndex === -1) return;

      room.phase = 'finished';
      if (room.clockInterval) clearInterval(room.clockInterval);

      const winnerIndex = loserIndex === 0 ? 1 : 0;
      const winner = players[winnerIndex];
      room.winner = winner.id;
      setRoom(roomId, room);

      io.to(roomId).emit('game:over', {
        winner: winner.id,
        winnerUsername: winner.username,
        reason: 'opponent_left',
      });
      deleteRoom(roomId);
      io.emit('lobby:rooms', listRooms().map(r => ({
        roomId: r.roomId,
        players: (r.players as Player[]).map(p => p.username),
      })));
    });

    socket.on('game:request_state', ({ roomId }: { roomId: string }) => {
      const room = getRoom(roomId);
      if (!room) return;

      if (room.phase === 'showing' || room.phase === 'finished') {
        // Reconnecting during show — send show state
        if (room.showingPlayerId) {
          broadcastShowState(io, room);
        }
        return;
      }

      if (room.phase !== 'playing') return;
      const players = room.players as [Player, Player];
      const playerIndex = players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;

      const me = players[playerIndex];
      const opponent = players[playerIndex === 0 ? 1 : 0];
      socket.emit('game:state', {
        roomId: room.roomId,
        phase: room.phase,
        myHand: me.hand,
        opponentCardCount: opponent.hand.length,
        openPile: room.openPile,
        deckCount: room.deck.length,
        currentTurn: room.currentTurn,
        drawnCard: room.drawnCard,
        wildJokerCard: room.wildJokerCard,
        players: [
          { id: players[0].id, username: players[0].username, timeLeft: players[0].timeLeft },
          { id: players[1].id, username: players[1].username, timeLeft: players[1].timeLeft },
        ],
        winner: room.winner,
        clockMode: room.settings.clockMode,
        timedOut: room.timedOut,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${user.username}`);
      for (const room of getAllRooms()) {
        const inRoom = (room.players as Player[]).some(p => p.id === socket.id);
        if (!inRoom) continue;

        if (room.phase === 'playing' || room.phase === 'showing') {
          room.phase = 'finished';
          const opponent = (room.players as Player[]).find(p => p.id !== socket.id);
          room.winner = opponent?.id ?? null;
          if (room.clockInterval) clearInterval(room.clockInterval);
          io.to(room.roomId).emit('game:over', {
            winner: room.winner,
            winnerUsername: opponent?.username ?? 'Opponent',
            reason: 'opponent_disconnected',
          });
        }
        deleteRoom(room.roomId);
        io.emit('lobby:rooms', listRooms().map(r => ({
          roomId: r.roomId,
          players: (r.players as Player[]).map(p => p.username),
        })));
      }
    });
  });
}
