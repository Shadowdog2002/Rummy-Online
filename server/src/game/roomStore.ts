import { GameState } from './types';

const rooms = new Map<string, GameState>();

export function getRoom(roomId: string): GameState | undefined {
  return rooms.get(roomId);
}

export function setRoom(roomId: string, state: GameState): void {
  rooms.set(roomId, state);
}

export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room?.clockInterval) clearInterval(room.clockInterval);
  rooms.delete(roomId);
}

export function listRooms(): GameState[] {
  return Array.from(rooms.values()).filter(r => r.phase === 'ready' || r.phase === 'waiting');
}

export function getAllRooms(): GameState[] {
  return Array.from(rooms.values());
}
