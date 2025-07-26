import React, { createContext, useContext, ReactNode } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Connector } from 'wagmi'
import toast from 'react-hot-toast'

interface Web3ContextType {
  address: `0x${string}` | undefined
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  shortAddress: string | null
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors, isPending: isConnecting ,} = useConnect()
  const { disconnect } = useDisconnect()

  const connect = async () => {
    try {
      const connector: Connector = connectors.find(c => c.type === 'injected') || connectors[0]
      await connectAsync({ connector })
      toast.success('Wallet connected successfully!')
    } catch (error) {
      console.error('Connection failed:', error)
      toast.error('Failed to connect wallet')
    }
  }

  const shortAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return (
    <Web3Context.Provider value={{ 
      address, 
      isConnected, 
      isConnecting, 
      connect, 
      disconnect,
      shortAddress 
    }}>
      {children}
    </Web3Context.Provider>
  )
}

export const useWeb3 = () => {
  const context = useContext(Web3Context)
  if (!context) throw new Error('useWeb3 must be used inside Web3Provider')
  return context
}