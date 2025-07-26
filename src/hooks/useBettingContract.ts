import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { parseEther, formatEther, Address } from 'viem'
import { TYPING_BET_MANAGER_ADDRESS, OPTIMIZED_TYPING_BET_MANAGER_ABI } from '../config/bettingContract'
import toast from 'react-hot-toast'

interface RoomData {
  host: string
  betAmount: string
  playerCount: number
  gameEnded: boolean
  winner: string
  totalPot: string
  timeLimit: number
  createdAt: number
}

// ✅ REQUEST QUEUE SYSTEM
class RequestQueue {
  private queue: (() => Promise<any>)[] = []
  private processing = false
  private lastRequestTime = 0
  private readonly minInterval = 1000 // Minimum 1 second between requests

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Ensure minimum interval between requests
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest))
          }
          
          const result = await request()
          this.lastRequestTime = Date.now()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!
      try {
        await request()
      } catch (error) {
        console.error('Request queue error:', error)
        // Continue processing other requests
      }
      
      // Small delay between queue items
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    this.processing = false
  }
}

export function useOptimizedBettingContract(roomId: string, enabled = true) {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  
  // ✅ REQUEST QUEUE INSTANCE
  const requestQueue = useMemo(() => new RequestQueue(), [])
  
  // ✅ PREVENT DUPLICATE CALLS
  const lastCallRef = useRef<Record<string, number>>({})
  const callThrottle = useCallback((key: string, minInterval = 1000) => {
    const now = Date.now()
    const lastCall = lastCallRef.current[key] || 0
    if (now - lastCall < minInterval) {
      return false // Skip this call
    }
    lastCallRef.current[key] = now
    return true
  }, [])

  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  // ✅ OPTIMIZED READ CONTRACTS - Less frequent polling
  const { data: roomInfo, refetch: refetchRoomInfo } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'getRoomInfo',
    args: [roomId],
    query: { 
      enabled: enabled && !!roomId,
      refetchInterval: 10000, // Only refetch every 10 seconds
      staleTime: 5000, // Consider data fresh for 5 seconds
    },
  })

  const { data: hasJoined, refetch: refetchJoined } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'hasJoined',
    args: [roomId, address!], 
    query: { 
      enabled: enabled && !!address && !!roomId,
      refetchInterval: 15000, // Less frequent - this doesn't change often
      staleTime: 10000,
    },
  })

  const { data: hasFinished, refetch: refetchFinished } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'hasFinished',
    args: [roomId, address!],
    query: { 
      enabled: enabled && !!address && !!roomId,
      refetchInterval: 8000,
      staleTime: 4000,
    },
  })

  const { data: canStart } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'canGameStart',
    args: [roomId],
    query: { 
      enabled: enabled && !!roomId,
      refetchInterval: 12000,
      staleTime: 6000,
    },
  })

  // ✅ OPTIMIZED EVENT WATCHING
  const eventProcessingRef = useRef(new Set<string>())
  
  useWatchContractEvent({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    eventName: 'RewardClaimed',
    enabled: enabled && !!address && !!roomId,
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const args = log.args as {
            roomId?: string;
            winner?: string;
            amount?: bigint;
          };
          
          const { roomId: eventRoomId, winner, amount } = args;
          const eventKey = `${eventRoomId}-${winner}-${amount?.toString()}`
          
          // ✅ PREVENT DUPLICATE EVENT PROCESSING
          if (eventProcessingRef.current.has(eventKey)) {
            return
          }
          eventProcessingRef.current.add(eventKey)
          
          // Clean up old event keys after 5 minutes
          setTimeout(() => eventProcessingRef.current.delete(eventKey), 300000)
          
          if (
            eventRoomId === roomId && 
            winner?.toLowerCase() === address?.toLowerCase() &&
            amount
          ) {
            console.log(' Automatic payout received!', {
              roomId: eventRoomId,
              winner,
              amount: formatEther(amount)
            });
            
            toast.success(`Won ${formatEther(amount)} ETH automatically!`, {
              duration: 5000,
              id: 'auto-payout-success'
            });
            
            // ✅ THROTTLED REFRESH
            setTimeout(() => {
              if (callThrottle('event-refresh', 2000)) {
                refreshData();
              }
            }, 1000);
          }
        } catch (error) {
          console.error('Error processing RewardClaimed event:', error);
        }
      });
    }
  });

  // ✅ THROTTLED REFRESH FUNCTION
  const refreshData = useCallback(async () => {
    if (!callThrottle('refresh-data', 3000)) {
      console.log(' OPTIMIZED: Skipping refresh (too frequent)')
      return
    }
    
    try {
      await requestQueue.add(async () => {
        await Promise.all([
          refetchRoomInfo(),
          refetchJoined(),
          refetchFinished()
        ])
      })
    } catch (error) {
      console.error('OPTIMIZED: Refresh error:', error)
    }
  }, [refetchRoomInfo, refetchJoined, refetchFinished, requestQueue, callThrottle])

  // ✅ MUCH LESS FREQUENT AUTO REFRESH
  useEffect(() => {
    if (!enabled || !roomId) return
    
    // Only refresh every 15 seconds during active games
    const interval = setInterval(() => {
      refreshData()
    }, 15000) // Increased from 3000 to 15000
    
    return () => clearInterval(interval)
  }, [enabled, roomId, refreshData])

  // ✅ OPTIMIZED WRITE FUNCTIONS WITH QUEUE
  const createRoomAndBet = useCallback(async (betAmount: string, timeLimit: number) => {
    if (!address) throw new Error('Wallet not connected')
    if (!callThrottle('create-room', 5000)) throw new Error('Please wait before creating another room')
    
    const value = parseEther(betAmount)
    setIsLoading(true)
    
    try {
      console.log(' Creating room with single transaction (host auto-bets)')
      await requestQueue.add(async () => {
        return writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: 'createRoomAndBet',
          args: [roomId, BigInt(timeLimit)],
          value,
        })
      })
      
      toast.success('Room created and you joined the betting pool!', { 
        id: 'room-created' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }, [address, roomId, writeContract, requestQueue, callThrottle])

  const joinRoom = useCallback(async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')
    if (!callThrottle('join-room', 3000)) throw new Error('Please wait before joining again')
    
    const value = parseEther(amount)
    setIsLoading(true)
    
    try {
      console.log(' Joining room with single transaction')
      await requestQueue.add(async () => {
        return writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: 'joinRoom',
          args: [roomId],
          value,
        })
      })
      
      toast.success('Joined room and betting pool!', { 
        id: 'room-joined' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }, [address, roomId, writeContract, requestQueue, callThrottle])

  const declareFinished = useCallback(async () => {
    if (!callThrottle('declare-finished', 5000)) {
      console.log(' OPTIMIZED: Skipping declareFinished (too frequent)')
      return
    }
    
    setIsLoading(true)
    try {
      console.log(' Declaring finished (auto-claim if winner)')
      await requestQueue.add(async () => {
        return writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: 'declareFinished',
          args: [roomId],
        })
      })
      
      toast.success('Race finished! Winner will be paid automatically.', { 
        id: 'race-finished' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }, [roomId, writeContract, requestQueue, callThrottle])

  const handleTimeUp = useCallback(async () => {
    if (!callThrottle('handle-timeup', 10000)) {
      console.log(' OPTIMIZED: Skipping handleTimeUp (too frequent)')
      return
    }
    
    setIsLoading(true)
    try {
      console.log(' Handling time-up scenario')
      await requestQueue.add(async () => {
        return writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: 'handleTimeUp',
          args: [roomId],
        })
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }, [roomId, writeContract, requestQueue, callThrottle])

  const declareGameResult = useCallback(async (players: Address[], scores: bigint[]) => {
    if (!callThrottle('declare-result', 8000)) {
      console.log(' OPTIMIZED: Skipping declareGameResult (too frequent)')
      return
    }
    
    setIsLoading(true)
    try {
      console.log(' Declaring game result automatically')
      await requestQueue.add(async () => {
        return writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: [
            {
              inputs: [
                { internalType: 'string', name: 'roomId', type: 'string' },
                { internalType: 'address[]', name: 'players', type: 'address[]' },
                { internalType: 'uint256[]', name: 'scores', type: 'uint256[]' }
              ],
              name: 'declareGameResult',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function'
            }
          ],
          functionName: 'declareGameResult',
          args: [roomId, players, scores],
        })
      })

      toast.success('Game result declared successfully!', { id: 'game-result-success' })
    } catch (err) {
      console.error('Error declaring game result:', err)
      toast.error('Error declaring game result', { id: 'game-result-error' })
    } finally {
      setIsLoading(false)
    }
  }, [roomId, writeContract, requestQueue, callThrottle])

  // ✅ HANDLE CONFIRMATION WITH THROTTLING
  useEffect(() => {
    if (isConfirmed && isLoading) {
      setIsLoading(false)
      setTimeout(() => {
        if (callThrottle('confirm-refresh', 2000)) {
          refreshData()
        }
      }, 1000)
    }
  }, [isConfirmed, isLoading, refreshData, callThrottle])

  // ✅ COMPUTED DATA WITH MEMOIZATION
  const roomData: RoomData | null = useMemo(() => {
    if (!roomInfo) return null
    
    return {
      host: roomInfo[0] as string,
      betAmount: formatEther(roomInfo[1] as bigint),
      playerCount: Number(roomInfo[2]),
      gameEnded: roomInfo[3] as boolean,
      winner: roomInfo[4] as string,
      totalPot: formatEther(roomInfo[5] as bigint),
      timeLimit: Number(roomInfo[6]),
      createdAt: Number(roomInfo[7]),
    }
  }, [roomInfo])

  const isHost = useMemo(() => 
    address && roomData?.host?.toLowerCase() === address.toLowerCase(), 
    [address, roomData?.host]
  )
  
  const isPlayer = hasJoined ?? false
  const isWinner = useMemo(() => 
    roomData?.winner?.toLowerCase() === address?.toLowerCase(), 
    [roomData?.winner, address]
  )
  
  const canJoin = useMemo(() => 
    !roomData?.gameEnded && !isPlayer, 
    [roomData?.gameEnded, isPlayer]
  )
  
  const canDeclareFinished = useMemo(() => 
    isPlayer && !roomData?.gameEnded && !hasFinished && canStart, 
    [isPlayer, roomData?.gameEnded, hasFinished, canStart]
  )
  
  const gameCanStart = useMemo(() => 
    canStart && roomData && roomData.playerCount >= 2, 
    [canStart, roomData]
  )

  return {
    // State
    roomData,
    isHost,
    isPlayer,
    isWinner,
    isConnected,
    
    // ✅ OPTIMIZED FEATURES
    hasOptimizedFlow: true,
    totalTransactionsNeeded: isHost ? 2 : 1,
    
    // Actions
    createRoomAndBet,
    joinRoom,
    declareFinished,
    handleTimeUp,
    declareGameResult,

    // Permissions
    canJoin,
    canDeclareFinished,
    gameCanStart,

    // Utils
    refreshData,
    isLoading: isLoading || isPending || isConfirming,
    isPending,
    isConfirming,
    isConfirmed,
    hash,
    error
  }
}