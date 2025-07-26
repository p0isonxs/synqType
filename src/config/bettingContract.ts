// src/config/bettingContract.ts - OPTIMIZED VERSION
// ✅ UPDATED: ABI for optimized single-transaction contract

import { Address } from 'viem'

// ✅ Contract addresses for different networks
const CONTRACTS = {
  localhost: {
    typingBetManager: import.meta.env.VITE_LOCALHOST_TYPING_BET_MANAGER as Address || '0x0000000000000000000000000000000000000000' as Address,
    chainId: 31337,
  },
  monadTestnet: {
    typingBetManager: "0x7f45B3393B95Bce3961079A2f54b5d9aB06c777e" as Address,
    chainId: 10143,
  }
} as const

const getCurrentNetwork = () => {
const chainId = import.meta.env.VITE_CHAIN_ID || '10143'; // Default to Monad
  return chainId === '31337' ? 'localhost' : 'monadTestnet';
};

const CURRENT_NETWORK = getCurrentNetwork();
export const TYPING_BET_MANAGER_ADDRESS = CONTRACTS[CURRENT_NETWORK].typingBetManager;
export const CURRENT_CHAIN_ID = CONTRACTS[CURRENT_NETWORK].chainId;

// ✅ OPTIMIZED ABI - Fewer functions, single transactions
export const OPTIMIZED_TYPING_BET_MANAGER_ABI = [
  // ✅ SINGLE TRANSACTION: Create room and place host bet
  {
    inputs: [
      { internalType: 'string', name: 'roomId', type: 'string' },
      { internalType: 'uint256', name: 'gameTimeLimit', type: 'uint256' }
    ],
    name: 'createRoomAndBet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  
  // ✅ SINGLE TRANSACTION: Join room and place bet
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'joinRoom',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  
  // ✅ SINGLE TRANSACTION: Finish game and auto-claim reward
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'declareFinished',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  
  // ✅ EMERGENCY: Handle time-up scenarios (anyone can call)
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'handleTimeUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  
  // ✅ EMERGENCY: Refund if room abandoned
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'emergencyRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  
  // ✅ VIEW: Get room information
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'getRoomInfo',
    outputs: [
      { internalType: 'address', name: 'host', type: 'address' },
      { internalType: 'uint256', name: 'betAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'playerCount', type: 'uint256' },
      { internalType: 'bool', name: 'ended', type: 'bool' },
      { internalType: 'address', name: 'winner', type: 'address' },
      { internalType: 'uint256', name: 'pot', type: 'uint256' },
      { internalType: 'uint256', name: 'timeLimit', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ VIEW: Check if player joined
  {
    inputs: [
      { internalType: 'string', name: 'roomId', type: 'string' },
      { internalType: 'address', name: 'player', type: 'address' }
    ],
    name: 'hasJoined',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ VIEW: Check if player finished
  {
    inputs: [
      { internalType: 'string', name: 'roomId', type: 'string' },
      { internalType: 'address', name: 'player', type: 'address' }
    ],
    name: 'hasFinished',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ VIEW: Get player finish time
  {
    inputs: [
      { internalType: 'string', name: 'roomId', type: 'string' },
      { internalType: 'address', name: 'player', type: 'address' }
    ],
    name: 'finishTime',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ VIEW: Check if game can start
  {
    inputs: [{ internalType: 'string', name: 'roomId', type: 'string' }],
    name: 'canGameStart',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ VIEW: Get contract balance
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  
  // ✅ NEW: declareGameResult ABI
{
  inputs: [
    { internalType: 'string', name: 'roomId', type: 'string' },
    { internalType: 'address[]', name: 'players', type: 'address[]' },
    { internalType: 'uint256[]', name: 'scores', type: 'uint256[]' },
  ],
  name: 'declareGameResult',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
},

  
  // ✅ EVENTS
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'roomId', type: 'string' },
      { indexed: false, internalType: 'address', name: 'host', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'betAmount', type: 'uint256' }
    ],
    name: 'RoomCreated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'roomId', type: 'string' },
      { indexed: false, internalType: 'address', name: 'player', type: 'address' }
    ],
    name: 'PlayerJoined',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'roomId', type: 'string' },
      { indexed: false, internalType: 'address', name: 'player', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'time', type: 'uint256' }
    ],
    name: 'PlayerFinished',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'roomId', type: 'string' },
      { indexed: false, internalType: 'address', name: 'winner', type: 'address' }
    ],
    name: 'GameEnded',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'roomId', type: 'string' },
      { indexed: false, internalType: 'address', name: 'winner', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'RewardClaimed',
    type: 'event'
  }
] as const

// ✅ Legacy ABI (keep for compatibility with old contract)
export const TYPING_BET_MANAGER_ABI = [
  // ... keep existing ABI for backward compatibility
] as const

// ✅ Backwards compatibility
export const BETTING_CONTRACT_ABI = TYPING_BET_MANAGER_ABI
export const BETTING_CONTRACT_ADDRESS = TYPING_BET_MANAGER_ADDRESS

export const getNetworkInfo = () => ({
  name: CURRENT_NETWORK === 'localhost' ? 'Localhost' : 'Monad Testnet',
  chainId: CURRENT_CHAIN_ID,
  currency: CURRENT_NETWORK === 'localhost' ? 'ETH' : 'MON',
  explorer: CURRENT_NETWORK === 'localhost' 
    ? 'http://localhost:8545' 
    : 'https://testnet.monadexplorer.com'
});