// src/stores/typingPaymentStore.ts
// ✅ INSPIRED BY: on-chain-chess/src/stores/paymentStore.ts
// Pattern: Zustand store for centralized payment state management

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { formatEther } from "viem";

export interface TypingRoomInfo {
  host: string;
  betAmount: bigint;
  playerCount: number;
  gameStarted: boolean;
  gameEnded: boolean;
  winner: string;
  totalPot: bigint;
  rewardClaimed: boolean;
}

export interface PlayerStatus {
  hasJoined: boolean;
  hasFinished: boolean;
  finishTime: number;
  isPaid: boolean;
}

export interface TypingPaymentState {
  // 🎮 Room & Game State
  roomId: string | null;
  roomInfo: TypingRoomInfo | null;
  
  // 👥 Player Management
  currentPlayer: string | null;
  playerStatus: PlayerStatus;
  allPlayers: Record<string, PlayerStatus>;
  
  // 💰 Payment Status
  bettingEnabled: boolean;
  currentPlayerPaid: boolean;
  canJoin: boolean;
  canSettle: boolean;
  canClaim: boolean;
  
  // 🔄 Transaction Status
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  lastTxHash: string | null;
  
  // 🎯 Game Flow State (On-Chain Chess Pattern)
  gamePhase: 'waiting' | 'playing' | 'finished' | 'settled';
  settlementNeeded: boolean;
  autoPayoutReceived: boolean;
  
  // 🐛 Debug Info
  debugInfo: {
    contractBalance: string;
    eventHistory: string[];
    lastError: string | null;
    transactionCount: number;
  };
  
  // 🔧 Actions
  setRoomId: (roomId: string | null) => void;
  setRoomInfo: (roomInfo: TypingRoomInfo | null) => void;
  setCurrentPlayer: (address: string | null) => void;
  updatePlayerStatus: (address: string, status: Partial<PlayerStatus>) => void;
  setTransactionStatus: (status: Partial<Pick<TypingPaymentState, 'isPending' | 'isConfirming' | 'isConfirmed' | 'lastTxHash'>>) => void;
  setGamePhase: (phase: TypingPaymentState['gamePhase']) => void;
  setAutoPayoutReceived: (received: boolean) => void;
  addDebugEvent: (event: string) => void;
  setDebugError: (error: string | null) => void;
  incrementTransactionCount: () => void;
  updateContractBalance: (balance: string) => void;
  computedState: () => ComputedState;
  reset: () => void;
}

interface ComputedState {
  // 🎯 On-Chain Chess Pattern: Smart state computation
  isHost: boolean;
  isPlayer: boolean;
  isWinner: boolean;
  bothPlayersPaid: boolean;
  totalPotFormatted: string;
  betAmountFormatted: string;
  needsGasOptimization: boolean;
  transactionEfficiency: string;
}

const initialState = {
  roomId: null,
  roomInfo: null,
  currentPlayer: null,
  playerStatus: {
    hasJoined: false,
    hasFinished: false,
    finishTime: 0,
    isPaid: false,
  },
  allPlayers: {},
  bettingEnabled: false,
  currentPlayerPaid: false,
  canJoin: false,
  canSettle: false,
  canClaim: false,
  isPending: false,
  isConfirming: false,
  isConfirmed: false,
  lastTxHash: null,
  gamePhase: 'waiting' as const,
  settlementNeeded: false,
  autoPayoutReceived: false,
  debugInfo: {
    contractBalance: '0',
    eventHistory: [],
    lastError: null,
    transactionCount: 0,
  },
};

