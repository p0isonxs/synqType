import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from "wagmi";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { parseEther, formatEther, type Address } from "viem";
import {
  TYPING_BET_MANAGER_ADDRESS,
  OPTIMIZED_TYPING_BET_MANAGER_ABI,
} from "../config/bettingContract";
import toast from "react-hot-toast";

interface RoomData {
  host: string;
  betAmount: string;
  playerCount: number;
  maxPlayers: number;
  gameStarted: boolean;
  gameEnded: boolean;
  winner: string;
  totalPot: string;
  timeLimit: number;
  createdAt: number;
  startedAt: number;
}

class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minInterval = 1000;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minInterval) {
            await new Promise((next) =>
              setTimeout(next, this.minInterval - timeSinceLastRequest)
            );
          }

          const result = await request();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      try {
        await request();
      } catch (error) {
        console.error("Request queue error:", error);
      }

      await new Promise((next) => setTimeout(next, 200));
    }

    this.processing = false;
  }
}

export function useOptimizedBettingContract(roomId: string, enabled = true) {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const requestQueue = useMemo(() => new RequestQueue(), []);
  const lastCallRef = useRef<Record<string, number>>({});

  const callThrottle = useCallback((key: string, minInterval = 1000) => {
    const now = Date.now();
    const lastCall = lastCallRef.current[key] || 0;
    if (now - lastCall < minInterval) {
      return false;
    }

    lastCallRef.current[key] = now;
    return true;
  }, []);

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash });

  const { data: roomInfo, refetch: refetchRoomInfo } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: "getRoomInfo",
    args: [roomId],
    query: {
      enabled: enabled && !!roomId,
      refetchInterval: 5000,
      staleTime: 2000,
    },
  });

  const { data: hasJoined, refetch: refetchJoined } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: "hasJoined",
    args: [roomId, address!],
    query: {
      enabled: enabled && !!address && !!roomId,
      refetchInterval: 10000,
      staleTime: 5000,
    },
  });

  const { data: hasFinished, refetch: refetchFinished } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: "hasFinished",
    args: [roomId, address!],
    query: {
      enabled: enabled && !!address && !!roomId,
      refetchInterval: 10000,
      staleTime: 5000,
    },
  });

  const { data: canStart } = useReadContract({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    functionName: "canGameStart",
    args: [roomId],
    query: {
      enabled: enabled && !!roomId,
      refetchInterval: 5000,
      staleTime: 2000,
    },
  });

  const eventProcessingRef = useRef(new Set<string>());

  useWatchContractEvent({
    address: TYPING_BET_MANAGER_ADDRESS,
    abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
    eventName: "RewardClaimed",
    enabled: enabled && !!roomId,
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const args = log.args as {
            roomId?: string;
            winner?: string;
            amount?: bigint;
          };

          const eventRoomId = args.roomId;
          const winner = args.winner;
          const amount = args.amount;
          const eventKey = `${eventRoomId}-${winner}-${amount?.toString() ?? "0"}`;

          if (eventProcessingRef.current.has(eventKey)) {
            return;
          }

          eventProcessingRef.current.add(eventKey);
          setTimeout(() => eventProcessingRef.current.delete(eventKey), 300000);

          if (eventRoomId !== roomId || !amount) {
            return;
          }

          if (
            winner &&
            winner !== "0x0000000000000000000000000000000000000000" &&
            winner.toLowerCase() === address?.toLowerCase()
          ) {
            toast.success(`Won ${formatEther(amount)} MON automatically!`, {
              duration: 5000,
              id: "auto-payout-success",
            });
          } else if (winner === "0x0000000000000000000000000000000000000000") {
            toast("Game settled with split payout or refund.", {
              id: "draw-or-refund",
            });
          }

          setTimeout(() => {
            void refreshData();
          }, 1000);
        } catch (watchError) {
          console.error("Error processing RewardClaimed event:", watchError);
        }
      });
    },
  });

  const refreshData = useCallback(async () => {
    if (!callThrottle("refresh-data", 2000)) {
      return;
    }

    try {
      await requestQueue.add(async () => {
        await Promise.all([
          refetchRoomInfo(),
          refetchJoined(),
          refetchFinished(),
        ]);
      });
    } catch (refreshError) {
      console.error("Refresh error:", refreshError);
    }
  }, [
    callThrottle,
    refetchFinished,
    refetchJoined,
    refetchRoomInfo,
    requestQueue,
  ]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const interval = setInterval(() => {
      void refreshData();
    }, 15000);

    return () => clearInterval(interval);
  }, [enabled, roomId, refreshData]);

  const createRoomAndBet = useCallback(
    async (betAmount: string, timeLimit: number, maxPlayers: number) => {
      if (!address) throw new Error("Wallet not connected");
      if (!callThrottle("create-room", 5000)) {
        throw new Error("Please wait before creating another room");
      }

      const value = parseEther(betAmount);
      setIsLoading(true);

      try {
        await requestQueue.add(async () =>
          writeContract({
            address: TYPING_BET_MANAGER_ADDRESS,
            abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
            functionName: "createRoomAndBet",
            args: [roomId, BigInt(timeLimit), BigInt(maxPlayers)],
            value,
          })
        );

        toast.success("Room created and you joined the betting pool!", {
          id: "room-created",
        });
      } catch (createError) {
        setIsLoading(false);
        throw createError;
      }
    },
    [address, callThrottle, requestQueue, roomId, writeContract]
  );

  const joinRoom = useCallback(
    async (amount: string) => {
      if (!address) throw new Error("Wallet not connected");
      if (!callThrottle("join-room", 3000)) {
        throw new Error("Please wait before joining again");
      }

      const value = parseEther(amount);
      setIsLoading(true);

      try {
        await requestQueue.add(async () =>
          writeContract({
            address: TYPING_BET_MANAGER_ADDRESS,
            abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
            functionName: "joinRoom",
            args: [roomId],
            value,
          })
        );

        toast.success("Joined room and betting pool!", { id: "room-joined" });
      } catch (joinError) {
        setIsLoading(false);
        throw joinError;
      }
    },
    [address, callThrottle, requestQueue, roomId, writeContract]
  );

  const startGameOnChain = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    if (!callThrottle("start-game", 5000)) {
      throw new Error("Please wait before starting again");
    }

    setIsLoading(true);

    try {
      await requestQueue.add(async () =>
        writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: "startGame",
          args: [roomId],
        })
      );

      toast.success("Game start submitted on-chain.", { id: "game-started" });
    } catch (startError) {
      setIsLoading(false);
      throw startError;
    }
  }, [address, callThrottle, requestQueue, roomId, writeContract]);

  const declareFinished = useCallback(async () => {
    if (!callThrottle("declare-finished", 5000)) {
      return;
    }

    setIsLoading(true);

    try {
      await requestQueue.add(async () =>
        writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: "declareFinished",
          args: [roomId],
        })
      );
    } catch (declareError) {
      setIsLoading(false);
      throw declareError;
    }
  }, [callThrottle, requestQueue, roomId, writeContract]);

  const handleTimeUp = useCallback(async () => {
    if (!callThrottle("handle-timeup", 10000)) {
      return;
    }

    setIsLoading(true);

    try {
      await requestQueue.add(async () =>
        writeContract({
          address: TYPING_BET_MANAGER_ADDRESS,
          abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
          functionName: "handleTimeUp",
          args: [roomId],
        })
      );
    } catch (timeUpError) {
      setIsLoading(false);
      throw timeUpError;
    }
  }, [callThrottle, requestQueue, roomId, writeContract]);

  const declareGameResult = useCallback(
    async (players: Address[], scores: bigint[]) => {
      if (!callThrottle("declare-result", 5000)) {
        return;
      }

      setIsLoading(true);

      try {
        await requestQueue.add(async () =>
          writeContract({
            address: TYPING_BET_MANAGER_ADDRESS,
            abi: OPTIMIZED_TYPING_BET_MANAGER_ABI,
            functionName: "declareGameResult",
            args: [roomId, players, scores],
          })
        );

        toast.success("Game result declared successfully!", {
          id: "game-result-success",
        });
      } catch (declareError) {
        console.error("Error declaring game result:", declareError);
        toast.error("Error declaring game result", {
          id: "game-result-error",
        });
        setIsLoading(false);
        throw declareError;
      }
    },
    [callThrottle, requestQueue, roomId, writeContract]
  );

  useEffect(() => {
    if (isConfirmed && isLoading) {
      setIsLoading(false);
      setTimeout(() => {
        void refreshData();
      }, 1000);
    }
  }, [isConfirmed, isLoading, refreshData]);

  const roomData: RoomData | null = useMemo(() => {
    if (!roomInfo) return null;

    return {
      host: roomInfo[0] as string,
      betAmount: formatEther(roomInfo[1] as bigint),
      playerCount: Number(roomInfo[2]),
      maxPlayers: Number(roomInfo[3]),
      gameStarted: roomInfo[4] as boolean,
      gameEnded: roomInfo[5] as boolean,
      winner: roomInfo[6] as string,
      totalPot: formatEther(roomInfo[7] as bigint),
      timeLimit: Number(roomInfo[8]),
      createdAt: Number(roomInfo[9]),
      startedAt: Number(roomInfo[10]),
    };
  }, [roomInfo]);

  const isHost = useMemo(
    () => Boolean(address && roomData?.host?.toLowerCase() === address.toLowerCase()),
    [address, roomData?.host]
  );

  const isPlayer = hasJoined ?? false;
  const isWinner = useMemo(
    () => roomData?.winner?.toLowerCase() === address?.toLowerCase(),
    [address, roomData?.winner]
  );

  const canJoin = useMemo(
    () =>
      Boolean(
        roomData &&
          !roomData.gameEnded &&
          !roomData.gameStarted &&
          roomData.playerCount < roomData.maxPlayers &&
          !isPlayer
      ),
    [isPlayer, roomData]
  );

  const canDeclareFinished = useMemo(
    () =>
      Boolean(
        isPlayer &&
          roomData?.gameStarted &&
          !roomData?.gameEnded &&
          !hasFinished
      ),
    [hasFinished, isPlayer, roomData?.gameEnded, roomData?.gameStarted]
  );

  const gameCanStart = useMemo(() => Boolean(canStart), [canStart]);

  return {
    roomData,
    isHost,
    isPlayer,
    isWinner,
    isConnected,
    hasOptimizedFlow: true,
    totalTransactionsNeeded: isHost ? 3 : 1,
    createRoomAndBet,
    joinRoom,
    startGameOnChain,
    declareFinished,
    handleTimeUp,
    declareGameResult,
    canJoin,
    canDeclareFinished,
    gameCanStart,
    refreshData,
    isLoading: isLoading || isPending || isConfirming,
    isPending,
    isConfirming,
    isConfirmed,
    hash,
    error,
  };
}
