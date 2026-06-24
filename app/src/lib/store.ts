import { create } from 'zustand';
import { Monster } from './constants';

interface GameState {
  // Player
  playerProfile: string | null;
  elo: number;
  wins: number;
  losses: number;

  // Monsters
  monsters: Monster[];
  selectedSquad: Monster[];

  // Battle
  currentBattle: string | null;
  battleState: 'idle' | 'matching' | 'selecting' | 'commit' | 'reveal' | 'finished';

  // Actions
  setPlayerProfile: (profile: string | null) => void;
  setElo: (elo: number) => void;
  addMonster: (monster: Monster) => void;
  removeMonster: (publicKey: string) => void;
  selectSquadMember: (monster: Monster) => void;
  removeSquadMember: (index: number) => void;
  setCurrentBattle: (battle: string | null) => void;
  setBattleState: (state: GameState['battleState']) => void;
  resetBattle: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Initial state
  playerProfile: null,
  elo: 1000,
  wins: 0,
  losses: 0,
  monsters: [],
  selectedSquad: [],
  currentBattle: null,
  battleState: 'idle',

  // Actions
  setPlayerProfile: (profile) => set({ playerProfile: profile }),
  setElo: (elo) => set({ elo }),

  addMonster: (monster) =>
    set((state) => ({ monsters: [...state.monsters, monster] })),

  removeMonster: (publicKey) =>
    set((state) => ({
      monsters: state.monsters.filter((m) => m.publicKey !== publicKey),
    })),

  selectSquadMember: (monster) =>
    set((state) => {
      if (state.selectedSquad.length >= 3) return state;
      if (state.selectedSquad.find((m) => m.publicKey === monster.publicKey)) return state;
      return { selectedSquad: [...state.selectedSquad, monster] };
    }),

  removeSquadMember: (index) =>
    set((state) => ({
      selectedSquad: state.selectedSquad.filter((_, i) => i !== index),
    })),

  setCurrentBattle: (battle) => set({ currentBattle: battle }),
  setBattleState: (battleState) => set({ battleState }),

  resetBattle: () =>
    set({
      currentBattle: null,
      battleState: 'idle',
      selectedSquad: [],
    }),
}));
