import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'
import { useEffect, useState } from 'react'
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

export function useOptimizedBettingContract(roomId: string, enabled = true) {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)

  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  // ===== 📖 READ ROOM INFO =====
  const { data: roomInfo, refetch: refetchRoomInfo } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'getRoomInfo',
    args: [roomId],
    query: { enabled },
  })

  const { data: hasJoined, refetch: refetchJoined } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'hasJoined',
    args: [roomId, address!], 
    query: { enabled: enabled && !!address },
  })

  const { data: hasFinished, refetch: refetchFinished } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'hasFinished',
    args: [roomId, address!],
    query: { enabled: enabled && !!address },
  })

  const { data: canStart } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: 'canGameStart',
    args: [roomId],
    query: { enabled },
  })

  // ✅ WATCH FOR AUTOMATIC PAYOUTS
  useWatchContractEvent({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    eventName: 'RewardClaimed',
    enabled: enabled && !!address,
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const args = log.args as {
            roomId?: string;
            winner?: string;
            amount?: bigint;
          };
          
          const { roomId: eventRoomId, winner, amount } = args;
          
          if (
            eventRoomId === roomId && 
            winner?.toLowerCase() === address?.toLowerCase() &&
            amount
          ) {
            console.log('🎉 OPTIMIZED: Automatic payout received!', {
              roomId: eventRoomId,
              winner,
              amount: formatEther(amount)
            });
            
            toast.success(`💰 Won ${formatEther(amount)} ETH automatically!`, {
              duration: 5000,
              id: 'auto-payout-success'
            });
            
            setTimeout(() => {
              refreshData();
            }, 1000);
          }
        } catch (error) {
          console.error('Error processing RewardClaimed event:', error);
        }
      });
    }
  });

  const refreshData = async () => {
    await Promise.all([
      refetchRoomInfo(),
      refetchJoined(),
      refetchFinished()
    ])
  }

  // ✅ AUTO REFRESH DURING GAME
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(refreshData, 3000)
    return () => clearInterval(interval)
  }, [enabled])

  // ✅ SINGLE TRANSACTION: Create room and place host bet
  const createRoomAndBet = async (betAmount: string, timeLimit: number) => {
    if (!address) throw new Error('Wallet not connected')
    const value = parseEther(betAmount)
    setIsLoading(true)
    
    try {
      console.log('🚀 OPTIMIZED: Creating room with single transaction (host auto-bets)')
      await writeContract({
        address: TYPING_BET_MANAGER_ADDRESS,
        abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
        functionName: 'createRoomAndBet',
        args: [roomId, BigInt(timeLimit)],
        value, // Host's bet amount
      })
      
      toast.success('Room created and you joined the betting pool!', { 
        id: 'room-created' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }

  // ✅ SINGLE TRANSACTION: Join room and place bet
  const joinRoom = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')
    const value = parseEther(amount)
    setIsLoading(true)
    
    try {
      console.log('🎯 OPTIMIZED: Joining room with single transaction')
      await writeContract({
        address: TYPING_BET_MANAGER_ADDRESS,
        abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
        functionName: 'joinRoom',
        args: [roomId],
        value,
      })
      
      toast.success('Joined room and betting pool!', { 
        id: 'room-joined' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }

  // ✅ SINGLE TRANSACTION: Finish game and auto-claim reward
  const declareFinished = async () => {
    setIsLoading(true)
    try {
      console.log('🏁 OPTIMIZED: Declaring finished (auto-claim if winner)')
      await writeContract({
        address: TYPING_BET_MANAGER_ADDRESS,
        abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
        functionName: 'declareFinished',
        args: [roomId],
      })
      
      toast.success('Race finished! Winner will be paid automatically.', { 
        id: 'race-finished' 
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }

  // ✅ EMERGENCY: Handle time-up (can be called by anyone - no gas for host)
  const handleTimeUp = async () => {
    setIsLoading(true)
    try {
      console.log('⏰ OPTIMIZED: Handling time-up scenario')
      await writeContract({
        address: TYPING_BET_MANAGER_ADDRESS,
        abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
        functionName: 'handleTimeUp',
        args: [roomId],
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }

  // ✅ EMERGENCY: Refund if room abandoned
  const emergencyRefund = async () => {
    setIsLoading(true)
    try {
      await writeContract({
        address: TYPING_BET_MANAGER_ADDRESS,
        abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
        functionName: 'emergencyRefund',
        args: [roomId],
      })
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }

  // ✅ DECLARE GAME RESULT - Auto-triggered after game ends
const declareGameResult = async (players: Address[], scores: bigint[]) => {
  setIsLoading(true)
  try {
    console.log('📌 OPTIMIZED: Declaring game result automatically')
    await writeContract({
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

    toast.success('Game result declared successfully!', { id: 'game-result-success' })
  } catch (err) {
    console.error('Error declaring game result:', err)
    toast.error('Error declaring game result', { id: 'game-result-error' })
  } finally {
    setIsLoading(false)
  }
}


  // ✅ HANDLE CONFIRMATION
  if (isConfirmed && isLoading) {
    setIsLoading(false)
    setTimeout(refreshData, 1000)
  }

  // ✅ COMPUTED DATA
  const roomData: RoomData | null = roomInfo ? {
    host: roomInfo[0] as string,
    betAmount: formatEther(roomInfo[1] as bigint),
    playerCount: Number(roomInfo[2]),
    gameEnded: roomInfo[3] as boolean,
    winner: roomInfo[4] as string,
    totalPot: formatEther(roomInfo[5] as bigint),
    timeLimit: Number(roomInfo[6]),
    createdAt: Number(roomInfo[7]),
  } : null

  const isHost = address && roomData?.host?.toLowerCase() === address.toLowerCase()
  const isPlayer = hasJoined ?? false
  const isWinner = roomData?.winner?.toLowerCase() === address?.toLowerCase()
  const canJoin = !roomData?.gameEnded && !isPlayer
  const canDeclareFinished = isPlayer && !roomData?.gameEnded && !hasFinished && canStart
  
  // ✅ NO SEPARATE START NEEDED - Game starts when first player finishes
  const gameCanStart = canStart && roomData && roomData.playerCount >= 2

  return {
    // State
    roomData,
    isHost,
    isPlayer,
    isWinner,
    isConnected,
    
    // ✅ OPTIMIZED FEATURES
    hasOptimizedFlow: true,
    totalTransactionsNeeded: isHost ? 2 : 1, // Host: create+bet, finish. Player: join+bet, finish
    
    // Actions
    createRoomAndBet, // ✅ SINGLE TRANSACTION
    joinRoom,         // ✅ SINGLE TRANSACTION  
    declareFinished,  // ✅ SINGLE TRANSACTION + AUTO PAYOUT
    handleTimeUp,     // ✅ EMERGENCY (anyone can call)
    emergencyRefund,  // ✅ EMERGENCY REFUND

    // Permissions
    canJoin,
    canDeclareFinished,
    gameCanStart,
    declareGameResult,

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