export const useTypingPaymentStore = create<TypingPaymentState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setRoomId: (roomId) => {
      set({ roomId });
      if (!roomId) {
        get().reset();
      }
    },

    setRoomInfo: (roomInfo) => {
      set({ roomInfo });
      
      if (roomInfo) {
        // ✅ Auto-update betting status
        const bettingEnabled = roomInfo.betAmount > BigInt(0);
        set({ bettingEnabled });
        
        // ✅ Update game phase based on contract state
        if (roomInfo.gameEnded) {
          set({ gamePhase: roomInfo.rewardClaimed ? 'settled' : 'finished' });
        } else if (roomInfo.gameStarted) {
          set({ gamePhase: 'playing' });
        } else {
          set({ gamePhase: 'waiting' });
        }
        
        // ✅ Check if auto payout was received
        if (roomInfo.gameEnded && roomInfo.rewardClaimed && roomInfo.winner !== '0x0000000000000000000000000000000000000000') {
          set({ autoPayoutReceived: true });
          get().addDebugEvent(`🎉 Auto-payout detected for winner: ${roomInfo.winner.slice(0, 8)}`);
        }
      }
    },

    setCurrentPlayer: (address) => {
      set({ currentPlayer: address });
      
      if (address && get().roomInfo) {
        // ✅ Update player-specific permissions
        const roomInfo = get().roomInfo!;
        const isHost = roomInfo.host.toLowerCase() === address.toLowerCase();
        const isWinner = roomInfo.winner.toLowerCase() === address.toLowerCase();
        const playerStatus = get().allPlayers[address] || get().playerStatus;
        
        set({
          canJoin: !roomInfo.gameStarted && !playerStatus.hasJoined,
          canSettle: isWinner && roomInfo.gameEnded && !roomInfo.rewardClaimed,
          canClaim: isWinner && roomInfo.gameEnded,
          currentPlayerPaid: playerStatus.isPaid,
        });
      }
    },

    updatePlayerStatus: (address, status) => {
      set((state) => ({
        allPlayers: {
          ...state.allPlayers,
          [address]: { ...state.allPlayers[address], ...status }
        }
      }));
      
      // ✅ Update current player status if it's the same address
      if (address === get().currentPlayer) {
        set((state) => ({
          playerStatus: { ...state.playerStatus, ...status }
        }));
      }
    },

    setTransactionStatus: (status) => {
      set((state) => ({ ...state, ...status }));
      
      // ✅ Auto-increment transaction count
      if (status.isPending) {
        get().incrementTransactionCount();
      }
    },

    setGamePhase: (phase) => {
      set({ gamePhase: phase });
      
      // ✅ Update settlement status
      if (phase === 'finished') {
        const { currentPlayer, roomInfo } = get();
        if (currentPlayer && roomInfo && roomInfo.winner.toLowerCase() === currentPlayer.toLowerCase()) {
          set({ settlementNeeded: true });
        }
      }
    },

    setAutoPayoutReceived: (received) => {
      set({ autoPayoutReceived: received });
      if (received) {
        set({ settlementNeeded: false, gamePhase: 'settled' });
        get().addDebugEvent('✅ Auto-payout confirmed received');
      }
    },

    addDebugEvent: (event) => {
      set((state) => ({
        debugInfo: {
          ...state.debugInfo,
          eventHistory: [
            `[${new Date().toLocaleTimeString()}] ${event}`,
            ...state.debugInfo.eventHistory.slice(0, 9) // Keep last 10 events
          ]
        }
      }));
    },

    setDebugError: (error) => {
      set((state) => ({
        debugInfo: { ...state.debugInfo, lastError: error }
      }));
    },

    incrementTransactionCount: () => {
      set((state) => ({
        debugInfo: { 
          ...state.debugInfo, 
          transactionCount: state.debugInfo.transactionCount + 1 
        }
      }));
    },

    updateContractBalance: (balance) => {
      set((state) => ({
        debugInfo: { ...state.debugInfo, contractBalance: balance }
      }));
    },

    // ✅ ON-CHAIN CHESS PATTERN: Computed state
    computedState: () => {
      const state = get();
      const { roomInfo, currentPlayer, debugInfo } = state;
      
      if (!roomInfo || !currentPlayer) {
        return {
          isHost: false,
          isPlayer: false,
          isWinner: false,
          bothPlayersPaid: true,
          totalPotFormatted: '0',
          betAmountFormatted: '0',
          needsGasOptimization: false,
          transactionEfficiency: 'N/A'
        };
      }
      
      const isHost = roomInfo.host.toLowerCase() === currentPlayer.toLowerCase();
      const isWinner = roomInfo.winner.toLowerCase() === currentPlayer.toLowerCase();
      const playerStatus = state.allPlayers[currentPlayer] || state.playerStatus;
      
      // ✅ Gas optimization analysis
      const needsGasOptimization = debugInfo.transactionCount > 3;
      const efficiency = debugInfo.transactionCount <= 2 ? 'Optimal ⚡' : 
                        debugInfo.transactionCount <= 3 ? 'Good ✅' : 'Needs Optimization ⚠️';
      
      return {
        isHost,
        isPlayer: playerStatus.hasJoined,
        isWinner,
        bothPlayersPaid: roomInfo.playerCount >= 2, // Simplified for typing game
        totalPotFormatted: formatEther(roomInfo.totalPot),
        betAmountFormatted: formatEther(roomInfo.betAmount),
        needsGasOptimization,
        transactionEfficiency: efficiency
      };
    },

    reset: () => set(initialState),
  }))
);

// ✅ CONVENIENT SELECTORS (On-Chain Chess Pattern)
export const useRoomInfo = () => useTypingPaymentStore((state) => state.roomInfo);
export const useGamePhase = () => useTypingPaymentStore((state) => state.gamePhase);
export const useAutoPayoutStatus = () => useTypingPaymentStore((state) => state.autoPayoutReceived);
export const useCanSettle = () => useTypingPaymentStore((state) => state.canSettle);
export const useTransactionStatus = () => useTypingPaymentStore((state) => ({ 
  isPending: state.isPending, 
  isConfirming: state.isConfirming, 
  hash: state.lastTxHash 
}));
export const useDebugInfo = () => useTypingPaymentStore((state) => state.debugInfo);
export const useComputedState = () => useTypingPaymentStore((state) => state.computedState());

// ✅ ACTION SHORTCUTS
export const useTypingPaymentActions = () => useTypingPaymentStore((state) => ({
  setRoomInfo: state.setRoomInfo,
  setCurrentPlayer: state.setCurrentPlayer,
  updatePlayerStatus: state.updatePlayerStatus,
  setTransactionStatus: state.setTransactionStatus,
  setGamePhase: state.setGamePhase,
  setAutoPayoutReceived: state.setAutoPayoutReceived,
  addDebugEvent: state.addDebugEvent,
  setDebugError: state.setDebugError,
  updateContractBalance: state.updateContractBalance,
}));