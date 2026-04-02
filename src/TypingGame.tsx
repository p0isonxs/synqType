import { useState, useEffect, useRef, useCallback } from "react";
import {
  useReactModelRoot,
  usePublish,
  useSubscribe,
  useViewId,
  useLeaveSession,
} from "@multisynq/react";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import type { Address } from "viem";

import { TypingModel } from "./multisynq/TypingModel";
import type { PlayerModel } from "./multisynq/PlayerModel";
import { useUserData } from "./contexts/UserContext";
import { useWeb3 } from "./contexts/Web3Context";
import { useOptimizedBettingContract } from "./hooks/useBettingContract";
import { getNetworkInfo } from "./config/bettingContract";

const DEFAULT_AVATAR = "/avatars/avatar1.png";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const APP_URL = "https://synqtype.vercel.app/";
const WORDS_PER_CHUNK = 20;

type Props = {
  roomCode?: string;
};

type BettingTypingModel = TypingModel & {
  enableBetting?: boolean;
};

type GameEndWinner = string | "DRAW" | null;
type PlayerEntry = [string, PlayerModel];

function comparePlayers(a: PlayerEntry, b: PlayerEntry) {
  const aCompleted = a[1].progress >= 100 ? 1 : 0;
  const bCompleted = b[1].progress >= 100 ? 1 : 0;

  if (aCompleted !== bCompleted) {
    return bCompleted - aCompleted;
  }

  return b[1].score - a[1].score;
}

