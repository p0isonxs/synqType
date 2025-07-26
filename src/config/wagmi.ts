//src/config/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://monad-testnet.g.alchemy.com/v2/N8FOvudhyXRlr3yAQzoFY','https://testnet-rpc.monad.xyz/'],
    },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.xyz' },
  },
})

export const config = getDefaultConfig({
  appName: 'Typing Game',
  projectId: '5427ea0f42e9a3a272a1a406c2f63c48',
  chains: [monadTestnet],
  appIcon: 'https://synqtype.vercel.app/logo.png',
  ssr: false,
})