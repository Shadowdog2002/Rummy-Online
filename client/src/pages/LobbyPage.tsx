import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { getSocket, disconnectSocket } from '../socket';
import { LobbyRoom, GameState } from '../types';

const TURN_TIME_OPTIONS = [30, 45, 60, 90, 120, 180, 300]; // seconds
const COUNTDOWN_TIME_OPTIONS = [30, 45, 60, 90]; // seconds per player
const INCREMENT_OPTIONS = [0, 1, 3, 5, 10]; // seconds added after each turn

interface RoomUpdateInfo {
  roomId: string;
  players: { id: string; username: string; ready: boolean }[];
  phase: string;
  hostId: string;
  settings: {
    turnTimeMs: number;
    jokerCount: number;
    clockMode: 'turn' | 'countdown';
    totalTimeMs: number;
    incrementMs: number;
  };
}

export default function LobbyPage() {
  const { user, clearAuth } = useAuthStore();
  const { lobbyRooms, setLobbyRooms, setCurrentRoom, setGameState, resetGame } = useGameStore();
  const [joinId, setJoinId] = useState('');
  const [roomUpdateInfo, setRoomUpdateInfo] = useState<RoomUpdateInfo | null>(null);
  const [error, setError] = useState('');
  const [mySocketId, setMySocketId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    resetGame();
    const socket = getSocket();

    setMySocketId(socket.id ?? '');
    socket.on('connect', () => setMySocketId(socket.id ?? ''));

    socket.on('lobby:rooms', (rooms: LobbyRoom[]) => {
      setLobbyRooms(rooms);
    });

    socket.on('room:created', ({ roomId }: { roomId: string }) => {
      setCurrentRoom(roomId);
    });

    socket.on('room:update', (info: RoomUpdateInfo) => {
      setRoomUpdateInfo(info);
      setCurrentRoom(info.roomId);
    });

    socket.on('room:error', (msg: string) => setError(msg));

    socket.on('game:state', (state: GameState) => {
      setGameState(state);
      setCurrentRoom(state.roomId);
      navigate(`/game/${state.roomId}`);
    });

    return () => {
      socket.off('lobby:rooms');
      socket.off('room:created');
      socket.off('room:update');
      socket.off('room:error');
      socket.off('connect');
      socket.off('game:state');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createRoom() {
    setError('');
    getSocket().emit('room:create');
  }

  function joinRoom() {
    setError('');
    if (!joinId.trim()) { setError('Enter a room code'); return; }
    getSocket().emit('room:join', { roomId: joinId.trim().toUpperCase() });
  }

  function joinFromList(roomId: string) {
    setError('');
    getSocket().emit('room:join', { roomId });
  }

  function markReady() {
    const roomId = useGameStore.getState().currentRoomId;
    if (roomId) getSocket().emit('room:ready', { roomId });
  }

  function logout() {
    disconnectSocket();
    clearAuth();
    navigate('/');
  }

  function emitSetting(partial: object) {
    if (!roomUpdateInfo) return;
    getSocket().emit('room:settings', { roomId: roomUpdateInfo.roomId, settings: partial });
  }

  const myInfo = roomUpdateInfo?.players.find(p => p.id === mySocketId);
  const isHost = roomUpdateInfo?.hostId === mySocketId;
  const canEditSettings = isHost;

  return (
    <div className="min-h-screen flex flex-col items-center pt-16 px-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-yellow-400">Lobby</h1>
          <div className="flex items-center gap-4">
            <span className="text-green-300 text-sm">
              {user?.username} {user?.isGuest ? '(guest)' : ''}
            </span>
            <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">
              Logout
            </button>
          </div>
        </div>

        {/* In-room panel */}
        {roomUpdateInfo && (
          <div className="bg-felt rounded-xl p-6 mb-6 border border-green-600">
            <h2 className="text-lg font-semibold mb-3">
              Room <span className="text-yellow-400 font-mono">{roomUpdateInfo.roomId}</span>
              {isHost && <span className="ml-2 text-xs text-green-500">(you are host)</span>}
            </h2>
            <div className="space-y-2 mb-4">
              {roomUpdateInfo.players.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-felt-dark px-4 py-2 rounded-lg">
                  <span>{p.username} {p.id === mySocketId ? '(you)' : ''}</span>
                  <span className={p.ready ? 'text-green-400' : 'text-yellow-400'}>
                    {p.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
              {roomUpdateInfo.players.length < 2 && (
                <div className="text-green-600 text-sm px-4 py-2">Waiting for opponent...</div>
              )}
            </div>

            {/* Settings */}
            <div className="border-t border-green-700 pt-3 mb-4 space-y-3">
              <p className="text-xs font-semibold text-green-300 uppercase tracking-wide">
                Room Settings {!canEditSettings && <span className="text-green-700 normal-case">(host only)</span>}
              </p>

              {/* Clock mode */}
              <div>
                <p className="text-xs text-green-400 mb-1">Clock Mode</p>
                <div className="flex gap-1">
                  {(['turn', 'countdown'] as const).map(mode => (
                    <button
                      key={mode}
                      disabled={!canEditSettings}
                      onClick={() => emitSetting({ clockMode: mode })}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        roomUpdateInfo.settings.clockMode === mode
                          ? 'bg-yellow-400 text-felt-dark'
                          : canEditSettings
                            ? 'bg-felt-dark text-green-400 border border-green-700 hover:border-yellow-400'
                            : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
                      }`}
                    >
                      {mode === 'turn' ? 'Per-Turn Timer' : 'Countdown Clock'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-turn mode: turn time */}
              {roomUpdateInfo.settings.clockMode === 'turn' && (
                <div>
                  <p className="text-xs text-green-400 mb-1">
                    Turn Time: <span className="text-yellow-400 font-bold">{roomUpdateInfo.settings.turnTimeMs / 1000}s</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {TURN_TIME_OPTIONS.map(s => (
                      <button
                        key={s}
                        disabled={!canEditSettings}
                        onClick={() => emitSetting({ turnTimeMs: s * 1000 })}
                        className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                          roomUpdateInfo.settings.turnTimeMs === s * 1000
                            ? 'bg-yellow-400 text-felt-dark'
                            : canEditSettings
                              ? 'bg-felt-dark text-green-400 border border-green-700 hover:border-yellow-400'
                              : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Countdown mode: total time + increment */}
              {roomUpdateInfo.settings.clockMode === 'countdown' && (
                <>
                  <div>
                    <p className="text-xs text-green-400 mb-1">
                      Time per Player: <span className="text-yellow-400 font-bold">{roomUpdateInfo.settings.totalTimeMs / 1000}s</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {COUNTDOWN_TIME_OPTIONS.map(s => (
                        <button
                          key={s}
                          disabled={!canEditSettings}
                          onClick={() => emitSetting({ totalTimeMs: s * 1000 })}
                          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                            roomUpdateInfo.settings.totalTimeMs === s * 1000
                              ? 'bg-yellow-400 text-felt-dark'
                              : canEditSettings
                                ? 'bg-felt-dark text-green-400 border border-green-700 hover:border-yellow-400'
                                : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-green-400 mb-1">
                      Increment per Turn: <span className="text-yellow-400 font-bold">+{roomUpdateInfo.settings.incrementMs / 1000}s</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {INCREMENT_OPTIONS.map(s => (
                        <button
                          key={s}
                          disabled={!canEditSettings}
                          onClick={() => emitSetting({ incrementMs: s * 1000 })}
                          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                            roomUpdateInfo.settings.incrementMs === s * 1000
                              ? 'bg-yellow-400 text-felt-dark'
                              : canEditSettings
                                ? 'bg-felt-dark text-green-400 border border-green-700 hover:border-yellow-400'
                                : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
                          }`}
                        >
                          +{s}s
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Joker count */}
              <div>
                <p className="text-xs text-green-400 mb-1">
                  Printed Jokers: <span className="text-yellow-400 font-bold">{roomUpdateInfo.settings.jokerCount}</span>
                </p>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      disabled={!canEditSettings}
                      onClick={() => emitSetting({ jokerCount: n })}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        roomUpdateInfo.settings.jokerCount === n
                          ? 'bg-yellow-400 text-felt-dark'
                          : canEditSettings
                            ? 'bg-felt-dark text-green-400 border border-green-700 hover:border-yellow-400'
                            : 'bg-felt-dark text-green-800 border border-green-900 cursor-not-allowed'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-green-700 mt-1">
                  +1 wild joker rank always picked from deck
                </p>
              </div>
            </div>

            {!myInfo?.ready && roomUpdateInfo.players.length === 2 && (
              <button
                onClick={markReady}
                className="w-full py-2 bg-green-500 hover:bg-green-400 text-white font-bold rounded-lg"
              >
                I'm Ready!
              </button>
            )}
            {myInfo?.ready && (
              <p className="text-center text-green-400 font-medium">
                Waiting for opponent to ready up...
              </p>
            )}
          </div>
        )}

        {!roomUpdateInfo && (
          <>
            {/* Create room */}
            <div className="bg-felt rounded-xl p-6 mb-4">
              <h2 className="text-lg font-semibold mb-3">Create a Room</h2>
              <button
                onClick={createRoom}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-felt-dark font-bold rounded-lg"
              >
                + Create Room
              </button>
            </div>

            {/* Join by code */}
            <div className="bg-felt rounded-xl p-6 mb-4">
              <h2 className="text-lg font-semibold mb-3">Join by Room Code</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AB12C3"
                  value={joinId}
                  onChange={e => setJoinId(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2 rounded-lg bg-felt-dark text-white placeholder-green-700 border border-green-700 focus:outline-none focus:border-yellow-400 font-mono uppercase"
                  maxLength={6}
                />
                <button
                  onClick={joinRoom}
                  className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-felt-dark font-bold rounded-lg"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Open rooms */}
            <div className="bg-felt rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Open Rooms</h2>
              {lobbyRooms.length === 0 ? (
                <p className="text-green-600 text-sm">No open rooms yet.</p>
              ) : (
                <div className="space-y-2">
                  {lobbyRooms.map(r => (
                    <div key={r.roomId} className="flex items-center justify-between bg-felt-dark px-4 py-3 rounded-lg">
                      <div>
                        <span className="font-mono text-yellow-400 mr-3">{r.roomId}</span>
                        <span className="text-sm text-green-300">{r.players.join(', ')}</span>
                      </div>
                      <button
                        onClick={() => joinFromList(r.roomId)}
                        className="text-sm px-4 py-1 bg-green-600 hover:bg-green-500 rounded-lg"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="mt-4 text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
