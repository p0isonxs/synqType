// AUTO-GENERATED: Updated by TypingBetManager deployment
// Last updated: 2025-07-26T07:18:21.545Z

import { Address } from 'viem'

// ✅ Contract addresses for different networks
export const CONTRACTS = {
  localhost: {
    typingBetManager: (import.meta.env.VITE_LOCALHOST_TYPING_BET_MANAGER || '0x0000000000000000000000000000000000000000') as Address,
    chainId: 31337,
  },
  monadTestnet: {
    typingBetManager: '0x517590a4A545Ad4201181d608DCf0a14b16f2183' as Address,
    chainId: 10143,
  }
} as const

export const getCurrentNetwork = () => {
  const chainId = import.meta.env.VITE_CHAIN_ID || '10143';
  return chainId === '31337' ? 'localhost' : 'monadTestnet';
};

export const CURRENT_NETWORK = getCurrentNetwork();
export const TYPING_BET_MANAGER_ADDRESS = CONTRACTS[CURRENT_NETWORK].typingBetManager;
export const CURRENT_CHAIN_ID = CONTRACTS[CURRENT_NETWORK].chainId;

export const CONTRACT_LIMITS = {
  MIN_BET: 0.001,
  MAX_BET: 10,
  MIN_TIME: 30,
  MAX_TIME: 300
} as const;

export const getNetworkInfo = () => ({
  name: CURRENT_NETWORK === 'localhost' ? 'Localhost' : 'Monad Testnet',
  chainId: CURRENT_CHAIN_ID,
  currency: CURRENT_NETWORK === 'localhost' ? 'ETH' : 'MON',
  explorer: CURRENT_NETWORK === 'localhost' 
    ? 'http://localhost:8545' 
    : 'https://testnet.monadexplorer.com'
});
