import { create } from 'zustand';
import { GameState, LobbyRoom, Group, GroupType } from '../types';

function groupPrefix(type: GroupType): string {
  return type === 'life' ? 'L' : type === 'secondLife' ? 'S' : 'T';
}

function assignNames(groups: Group[]): Group[] {
  const counts: Record<GroupType, number> = { life: 0, secondLife: 0, triplet: 0 };
  return groups.map(g => {
    counts[g.type]++;
    return { ...g, name: `${groupPrefix(g.type)}${counts[g.type]}` };
  });
}

interface GameStoreState {
  gameState: GameState | null;
  lobbyRooms: LobbyRoom[];
  currentRoomId: string | null;
  selectedCards: string[]; // card ids selected for grouping
  groups: Group[];
  showError: string | null;
  gameOverInfo: { winner: string; winnerUsername: string; reason?: string } | null;

  setGameState: (state: GameState) => void;
  updateClock: (players: { id: string; timeLeft: number }[], currentTurn: number) => void;
  setLobbyRooms: (rooms: LobbyRoom[]) => void;
  setCurrentRoom: (roomId: string | null) => void;
  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  addGroup: (group: Group) => void;
  removeGroup: (index: number) => void;
  setShowError: (error: string | null) => void;
  setGameOver: (info: { winner: string; winnerUsername: string; reason?: string } | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: null,
  lobbyRooms: [],
  currentRoomId: null,
  selectedCards: [],
  groups: [],
  showError: null,
  gameOverInfo: null,

  setGameState: (state) => set({ gameState: state }),
  updateClock: (players, currentTurn) =>
    set((s) => {
      if (!s.gameState) return {};
      return {
        gameState: {
          ...s.gameState,
          currentTurn,
          players: s.gameState.players.map((p) => ({
            ...p,
            timeLeft: players.find(pl => pl.id === p.id)?.timeLeft ?? p.timeLeft,
          })) as [typeof s.gameState.players[0], typeof s.gameState.players[1]],
        },
      };
    }),
  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),
  setCurrentRoom: (roomId) => set({ currentRoomId: roomId }),
  toggleCardSelection: (cardId) =>
    set((s) => ({
      selectedCards: s.selectedCards.includes(cardId)
        ? s.selectedCards.filter(id => id !== cardId)
        : [...s.selectedCards, cardId],
    })),
  clearSelection: () => set({ selectedCards: [] }),
  addGroup: (group) =>
    set((s) => ({ groups: assignNames([...s.groups, group]), selectedCards: [] })),
  removeGroup: (index) =>
    set((s) => ({ groups: assignNames(s.groups.filter((_, i) => i !== index)) })),
  setShowError: (error) => set({ showError: error }),
  setGameOver: (info) => set({ gameOverInfo: info }),
  resetGame: () =>
    set({
      gameState: null,
      currentRoomId: null,
      selectedCards: [],
      groups: [],
      showError: null,
      gameOverInfo: null,
    }),
}));