export default function OptimizedTypingGame({ roomCode }: Props) {
  const model = useReactModelRoot<TypingModel>();
  const { code } = useParams();
  const actualRoomCode = roomCode || code || "";
  const navigate = useNavigate();
  const viewId = useViewId();
  const leaveSession = useLeaveSession();
  const networkInfo = getNetworkInfo();

  const { userData } = useUserData();
  const { address, isConnected } = useWeb3();

  const roomModel = model as BettingTypingModel | null;
  const bettingEnabled = Boolean(roomModel?.enableBetting);

  const {
    roomData,
    isHost: isBettingHost,
    hasOptimizedFlow,
    declareGameResult,
  } = useOptimizedBettingContract(actualRoomCode, bettingEnabled && isConnected);

  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [wordError, setWordError] = useState(false);
  const [gameState, setGameState] = useState("waiting");
  const [, forceUpdate] = useState(0);
  const [gameEndState, setGameEndState] = useState({
    processed: false,
    winner: null as GameEndWinner,
    isDeclaring: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const lastPlayersRef = useRef("");
  const lastActionRef = useRef<Record<string, number>>({});
  const initsSentRef = useRef(false);

  const actionThrottle = useCallback((actionKey: string, minInterval = 2000) => {
    const now = Date.now();
    const lastAction = lastActionRef.current[actionKey] || 0;

    if (now - lastAction < minInterval) {
      return false;
    }

    lastActionRef.current[actionKey] = now;
    return true;
  }, []);

  const showUniqueToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      id?: string
    ) => {
      const toastId = id || message.slice(0, 20);

      if (type === "success") {
        toast.success(message, { id: toastId });
        return;
      }

      if (type === "error") {
        toast.error(message, { id: toastId });
        return;
      }

      toast(message, { id: toastId });
    },
    []
  );

  const sendInitials = usePublish<string>((initials) => [
    viewId!,
    "set-initials",
    initials,
  ]);
  const sendAvatar = usePublish<string>((url) => [viewId!, "set-avatar", url]);
  const sendTypedWordThrottled = usePublish<boolean>((correct) => [
    viewId!,
    "typed-word",
    correct,
  ]);
  const sendWalletAddressThrottled = usePublish<`0x${string}`>((wallet) => [
    viewId!,
    "set-wallet",
    wallet,
  ]);

  const sendTypedWord = useCallback(
    (correct: boolean) => {
      if (!actionThrottle("typed-word", 100)) {
        return;
      }

      sendTypedWordThrottled(correct);
    },
    [actionThrottle, sendTypedWordThrottled]
  );

  const sendWalletAddress = useCallback(
    (wallet: `0x${string}`) => {
      if (!actionThrottle("send-wallet", 5000)) {
        return;
      }

      sendWalletAddressThrottled(wallet);
    },
    [actionThrottle, sendWalletAddressThrottled]
  );

  const updatePlayers = useCallback(() => {
    if (!model) {
      return;
    }

    const entries = Array.from(model.players.entries());
    const playersKey = entries
      .map(([id, player]) => `${id}:${player.initials}:${player.progress}:${player.score}`)
      .join("|");

    if (playersKey === lastPlayersRef.current) {
      return;
    }

    lastPlayersRef.current = playersKey;
    forceUpdate((prev) => prev + 1);

  }, [model, viewId]);

  useSubscribe("view", "update", updatePlayers);

  const player = viewId && model ? model.players.get(viewId) || null : null;
  const currentIndex = player?.index ?? 0;
  const currentWord = model?.words[currentIndex] || "";
  const wordsLength = model?.words.length ?? 0;
  const isCompleted = Boolean(player && currentIndex >= wordsLength);
  const sortedPlayers = model
    ? [...model.players.entries()].sort(comparePlayers)
    : [];
  const firstFinishedPlayer = sortedPlayers.find(([, currentPlayer]) => currentPlayer.progress >= 100);
  const typingGameOver = Boolean(firstFinishedPlayer) || (model?.timeLeft ?? 0) === 0;
  const isDraw =
    typingGameOver &&
    sortedPlayers.length > 1 &&
    sortedPlayers.filter(([, currentPlayer]) => {
      if (!sortedPlayers[0]) {
        return false;
      }

      const topPlayer = sortedPlayers[0][1];
      const topFinished = topPlayer.progress >= 100;
      return (
        (currentPlayer.progress >= 100) === topFinished &&
        currentPlayer.score === topPlayer.score
      );
    }).length > 1;
  const localWinnerViewId =
    typingGameOver && !isDraw && sortedPlayers[0] ? sortedPlayers[0][0] : null;
  const trackLanes = model
    ? [...model.players.entries()].map(([id, currentPlayer], index) => ({
        id,
        player: currentPlayer,
        yPosition: index * 50,
        isCurrentPlayer: id === viewId,
      }))
    : [];
  const showGameOver = typingGameOver || Boolean(roomData?.gameEnded);
  const roomWinnerAddress =
    roomData?.winner && roomData.winner !== ZERO_ADDRESS
      ? roomData.winner.toLowerCase()
      : null;
  const didCurrentPlayerWin = Boolean(
    roomWinnerAddress && address
      ? roomWinnerAddress === address.toLowerCase()
      : localWinnerViewId && localWinnerViewId === viewId
  );

  const getTruncatedName = useCallback((name: string) => {
    return name.length > 8 ? `${name.substring(0, 8)}...` : name;
  }, []);

  const getPlayerAvatar = useCallback(
    (playerId: string, currentPlayer: PlayerModel) => {
      if (playerId === viewId) {
        return userData.avatarUrl;
      }

      return currentPlayer.avatarUrl || DEFAULT_AVATAR;
    },
    [userData.avatarUrl, viewId]
  );

  const getIndexProgress = useCallback(
    (currentPlayer: PlayerModel) => {
      if (!wordsLength) {
        return 0;
      }

      return Math.min((currentPlayer.index / wordsLength) * 100, 100);
    },
    [wordsLength]
  );

  const getTimeColor = useCallback(() => {
    if (!model) {
      return "text-white";
    }

    if (model.timeLeft > model.timeLimit * 0.5) {
      return "text-white";
    }

    if (model.timeLeft > model.timeLimit * 0.25) {
      return "text-yellow-400";
    }

    return "text-red-400";
  }, [model]);

  const generateShareText = useCallback(() => {
    const myPlayer = sortedPlayers.find(([id]) => id === viewId);
    const myRank = myPlayer ? sortedPlayers.indexOf(myPlayer) + 1 : 0;
    const myScore = myPlayer ? myPlayer[1].score : 0;
    const myWpm = myPlayer ? myPlayer[1].wpm || 0 : 0;

    let shareText = "Just finished a typing battle!\n\n";
    shareText += `My result: Rank #${myRank} - ${myScore} words at ${myWpm} WPM\n`;
    shareText += `Room: ${actualRoomCode}\n\n`;

    if (bettingEnabled && roomData?.totalPot) {
      shareText += `Prize pool was ${roomData.totalPot} ${networkInfo.currency}!\n\n`;
    }

    shareText += `Challenge me at: ${APP_URL}`;
    return shareText;
  }, [
    actualRoomCode,
    bettingEnabled,
    networkInfo.currency,
    roomData?.totalPot,
    sortedPlayers,
    viewId,
  ]);

  const handleShare = useCallback(
    (platform: string) => {
      const shareText = generateShareText();
      const encodedText = encodeURIComponent(shareText);
      const encodedUrl = encodeURIComponent(APP_URL);

      const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedText}`,
        reddit: `https://reddit.com/submit?title=Typing%20Battle%20Results&text=${encodedText}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      };

      window.open(
        shareUrls[platform as keyof typeof shareUrls],
        "_blank",
        "width=600,height=500,scrollbars=yes"
      );
      setShowShareModal(false);
    },
    [generateShareText]
  );

  useEffect(() => {
    if (!model || !viewId) {
      return;
    }

    const existingPlayer = model.players.get(viewId);

    if (existingPlayer?.initials) {
      initsSentRef.current = true;
      return;
    }

    if (initsSentRef.current || !actionThrottle("init-setup", 3000)) {
      return;
    }

    sendInitials(userData.initials);
    sendAvatar(userData.avatarUrl);
    initsSentRef.current = true;
  }, [
    actionThrottle,
    model,
    sendAvatar,
    sendInitials,
    userData.avatarUrl,
    userData.initials,
    viewId,
  ]);

  useEffect(() => {
    if (address && model && viewId) {
      sendWalletAddress(address);
    }
  }, [address, model, sendWalletAddress, viewId]);

  useEffect(() => {
    if (model?.countdownActive && model.countdown === 0) {
      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return () => window.clearTimeout(focusTimer);
    }
  }, [model?.countdown, model?.countdownActive]);

  useEffect(() => {
    if (model?.started && inputRef.current && !isCompleted && gameState === "playing") {
      inputRef.current.focus();
    }
  }, [gameState, isCompleted, model?.started]);

  useEffect(() => {
    if (!model || !viewId) {
      return;
    }

    if (showGameOver) {
      setGameState("finished");
      return;
    }

    if (model.countdownActive) {
      setGameState("countdown");
      return;
    }

    if (model.started && model.timeLeft > 0) {
      setGameState("playing");
      return;
    }

    if (!model.started && model.players.size < 2) {
      setGameState("waiting");
      return;
    }

    setGameState("ready");
  }, [
    model,
    model?.countdownActive,
    model?.players.size,
    model?.started,
    model?.timeLeft,
    showGameOver,
    viewId,
  ]);

  useEffect(() => {
    if (!typingGameOver) {
      return;
    }

    const nextWinner: GameEndWinner = isDraw ? "DRAW" : localWinnerViewId;
    setGameEndState((prev) => {
      if (prev.winner === nextWinner) {
        return prev;
      }

      return {
        ...prev,
        winner: nextWinner,
      };
    });
  }, [isDraw, localWinnerViewId, typingGameOver]);

  useEffect(() => {
    if (!showGameOver) {
      return;
    }

    setShowEndGameModal(true);
  }, [showGameOver]);

  useEffect(() => {
    if (!roomData?.gameEnded) {
      return;
    }

    let syncedWinner: GameEndWinner = gameEndState.winner;

    if (roomWinnerAddress && model) {
      const matchedPlayer = Array.from(model.players.entries()).find(
        ([, currentPlayer]) =>
          currentPlayer.walletAddress?.toLowerCase() === roomWinnerAddress
      );

      syncedWinner = matchedPlayer?.[0] || syncedWinner;
    } else if (roomData.winner === ZERO_ADDRESS && isDraw) {
      syncedWinner = "DRAW";
    } else if (roomData.winner === ZERO_ADDRESS) {
      syncedWinner = syncedWinner === "DRAW" ? syncedWinner : null;
    }

    setGameEndState((prev) => {
      if (prev.processed && prev.winner === syncedWinner && !prev.isDeclaring) {
        return prev;
      }

      return {
        processed: true,
        winner: syncedWinner,
        isDeclaring: false,
      };
    });
  }, [gameEndState.winner, isDraw, model, roomData?.gameEnded, roomData?.winner, roomWinnerAddress]);

  useEffect(() => {
    const settleOnChain = async () => {
      if (!bettingEnabled || !model || !roomData || !isBettingHost) {
        return;
      }

      if (!roomData.gameStarted || roomData.gameEnded || !typingGameOver) {
        return;
      }

      if (gameEndState.processed || gameEndState.isDeclaring) {
        return;
      }

      if (!actionThrottle("declare-result", 10000)) {
        return;
      }

      const roster = Array.from(model.players.values());
      if (roster.length === 0 || roster.length !== roomData.playerCount) {
        return;
      }

      const missingWallet = roster.some((currentPlayer) => !currentPlayer.walletAddress);
      if (missingWallet) {
        showUniqueToast(
          "Waiting for all player wallets before settling the result on-chain.",
          "info",
          "waiting-wallets"
        );
        return;
      }

      const nextWinner: GameEndWinner = isDraw ? "DRAW" : localWinnerViewId;
      setGameEndState((prev) => ({
        ...prev,
        winner: nextWinner,
        isDeclaring: true,
      }));

      try {
        await declareGameResult(
          roster.map((currentPlayer) => currentPlayer.walletAddress as Address),
          roster.map((currentPlayer) => BigInt(currentPlayer.score))
        );

        setGameEndState({
          processed: true,
          winner: nextWinner,
          isDeclaring: false,
        });
      } catch (error) {
        console.error("Failed to settle game result on-chain:", error);
        setGameEndState((prev) => ({
          ...prev,
          isDeclaring: false,
        }));
        showUniqueToast(
          "Failed to settle result on-chain. The host wallet will retry shortly.",
          "error",
          "settlement-error"
        );
      }
    };

    void settleOnChain();
  }, [
    actionThrottle,
    bettingEnabled,
    declareGameResult,
    gameEndState.isDeclaring,
    gameEndState.processed,
    isBettingHost,
    isDraw,
    localWinnerViewId,
    model,
    roomData,
    showUniqueToast,
    typingGameOver,
  ]);

  const handleExit = useCallback(() => {
    if (!model?.started) {
      navigate(`/room/${actualRoomCode}/lobby`);
      return;
    }

    leaveSession();
    navigate("/multiplayer");
  }, [actualRoomCode, leaveSession, model?.started, navigate]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || !currentWord || isCompleted || gameState !== "playing") {
      return;
    }

    if (!actionThrottle("submit-word", 50)) {
      return;
    }

    const correct = inputValue.trim() === currentWord;

    void new Audio(correct ? "/uwu-sound-119010.mp3" : "/fart-83471.mp3").play();

    if (!correct) {
      setWordError(true);
      window.setTimeout(() => setWordError(false), 500);
    } else if (inputRef.current) {
      inputRef.current.classList.add("correct");
      window.setTimeout(() => {
        inputRef.current?.classList.remove("correct");
      }, 250);
    }

    sendTypedWord(correct);
    setInputValue("");
  }, [
    actionThrottle,
    currentWord,
    gameState,
    inputValue,
    isCompleted,
    sendTypedWord,
  ]);

  const getCurrentChunk = useCallback(() => {
    if (!model) {
      return { words: [] as string[], startIndex: 0 };
    }

    const chunkIndex = Math.floor(currentIndex / WORDS_PER_CHUNK);
    const startIndex = chunkIndex * WORDS_PER_CHUNK;
    const endIndex = Math.min(startIndex + WORDS_PER_CHUNK, model.words.length);

    return {
      words: model.words.slice(startIndex, endIndex),
      startIndex,
    };
  }, [currentIndex, model]);

  const renderChunkedText = useCallback(() => {
    const chunk = getCurrentChunk();
    const relativeIndex = currentIndex - chunk.startIndex;

    return (
      <div className="text-xs sm:text-sm md:text-base font-mono leading-relaxed bg-gray-900 rounded-md p-2 sm:p-3 border border-gray-700 min-h-[100px] sm:min-h-[120px] max-h-[180px] sm:max-h-[200px] overflow-hidden transition-opacity duration-300 select-none">
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {chunk.words.map((chunkWord, wordIndex) => (
            <span className="inline-block" key={chunk.startIndex + wordIndex}>
              {wordIndex < relativeIndex
                ? chunkWord.split("").map((letter, letterIndex) => (
                    <span key={letterIndex} className="text-green-400 rounded-sm">
                      {letter}
                    </span>
                  ))
                : wordIndex === relativeIndex
                  ? chunkWord.split("").map((letter, letterIndex) => {
                      const isTyped = letterIndex < inputValue.length;
                      const isCorrect = isTyped && inputValue[letterIndex] === letter;
                      const isIncorrect = isTyped && inputValue[letterIndex] !== letter;
                      const isCurrent = letterIndex === inputValue.length;

                      return (
                        <span
                          key={letterIndex}
                          className={`rounded-sm ${
                            isCorrect
                              ? "text-green-400"
                              : isIncorrect
                                ? "text-red-400"
                                : isCurrent
                                  ? "text-white"
                                  : "text-gray-300"
                          }`}
                        >
                          {letter}
                        </span>
                      );
                    })
                  : chunkWord.split("").map((letter, letterIndex) => (
                      <span key={letterIndex} className="text-gray-400">
                        {letter}
                      </span>
                    ))}
            </span>
          ))}
        </div>

        <div className="mt-2 text-center text-xs text-gray-500">
          Word {Math.min(currentIndex + 1, wordsLength || 1)} of {wordsLength} | Chunk{" "}
          {Math.floor(currentIndex / WORDS_PER_CHUNK) + 1} of{" "}
          {Math.max(1, Math.ceil(wordsLength / WORDS_PER_CHUNK))}
          {bettingEnabled && roomData && (
            <span className="text-yellow-300 ml-2">
              Prize: {roomData.totalPot} {networkInfo.currency}
            </span>
          )}
        </div>
      </div>
    );
  }, [
    bettingEnabled,
    currentIndex,
    getCurrentChunk,
    inputValue,
    networkInfo.currency,
    roomData,
    wordsLength,
  ]);

  if (!model || !viewId || !player) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400 font-staatliches">
            Loading Optimized Typing Battle...
          </p>
        </div>
      </div>
    );
  }

  const accuracy =
    currentIndex > 0 ? Math.round((player.score / currentIndex) * 100) : 100;
  const myRank = sortedPlayers.findIndex(([id]) => id === viewId) + 1;
  const splitPayoutSettled =
    Boolean(roomData?.gameEnded) && roomData?.winner === ZERO_ADDRESS && isDraw;
  const timeoutRefundSettled =
    Boolean(roomData?.gameEnded) && roomData?.winner === ZERO_ADDRESS && !isDraw;

  const WinnerRewardPanel = () => {
    if (!bettingEnabled || !roomData || !showGameOver) {
      return null;
    }

    let title = "Processing Results";
    let subtitle = `${roomData.totalPot} ${networkInfo.currency} prize pool`;

    if (roomData.gameEnded && roomWinnerAddress) {
      title = didCurrentPlayerWin ? "Prize Paid" : "Game Settled";
      subtitle = didCurrentPlayerWin
        ? `You received ${roomData.totalPot} ${networkInfo.currency}.`
        : `Winner has been paid ${roomData.totalPot} ${networkInfo.currency}.`;
    } else if (splitPayoutSettled) {
      title = "Draw Settled";
      subtitle = "Tie detected. The prize pool was split automatically.";
    } else if (timeoutRefundSettled) {
      title = "Timeout Refund";
      subtitle = "Result was not finalized in time, so funds were refunded.";
    } else if (gameEndState.isDeclaring) {
      title = "Settling On-Chain";
      subtitle = "Host is submitting the final roster and scores.";
    }

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-md p-3 max-w-5xl mx-auto mb-4">
        <div className="text-center">
          <p className="text-white text-sm font-staatliches">{title}</p>
          <p className="text-gray-400 text-xs mt-1 font-staatliches">
            {subtitle}
          </p>
        </div>
      </div>
    );
  };

  const CountdownOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="text-center">
        <img src="/logo.png" alt="Logo" className="h-24 w-auto mx-auto mb-8" />
        <div className="text-8xl font-bold text-white mb-4 animate-pulse font-staatliches">
          {model.countdown > 0 ? model.countdown : "GO!"}
        </div>
        <div className="text-xl text-gray-300">
          {model.countdown > 0 ? "Get Ready..." : "Start Typing!"}
        </div>
        {bettingEnabled && roomData && (
          <div className="text-lg text-white mt-4">
            Prize Pool: {roomData.totalPot} {networkInfo.currency}
            {hasOptimizedFlow && (
              <div className="text-green-300 text-sm mt-1">
                Host settles results on-chain automatically
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const SimpleLeaderboard = () => (
    <div className="max-w-md mx-auto mb-8">
      <h3 className="text-white text-lg font-bold mb-4 text-center font-staatliches">
        {showGameOver ? "FINAL RESULTS" : "LIVE SCORES"}
      </h3>
      <div className="space-y-2">
        {sortedPlayers.map(([id, currentPlayer], index) => {
          const isOnChainWinner =
            Boolean(roomWinnerAddress) &&
            currentPlayer.walletAddress?.toLowerCase() === roomWinnerAddress;
          const isWinnerCandidate = !roomWinnerAddress && !isDraw && index === 0 && showGameOver;

          return (
            <div
              key={id}
              className={`flex justify-between items-center p-3 rounded-xl ${
                isOnChainWinner
                  ? "bg-green-800 border border-green-500"
                  : isWinnerCandidate && bettingEnabled
                    ? "bg-blue-800 border border-blue-500"
                    : "bg-gray-800 border border-gray-600"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg font-bold text-white">#{index + 1}</span>
                <div>
                  <div
                    className={`font-semibold font-staatliches ${
                      id === viewId ? "text-blue-400" : "text-white"
                    }`}
                  >
                    {id === viewId
                      ? `${getTruncatedName(currentPlayer.initials || id)} (You)`
                      : getTruncatedName(currentPlayer.initials || id)}
                  </div>
                  <div className="text-xs text-gray-400 font-staatliches">
                    {currentPlayer.wpm || 0} WPM
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-white font-staatliches">
                  {currentPlayer.score} words
                </div>
                <div className="text-xs text-gray-400 font-staatliches">
                  {Math.round(currentPlayer.progress)}%
                </div>
                {isOnChainWinner && (
                  <div className="text-xs text-green-300 font-bold font-staatliches">
                    WON {roomData?.totalPot || "0"} {networkInfo.currency}
                  </div>
                )}
                {!isOnChainWinner && currentPlayer.progress >= 100 && (
                  <div className="text-xs text-yellow-400 font-bold font-staatliches">
                    FINISHED
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ShareModal = () => {
    if (!showShareModal) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="max-w-sm w-full mx-4">
          <div className="bg-black border border-gray-600 rounded-xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-between items-center mb-4">
                <div className="flex-1" />
                <h3 className="text-white text-xl font-bold font-staatliches">
                  Share Results
                </h3>
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="text-gray-400 text-sm">
                Share your typing battle performance
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleShare("twitter")}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">X</span>
                <span className="font-staatliches">Twitter</span>
              </button>

              <button
                onClick={() => handleShare("facebook")}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">f</span>
                <span className="font-staatliches">Facebook</span>
              </button>

              <button
                onClick={() => handleShare("linkedin")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">in</span>
                <span className="font-staatliches">LinkedIn</span>
              </button>

              <button
                onClick={() => handleShare("reddit")}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">r/</span>
                <span className="font-staatliches">Reddit</span>
              </button>

              <button
                onClick={() => handleShare("telegram")}
                className="w-full bg-blue-400 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">TG</span>
                <span className="font-staatliches">Telegram</span>
              </button>
            </div>

            <div className="text-center mt-6">
              <p className="text-gray-500 text-xs font-staatliches">
                Challenge your friends to beat your score
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EndGameModal = () => {
    if (!showEndGameModal) {
      return null;
    }

    const handleModalExit = () => {
      setShowEndGameModal(false);

      if (!model.started) {
        navigate(`/room/${actualRoomCode}/mode`);
        return;
      }

      leaveSession();
      navigate("/multiplayer");
    };

    const handleShareFromModal = () => {
      setShowEndGameModal(false);
      setShowShareModal(true);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="max-w-md w-full mx-4">
          <div className="bg-black border border-gray-600 rounded-xl p-8 text-center">
            <div className="mb-6">
              {didCurrentPlayerWin ? (
                <>
                  <h2 className="text-2xl font-bold text-yellow-400 mb-2 font-staatliches">
                    CONGRATULATIONS!
                  </h2>
                  <p className="text-white font-staatliches">
                    You won the typing battle!
                  </p>
                  {bettingEnabled && roomData?.totalPot && roomWinnerAddress && (
                    <p className="text-yellow-300 text-sm mt-2 font-staatliches">
                      Prize: {roomData.totalPot} {networkInfo.currency}
                    </p>
                  )}
                </>
              ) : splitPayoutSettled ? (
                <>
                  <h2 className="text-2xl font-bold text-blue-400 mb-2 font-staatliches">
                    IT'S A DRAW!
                  </h2>
                  <p className="text-white font-staatliches">
                    The prize pool was split automatically.
                  </p>
                </>
              ) : timeoutRefundSettled ? (
                <>
                  <h2 className="text-2xl font-bold text-blue-400 mb-2 font-staatliches">
                    RESULT TIMED OUT
                  </h2>
                  <p className="text-white font-staatliches">
                    On-chain timeout protection refunded the room funds.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2 font-staatliches">
                    GAME ENDED!
                  </h2>
                  <p className="text-gray-400 font-staatliches">
                    You finished #{Math.max(myRank, 1)} - Nice try!
                  </p>
                </>
              )}
            </div>

            <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 font-staatliches">Score</div>
                  <div className="text-white font-bold font-staatliches">
                    {player.score}/{wordsLength}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-staatliches">WPM</div>
                  <div className="text-white font-bold font-staatliches">
                    {player.wpm || 0}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-staatliches">Rank</div>
                  <div className="text-white font-bold font-staatliches">
                    #{Math.max(myRank, 1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleShareFromModal}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches"
              >
                Share Results
              </button>

              <button
                onClick={handleModalExit}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches"
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {model.countdownActive && <CountdownOverlay />}

      <div className="flex justify-between items-center p-1 sm:p-2">
        <button
          onClick={handleExit}
          className="px-2 py-1 font-staatliches sm:px-2 sm:py-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-md border border-gray-600 transition-all duration-200 text-xs"
        >
          {model.started ? "Exit Game" : "Back to Lobby"}
        </button>
        <div className="text-gray-400 text-xs font-staatliches">
          {roomCode ? (
            <>
              Room <span className="text-white font-mono">{roomCode}</span>
            </>
          ) : (
            <>
              Mode{" "}
              <span className="text-white font-mono">
                {bettingEnabled ? "betting" : "normal"}
              </span>
            </>
          )}
        </div>
      </div>

      <WinnerRewardPanel />

      <div className="px-1 sm:px-2 py-1 sm:py-2">
        <div className="max-w-5xl mx-auto">
          <div className="mb-2 sm:mb-3">
            <div className="relative bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
              {trackLanes.map((lane) => (
                <div
                  key={`name-${lane.id}`}
                  className="absolute left-0 transform -translate-x-full -translate-y-1/2 pr-2 flex items-center"
                  style={{ top: `${lane.yPosition + 37}px` }}
                >
                  <div
                    className={`text-xs font-semibold font-staatliches whitespace-nowrap ${
                      lane.isCurrentPlayer ? "text-blue-400" : "text-white"
                    }`}
                  >
                    {getTruncatedName(lane.player.initials || lane.id)}
                    {lane.isCurrentPlayer && (
                      <span className="text-blue-400 ml-1 font-staatliches">
                        (You)
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {trackLanes.map((lane) => (
                <div
                  key={`progress-${lane.id}`}
                  className="absolute right-0 transform translate-x-full -translate-y-1/2 pl-2"
                  style={{ top: `${lane.yPosition + 37}px` }}
                >
                  <div className="text-xs text-gray-400 font-staatliches">
                    {Math.round(lane.player.progress)}%
                  </div>
                  {lane.player.progress >= 100 && (
                    <div className="text-xs text-yellow-400 font-bold font-staatliches">
                      {bettingEnabled ? "FINISHED!" : "DONE!"}
                    </div>
                  )}
                </div>
              ))}

              <div
                className="relative bg-gray-700 rounded-md border-3 border-gray-600 overflow-hidden"
                style={{ height: `${Math.max(trackLanes.length, 1) * 50}px` }}
              >
                {trackLanes.map(
                  (lane, index) =>
                    index > 0 && (
                      <div
                        key={`divider-${index}`}
                        className="absolute left-0 right-0 h-0.5 bg-gray-600"
                        style={{ top: `${lane.yPosition}px` }}
                      />
                    )
                )}

                {trackLanes.map((lane, index) => (
                  <div
                    key={`centerline-${index}`}
                    className="absolute left-0 right-0 h-0.5 border-t-2 border-dotted border-gray-500"
                    style={{ top: `${lane.yPosition + 25}px` }}
                  />
                ))}

                <div className="absolute left-8 top-0 bottom-0 w-1 bg-white" />
                <div className="absolute right-0 top-0 bottom-0 w-3">
                  <div className="grid grid-cols-2 h-full">
                    {Array.from({ length: Math.max(trackLanes.length, 1) * 3 }, (_, index) => (
                      <div
                        key={index}
                        className={`${index % 2 === 0 ? "bg-white" : "bg-black"} border border-gray-400`}
                      />
                    ))}
                  </div>
                </div>

                {trackLanes.map((lane) => (
                  <div
                    key={lane.id}
                    className={`absolute transform -translate-y-1/2 transition-all duration-500 ease-out ${
                      lane.player.progress >= 100 ? "animate-bounce" : ""
                    }`}
                    style={{
                      left: `${getIndexProgress(lane.player)}%`,
                      top: `${lane.yPosition + 25}px`,
                    }}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-18">
                      <img
                        src={getPlayerAvatar(lane.id, lane.player)}
                        alt={lane.player.initials || lane.id}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    </div>
                    {lane.player.progress >= 100 && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                        <span className="text-sm">{bettingEnabled ? "$" : "*"}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">Time</div>
              <div className={`text-sm font-bold ${getTimeColor()}`}>{model.timeLeft}s</div>
            </div>
            <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">Players</div>
              <div className="text-sm font-bold">
                {model.players.size}/{model.maxPlayers || 6}
              </div>
            </div>
            <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">WPM</div>
              <div className="text-sm font-bold">{player.wpm || 0}</div>
            </div>
            {bettingEnabled && roomData ? (
              <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
                <div className="text-xs text-gray-400 mb-1 font-staatliches">
                  Prize {hasOptimizedFlow ? "ON-CHAIN" : ""}
                </div>
                <div className="text-sm font-bold text-yellow-300">
                  {roomData.totalPot} {networkInfo.currency}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
                <div className="text-xs text-gray-400 mb-1 font-staatliches">Score</div>
                <div className="text-sm font-bold">{player.score}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-3 py-2 sm:py-3">
        <div className="max-w-5xl mx-auto">
          {gameState === "waiting" ? (
            <div className="text-center bg-gray-900 rounded-md p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-2 font-staatliches">
                Waiting for Players
              </h2>
              <p className="text-gray-400 mb-4 font-staatliches">
                {model.players.size} of {model.maxPlayers || 6} players joined
              </p>
              {bettingEnabled && roomData && (
                <div className="mb-2">
                  <p className="text-yellow-300 mb-1 font-staatliches">
                    Prize Pool: {roomData.totalPot} {networkInfo.currency}
                  </p>
                </div>
              )}
              {model.players.size >= 2 && (
                <p className="text-green-400 font-staatliches">
                  Game will start when the host confirms the on-chain room.
                </p>
              )}
            </div>
          ) : gameState === "playing" && !isCompleted && !showGameOver ? (
            <div className="text-center">{renderChunkedText()}</div>
          ) : (
            <div className="text-center">
              {showGameOver ? (
                <div className="space-y-3 bg-gray-900 rounded-md p-6 border border-gray-700">
                  <h2 className="text-lg font-bold text-white mb-2 font-staatliches">
                    {didCurrentPlayerWin
                      ? "You Won!"
                      : splitPayoutSettled
                        ? "Race Ended In A Draw"
                        : timeoutRefundSettled
                          ? "Race Refunded"
                          : "Game Over!"}
                  </h2>

                  <div className="text-base mb-2 font-staatliches">
                    Final Score: <span className="font-bold">{player.score}</span> / {wordsLength} words
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
                    <div className="text-gray-400 font-staatliches">
                      <div>WPM</div>
                      <div className="text-white font-bold font-staatliches">
                        {player.wpm || 0}
                      </div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Accuracy</div>
                      <div className="text-white font-bold">{accuracy}%</div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Rank</div>
                      <div className="text-white font-bold">#{Math.max(myRank, 1)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches"
                    >
                      Share Results
                    </button>

                    <button
                      onClick={handleExit}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches"
                    >
                      Exit Game
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-gray-900 rounded-md p-3 sm:p-4 border border-gray-700">
                  <h2 className="text-base sm:text-lg font-bold text-white mb-2 font-staatliches">
                    Ready to Race?
                  </h2>
                  <p className="text-gray-400 mb-2 text-xs font-staatliches">
                    {bettingEnabled ? "On-chain betting" : "Multiplayer"} typing challenge with {wordsLength} words
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 text-xs">
                    <div className="text-gray-400 font-staatliches">
                      <div>Theme</div>
                      <div className="text-white font-semibold">
                        {model.theme || "Default"}
                      </div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Max Length</div>
                      <div className="text-white font-semibold">{wordsLength}</div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Time Limit</div>
                      <div className="text-white font-semibold">{model.timeLimit}s</div>
                    </div>
                    {bettingEnabled && roomData && (
                      <div className="text-yellow-400 font-staatliches">
                        <div>Prize Pool</div>
                        <div className="text-yellow-200 font-semibold">
                          {roomData.totalPot} {networkInfo.currency}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {gameState === "playing" && !isCompleted && !model.countdownActive && !showGameOver && (
        <div className="px-1 sm:px-2 pb-2">
          <div className="max-w-4xl mx-auto">
            <label className="block text-gray-400 text-xs mb-1 font-staatliches">
              Type here
            </label>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => {
                if (gameState === "playing") {
                  setInputValue(event.target.value);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              className={`w-full px-2 py-2 text-sm bg-white rounded-md text-black focus:outline-none transition-all duration-200 ${
                wordError ? "ring-2 ring-red-500" : "focus:ring-2 focus:ring-blue-500"
              }`}
              placeholder={currentWord || "Start typing..."}
            />
            <div className="mt-1 text-center text-gray-400 text-xs font-staatliches">
              Press space or enter to submit
              {bettingEnabled && roomData && (
                <span className="text-yellow-400 ml-2 font-staatliches">
                  Prize pool: {roomData.totalPot} {networkInfo.currency}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {(gameState === "waiting" || gameState === "ready" || showGameOver) && (
        <>
          <SimpleLeaderboard />
          <ShareModal />
          <EndGameModal />
        </>
      )}
    </div>
  );
}
