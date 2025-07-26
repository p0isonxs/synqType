import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  useReactModelRoot,
  useSession,
  usePublish,
  useSubscribe,
  useViewId,
  useLeaveSession,
} from "@multisynq/react";
import { TypingModel } from "./multisynq/TypingModel";
import { useNavigate, useParams } from "react-router";
import { useUserData } from "./contexts/UserContext";
import { useWeb3 } from "./contexts/Web3Context";
import { useOptimizedBettingContract } from "./hooks/useBettingContract";
import toast from "react-hot-toast";
import { getNetworkInfo } from "./config/bettingContract";
import { Address } from "viem";
import React from "react";

const DEFAULT_AVATAR = "/avatars/avatar1.png";

type Props = {
  roomCode?: string;
};

export default function OptimizedTypingGame({ roomCode }: Props) {
  const model = useReactModelRoot<TypingModel>();
  const session = useSession();
  const { code } = useParams();
  const actualRoomCode = roomCode || code;
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [wordError, setWordError] = useState(false);
  const [userId, setUserId] = useState("");
  const [, forceUpdate] = useState(0);
  const navigate = useNavigate();
  const viewId = useViewId();
  const leaveSession = useLeaveSession();
  const [showShareModal, setShowShareModal] = useState(false);

  const { userData } = useUserData();
  const { address, isConnected } = useWeb3();

  const networkInfo = getNetworkInfo();
  const roomModel = model as any;
  const bettingEnabled = roomModel?.enableBetting;

  // ✅ ANTI-SPAM: Action throttling system
  const lastActionRef = useRef<Record<string, number>>({});
  const actionThrottle = useCallback((actionKey: string, minInterval = 2000) => {
    const now = Date.now();
    const lastAction = lastActionRef.current[actionKey] || 0;
    if (now - lastAction < minInterval) {
      console.log(`THROTTLED: Skipping ${actionKey} (too frequent)`);
      return false;
    }
    lastActionRef.current[actionKey] = now;
    return true;
  }, []);

  // ✅ OPTIMIZED: Use optimized contract hook
  const {
    roomData,
    isHost: isBettingHost,
    isPlayer: isBettingPlayer,
    canDeclareFinished,
    declareFinished,
    handleTimeUp,
    isLoading: isBettingLoading,
    hasOptimizedFlow,
    declareGameResult,
  } = useOptimizedBettingContract(
    actualRoomCode || "",
    bettingEnabled && isConnected
  );

  // ✅ ANTI-LOOP: Single source of truth for game state
  const [gameEndState, setGameEndState] = useState({
    processed: false,
    winner: null as string | null,
    isEnding: false,
  });

  const [gameState, setGameState] = useState("waiting");
  const [isHost, setIsHost] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastPlayersRef = useRef<string>("");
  const initsSentRef = useRef(false);

  // ✅ THROTTLED: Unique toast function
  const showUniqueToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', id?: string) => {
    const toastId = id || message.slice(0, 20);
    if (type === 'success') {
      toast.success(message, { id: toastId });
    } else if (type === 'error') {
      toast.error(message, { id: toastId });
    } else {
      toast(message, { id: toastId });
    }
  }, []);

  // ✅ THROTTLED: Publish functions with rate limiting
  const sendInitials = usePublish<string>((initials) => [
    viewId!,
    "set-initials",
    initials,
  ]);
  const sendAvatar = usePublish<string>((url) => [viewId!, "set-avatar", url]);
  
  // ✅ ANTI-SPAM: Throttled typed word
  const sendTypedWordThrottled = usePublish<boolean>((correct) => [
    viewId!,
    "typed-word",
    correct,
  ]);
  
  const sendTypedWord = useCallback((correct: boolean) => {
    if (actionThrottle('typed-word', 100)) { // Max 10 words per second
      sendTypedWordThrottled(correct);
    }
  }, [sendTypedWordThrottled, actionThrottle]);

  const startGame = usePublish(() => ["game", "start"]);
  const resetGame = usePublish(() => ["game", "reset"]);

  // ✅ MEMOIZED: Winner determination
  const determineWinner = useCallback(() => {
    if (!model || !model.players) return null;

    const players = Array.from(model.players.entries());
    const sortedPlayers = players.sort((a, b) => {
      const aCompleted = a[1].progress >= 100 ? 1 : 0;
      const bCompleted = b[1].progress >= 100 ? 1 : 0;
      if (aCompleted !== bCompleted) return bCompleted - aCompleted;
      return b[1].score - a[1].score;
    });

    if (sortedPlayers.length === 0 || sortedPlayers[0][1].progress < 100) {
      return null;
    }

    const topScore = sortedPlayers[0][1].score;
    const drawPlayers = sortedPlayers.filter(p => p[1].score === topScore);

    if (drawPlayers.length > 1) {
      console.log("🤝 Draw detected between:", drawPlayers.map(p => p[0]));
      return "DRAW";
    }

    return sortedPlayers[0][0];
  }, [model?.players]);

  // ✅ THROTTLED: Wallet address sending
  const sendWalletAddressThrottled = usePublish<`0x${string}`>((wallet) => [
    viewId!,
    "set-wallet",
    wallet,
  ]);

  const sendWalletAddress = useCallback((wallet: `0x${string}`) => {
    if (actionThrottle('send-wallet', 5000)) { // Max once per 5 seconds
      sendWalletAddressThrottled(wallet);
    }
  }, [sendWalletAddressThrottled, actionThrottle]);

  useEffect(() => {
    if (address && model && viewId && !gameEndState.processed) {
      sendWalletAddress(address);
    }
  }, [address, model, viewId, sendWalletAddress, gameEndState.processed]);

  // ✅ HIGHLY OPTIMIZED: Auto declare results with comprehensive checks
  useEffect(() => {
    const handleAutoDeclareResults = async () => {
      // ✅ EARLY EXIT: Multiple condition checks
      if (!model || !roomData || !bettingEnabled) return;
      if (model.timeLeft !== 0 || roomData.gameEnded || gameEndState.processed) return;
      if (!actionThrottle('auto-declare-results', 10000)) return; // Max once per 10 seconds

      const playersArray = Array.from(model.players.values());
      const hasAnyCompleted = playersArray.some(p => p.progress >= 100);
      if (hasAnyCompleted) return;

      const players = playersArray.map(player => ({
        walletAddress: player.walletAddress,
        score: player.score,
      }));

      const missingWallets = players.filter(p => !p.walletAddress);
      if (missingWallets.length > 0) {
        console.error('Missing wallet addresses for players:', missingWallets);
        showUniqueToast('Cannot declare result: Some players have missing wallet addresses', 'error');
        return;
      }

      const playerAddresses = players.map(p => p.walletAddress as Address);
      const playerScores = players.map(p => p.score);
      const playerScoresBigInt = playerScores.map(score => BigInt(score));
      const maxScore = Math.max(...playerScores);
      const topScorers = players.filter(p => p.score === maxScore);

      if (topScorers.length > 1) {
        console.log("Multiple top scorers, game is draw. Skipping declareGameResult.");
        showUniqueToast("It's a draw! No reward will be distributed.", 'info');
        return;
      }

      try {
        await declareGameResult(playerAddresses, playerScoresBigInt);
        setGameEndState(prev => ({ ...prev, processed: true }));
      } catch (error) {
        console.error('Error declaring game result:', error);
        showUniqueToast('Failed to declare game result', 'error');
      }
    };

    handleAutoDeclareResults();
  }, [
    model?.timeLeft,
    roomData?.gameEnded,
    bettingEnabled,
    gameEndState.processed,
    declareGameResult,
    model?.players,
    actionThrottle,
    showUniqueToast
  ]);

  // ✅ OPTIMIZED: Game end handling with single state management
  useEffect(() => {
    const handleGameEnd = async () => {
      if (gameEndState.processed || !model || !bettingEnabled || !roomData) return;
      if (roomData.gameEnded || gameEndState.isEnding) return;
      if (!actionThrottle('handle-game-end', 5000)) return; // Max once per 5 seconds

      const hasFinishedPlayer = Array.from(model.players.values()).some(p => p.progress >= 100);
      const timeIsUp = model.timeLeft === 0;
      const gameEnded = hasFinishedPlayer || timeIsUp;

      if (gameEnded && !gameEndState.processed) {
        const winner = determineWinner();

        if (winner === "DRAW") {
          setGameEndState({ processed: true, winner: null, isEnding: false });
          showUniqueToast("Game ended in a draw. No payout will be made.", "info", "draw-toast");
          return;
        }

        if (winner) {
          setGameEndState(prev => ({ ...prev, winner, processed: true }));

          const isThisPlayerWinner = winner === viewId;

          if (isThisPlayerWinner && address && canDeclareFinished) {
            setGameEndState(prev => ({ ...prev, isEnding: true }));
            try {
              showUniqueToast("You won! Declaring victory and claiming reward...", 'success', 'winner-declaring');
              await declareFinished();
              showUniqueToast("Victory declared! Your reward has been automatically transferred!", 'success', 'auto-paid');
            } catch (error) {
              showUniqueToast("Failed to declare victory. Try manual claim.", 'error', 'error-declare');
            } finally {
              setGameEndState(prev => ({ ...prev, isEnding: false }));
            }
          } else if (winner !== viewId) {
            console.log(`OPTIMIZED: Game ended, ${winner.slice(0, 8)} won and got paid automatically`);
            showUniqueToast("Game ended! Winner received the prize automatically.", 'info', 'game-end');
          }
        }

        // ✅ THROTTLED: Handle time-up scenarios
        if (timeIsUp && !winner && model.players.size >= 2) {
          if (actionThrottle('handle-timeup', 15000)) { // Max once per 15 seconds
            try {
              await handleTimeUp();
              showUniqueToast("Time's up! Finding fastest player...", 'info', 'time-up');
            } catch (error) {
              console.error("OPTIMIZED: Failed to handle time up:", error);
            }
          }
        }
      }
    };

    handleGameEnd();
  }, [
    model?.timeLeft,
    model?.players?.size,
    gameEndState,
    bettingEnabled,
    roomData?.gameEnded,
    viewId,
    address,
    canDeclareFinished,
    determineWinner,
    declareFinished,
    handleTimeUp,
    actionThrottle,
    showUniqueToast
  ]);

  // ✅ OPTIMIZED: Auto declare when player finishes first
  useEffect(() => {
    const handleAutoFinish = async () => {
      if (!model || !viewId || !bettingEnabled) return;
      if (!actionThrottle('auto-finish', 8000)) return; // Max once per 8 seconds

      const currentPlayer = model.players.get(viewId);
      if (!currentPlayer || currentPlayer.progress < 100) return;

      // Check if this is the first player to finish
      const allPlayers = Array.from(model.players.values());
      const finishedPlayers = allPlayers.filter(p => p.progress >= 100);

      if (finishedPlayers.length === 1 && canDeclareFinished && !gameEndState.processed) {
        console.log('🏁 OPTIMIZED: First player finished - auto declaring with payout!');
        setGameEndState(prev => ({ ...prev, processed: true }));

        try {
          await declareFinished();
          showUniqueToast("🎯 Victory declared and reward claimed automatically!", 'success', 'auto-declare');
        } catch (error) {
          console.error("OPTIMIZED: Auto declare failed:", error);
        }
      }
    };

    handleAutoFinish();
  }, [model?.players, viewId, canDeclareFinished, gameEndState.processed, bettingEnabled, declareFinished, actionThrottle, showUniqueToast]);

  // ✅ OPTIMIZED: Winner reward panel
  const WinnerRewardPanel = React.memo(() => {
    if (!bettingEnabled || !roomData) return null;

    const typingGameOver = model?.timeLeft === 0 || Array.from(model?.players?.values() || []).some(p => p.progress >= 100);
    const shouldShow = roomData.gameEnded || (typingGameOver && gameEndState.winner);

    if (!shouldShow) return null;

    const isRoomWinner = roomData.winner && address &&
      roomData.winner.toLowerCase() === address.toLowerCase();
    const isTypingWinner = gameEndState.winner === viewId;

    // Show winner info for others
    if (roomData.winner) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-md p-3 max-w-5xl mx-auto mb-4">
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Game completed • Winner received {roomData.totalPot} {networkInfo.currency} automatically
            </p>
          </div>
        </div>
      );
    }

    // Processing state
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-md p-3 max-w-5xl mx-auto mb-4">
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            Processing results • {roomData.totalPot} {networkInfo.currency} prize pool
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Winner will receive payout automatically
          </p>
        </div>
      </div>
    );
  });

  // ✅ MEMOIZED: Simplified Leaderboard
  const SimpleLeaderboard = React.memo(() => {
    if (!model) return null;

    const sortedPlayers = useMemo(() => {
      return [...model.players.entries()]
        .sort((a, b) => {
          const aCompleted = a[1].progress >= 100 ? 1 : 0;
          const bCompleted = b[1].progress >= 100 ? 1 : 0;

          if (aCompleted !== bCompleted) {
            return bCompleted - aCompleted;
          }

          return b[1].score - a[1].score;
        });
    }, [model.players]);

    const showGameOver = model.timeLeft === 0 || Array.from(model.players.values()).some(p => p.progress >= 100);

    return (
      <div className="max-w-md mx-auto mb-8">
        <h3 className="text-white text-lg font-bold mb-4 text-center font-staatliches">
          {showGameOver ? "FINAL RESULTS" : "LIVE SCORES"}
        </h3>
        <div className="space-y-2">
          {sortedPlayers.map(([id, p], index) => {
            const isRoomWinner = roomData?.winner &&
              roomData.winner.toLowerCase() === (id === viewId ? address?.toLowerCase() : 'unknown');
            const isWinnerCandidate = p.progress >= 100 && index === 0;

            return (
              <div
                key={id}
                className={`flex justify-between items-center p-3 rounded-xl ${isRoomWinner
                  ? "bg-green-800 border border-green-500"
                  : isWinnerCandidate && bettingEnabled
                    ? "bg-blue-800 border border-blue-500"
                    : "bg-gray-800 border border-gray-600"
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white ">
                    #{index + 1}
                  </span>

                  <div>
                    <div className={`font-semibold font-staatliches ${id === viewId ? "text-blue-400" : "text-white"
                      }`}>
                      {id === viewId
                        ? `${getTruncatedName(p.initials || id)} (You)`
                        : getTruncatedName(p.initials || id)}
                    </div>
                    <div className="text-xs text-gray-400 font-staatliches">
                      {p.wpm || 0} WPM
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white font-staatliches">
                    {p.score} words
                  </div>
                  <div className="text-xs text-gray-400 font-staatliches">
                    {Math.round(p.progress)}%
                  </div>
                  {p.progress >= 100 && (
                    <div className="text-xs text-yellow-400 font-bold font-staatliches">
                      {isRoomWinner ? "WINNER" : "FINISHED"}
                    </div>
                  )}
                  {isRoomWinner && (
                    <div className="text-xs text-green-300 font-bold font-staatliches">
                      Won {roomData?.totalPot || '0'} {networkInfo.currency}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  });

  // ✅ MEMOIZED: Share text generation
  const generateShareText = useCallback(() => {
    if (!model) return '';

    const sortedPlayers = [...model.players.entries()]
      .sort((a, b) => {
        const aCompleted = a[1].progress >= 100 ? 1 : 0;
        const bCompleted = b[1].progress >= 100 ? 1 : 0;
        if (aCompleted !== bCompleted) {
          return bCompleted - aCompleted;
        }
        return b[1].score - a[1].score;
      });

    const myPlayer = sortedPlayers.find(([id]) => id === viewId);
    const myRank = myPlayer ? sortedPlayers.indexOf(myPlayer) + 1 : 0;
    const myScore = myPlayer ? myPlayer[1].score : 0;
    const myWPM = myPlayer ? myPlayer[1].wpm || 0 : 0;

    let shareText = `Just finished a typing battle!\n\n`;
    shareText += `My result: Rank #${myRank} - ${myScore} words at ${myWPM} WPM\n`;
    shareText += `Room: ${actualRoomCode}\n\n`;

    if (bettingEnabled && roomData?.totalPot) {
      shareText += `Prize pool was ${roomData.totalPot} ${networkInfo.currency}!\n\n`;
    }

    shareText += `Challenge me at: https://synqtype.vercel.app/`;

    return shareText;
  }, [model, viewId, actualRoomCode, bettingEnabled, roomData?.totalPot, networkInfo.currency]);

  const handleShare = useCallback((platform: string) => {
    const shareText = generateShareText();
    const encodedText = encodeURIComponent(shareText);
    const gameUrl = encodeURIComponent('https://synqtype.vercel.app/');

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${gameUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${gameUrl}&summary=${encodedText}`,
      reddit: `https://reddit.com/submit?title=Typing%20Battle%20Results&text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${gameUrl}&text=${encodedText}`
    };

    window.open(shareUrls[platform as keyof typeof shareUrls], '_blank', 'width=600,height=500,scrollbars=yes');
    setShowShareModal(false);
  }, [generateShareText]);

  const ShareModal = React.memo(() => {
    if (!showShareModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="max-w-sm w-full mx-4">
          <div className="bg-black border border-gray-600 rounded-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-between items-center mb-4">
                <div className="flex-1"></div>
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

            {/* Social Media Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleShare('twitter')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">X</span>
                <span className="font-staatliches">Twitter</span>
              </button>

              <button
                onClick={() => handleShare('facebook')}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">f</span>
                <span className="font-staatliches">Facebook</span>
              </button>

              <button
                onClick={() => handleShare('linkedin')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">in</span>
                <span className="font-staatliches">LinkedIn</span>
              </button>

              <button
                onClick={() => handleShare('reddit')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">r/</span>
                <span className="font-staatliches">Reddit</span>
              </button>

              <button
                onClick={() => handleShare('telegram')}
                className="w-full bg-blue-400 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3"
              >
                <span className="font-bold text-lg">TG</span>
                <span className="font-staatliches">Telegram</span>
              </button>
            </div>

            {/* Footer */}
            <div className="text-center mt-6">
              <p className="text-gray-500 text-xs font-staatliches">
                Challenge your friends to beat your score
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  });

  const EndGameModal = React.memo(() => {
    if (!showEndGameModal) return null;
  
    const myPlayer = model?.players.get(viewId!);
    const isWinner = gameEndState.winner === viewId;
    const myRank = model ? [...model.players.entries()]
      .sort((a, b) => {
        const aCompleted = a[1].progress >= 100 ? 1 : 0;
        const bCompleted = b[1].progress >= 100 ? 1 : 0;
        if (aCompleted !== bCompleted) return bCompleted - aCompleted;
        return b[1].score - a[1].score;
      })
      .findIndex(([id]) => id === viewId) + 1 : 0;
  
    const handleExit = () => {
      setShowEndGameModal(false);
      if (!model?.started) {
        navigate(`/room/${actualRoomCode}/mode`);
      } else {
        leaveSession();
        navigate("/multiplayer");
      }
    };
  
    const handleShareFromModal = () => {
      setShowEndGameModal(false);
      setShowShareModal(true);
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="max-w-md w-full mx-4">
          <div className="bg-black border border-gray-600 rounded-xl p-8 text-center">
            {/* Header */}
            <div className="mb-6">
              {isWinner ? (
                <>
                  <h2 className="text-2xl font-bold text-yellow-400 mb-2 font-staatliches">
                    CONGRATULATIONS!
                  </h2>
                  <p className="text-white font-staatliches">
                    You won the typing battle!
                  </p>
                  {bettingEnabled && roomData?.totalPot && (
                    <p className="text-yellow-300 text-sm mt-2 font-staatliches">
                      Prize: {roomData.totalPot} {networkInfo.currency}
                    </p>
                  )}
                </>
              ) : gameEndState.winner === "DRAW" ? (
                <>
                  <h2 className="text-2xl font-bold text-blue-400 mb-2 font-staatliches">
                    IT'S A DRAW!
                  </h2>
                  <p className="text-white font-staatliches">
                    Great effort from everyone!
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2 font-staatliches">
                    GAME ENDED!
                  </h2>
                  <p className="text-gray-400 font-staatliches">
                    You finished #{myRank} - Nice try!
                  </p>
                </>
              )}
            </div>
  
            {/* Stats */}
            <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 font-staatliches">Score</div>
                  <div className="text-white font-bold font-staatliches">
                    {myPlayer?.score || 0}/{model?.words.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-staatliches">WPM</div>
                  <div className="text-white font-bold font-staatliches">
                    {myPlayer?.wpm || 0}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-staatliches">Rank</div>
                  <div className="text-white font-bold font-staatliches">
                    #{myRank}
                  </div>
                </div>
              </div>
            </div>
  
            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleShareFromModal}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches"
              >
                 Share Results
              </button>
              
              <button
                onClick={handleExit}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches"
              >
                 Exit Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  });

  // ✅ THROTTLED: Focus management
  useEffect(() => {
    if (model?.countdownActive && model?.countdown === 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [model?.countdownActive, model?.countdown]);

  // ✅ OPTIMIZED: Initial setup with throttling
  useEffect(() => {
    if (model && viewId && !initsSentRef.current) {
      const userExists = model.players.has(viewId);
      if (userExists && model.players.get(viewId)?.initials) {
        initsSentRef.current = true;
        setUserId(userData.initials);
        return;
      }

      if (actionThrottle('init-setup', 3000)) {
        setUserId(userData.initials);
        sendInitials(userData.initials);
        sendAvatar(userData.avatarUrl);
        initsSentRef.current = true;
      }
    }
  }, [
    model,
    viewId,
    actualRoomCode,
    sendInitials,
    sendAvatar,
    userData.initials,
    userData.avatarUrl,
    actionThrottle
  ]);

  // ✅ THROTTLED: Game state updates
  useEffect(() => {
    if (!model || !viewId) return;

    const playerCount = model.players.size;

    if (model.countdownActive) {
      setGameState("countdown");
    } else if (model.started && model.timeLeft > 0) {
      setGameState("playing");
    } else if (!model.started && model.timeLeft === 0) {
      setGameState("finished");
    } else if (!model.started && playerCount < 2) {
      setGameState("waiting");
    } else {
      setGameState("ready");
    }
  }, [
    model?.started,
    model?.players?.size,
    model?.timeLeft,
    model?.countdownActive,
    model?.countdown,
    viewId,
  ]);

  const handleExit = useCallback(() => {
    if (!model?.started) {
      navigate(`/room/${actualRoomCode}/lobby`);
    } else {
      leaveSession();
      navigate("/multiplayer");
    }
  }, [model?.started, navigate, actualRoomCode, leaveSession]);

  // ✅ THROTTLED: Player updates
  const updatePlayers = useCallback(() => {
    if (!model) return;
    if (!actionThrottle('update-players', 500)) return; // Max 2 updates per second

    const entries = Array.from(model.players.entries());
    const playersKey = entries
      .map(([id, p]) => `${id}:${p.initials}:${p.progress}:${p.score}`)
      .join("|");

    if (playersKey !== lastPlayersRef.current) {
      lastPlayersRef.current = playersKey;
      forceUpdate((prev) => prev + 1);
      if (viewId && entries.length > 0) {
        const firstViewId = entries[0][0];
        setIsHost(viewId === firstViewId);
      }
    }
  }, [model, actionThrottle, viewId]);

  useSubscribe("view", "update", updatePlayers);

  // Helper functions
  const getPlayerAvatar = useCallback(
    (playerId: string, player: any) => {
      if (playerId === viewId) {
        return userData.avatarUrl;
      }
      return player.avatarUrl || DEFAULT_AVATAR;
    },
    [viewId, userData.avatarUrl]
  );

  const getTruncatedName = useCallback((name: string) => {
    return name.length > 8 ? name.substring(0, 8) + "..." : name;
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!isHost) return;
    if (!actionThrottle('play-again', 5000)) return;

    // Reset all states
    setGameEndState({ processed: false, winner: null, isEnding: false });

    resetGame();
    setTimeout(() => {
      startGame();
    }, 100);
  }, [isHost, resetGame, startGame, actionThrottle]);

  // Keep all existing game rendering logic...
  const player = model?.players.get(viewId!);
  if (!model || !viewId || !player) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400 font-staatliches">Loading Optimized Typing Battle...</p>
        </div>
      </div>
    );
  }

  const currentIndex = player.index;
  const word = model.words[currentIndex];
  const isCompleted = currentIndex >= model.words.length;

  useEffect(() => {
    if (model.started && inputRef.current && !isCompleted && gameState === "playing") {
      inputRef.current.focus();
    }
  }, [model.started, isCompleted, gameState]);

  // ✅ THROTTLED: Submit handler
  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isCompleted || gameState !== "playing") return;
    if (!actionThrottle('submit-word', 50)) return; // Max 20 words per second

    const correct = inputValue.trim() === word;

    new Audio(correct ? "/uwu-sound-119010.mp3" : "/fart-83471.mp3").play();

    if (!correct) {
      setWordError(true);
      setTimeout(() => setWordError(false), 500);
    } else {
      if (inputRef.current) {
        inputRef.current.classList.add("correct");
        setTimeout(() => {
          inputRef.current?.classList.remove("correct");
        }, 250);
      }
    }

    sendTypedWord(correct);
    setInputValue("");
  }, [inputValue, isCompleted, gameState, word, sendTypedWord, actionThrottle]);

  const getTimeColor = useCallback(() => {
    if (!model) return "text-white";
    if (model.timeLeft > model.timeLimit * 0.5) return "text-white";
    if (model.timeLeft > model.timeLimit * 0.25) return "text-yellow-400";
    return "text-red-400";
  }, [model]);

  const WORDS_PER_CHUNK = 20;

  const getCurrentChunk = useCallback(() => {
    if (!model) return { words: [], startIndex: 0, chunkIndex: 0 };
    
    const chunkIndex = Math.floor(currentIndex / WORDS_PER_CHUNK);
    const startIndex = chunkIndex * WORDS_PER_CHUNK;
    const endIndex = Math.min(startIndex + WORDS_PER_CHUNK, model.words.length);

    return {
      words: model.words.slice(startIndex, endIndex),
      startIndex: startIndex,
      chunkIndex: chunkIndex,
    };
  }, [model, currentIndex]);

  const renderChunkedText = useCallback(() => {
    const chunk = getCurrentChunk();
    const relativeIndex = currentIndex - chunk.startIndex;

    return (
      <div className="text-xs sm:text-sm md:text-base font-mono leading-relaxed bg-gray-900 rounded-md p-2 sm:p-3 border border-gray-700 min-h-[100px] sm:min-h-[120px] max-h-[180px] sm:max-h-[200px] overflow-hidden transition-opacity duration-300 select-none">
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {chunk.words.map((chunkWord, wordIndex) => (
            <span className="inline-block" key={chunk.startIndex + wordIndex} >
              {wordIndex < relativeIndex
                ? chunkWord.split("").map((letter, letterIndex) => (
                  <span
                    key={letterIndex}
                    className="text-green-400 rounded-sm"
                  >
                    {letter}
                  </span>
                ))
                : wordIndex === relativeIndex
                  ? chunkWord.split("").map((letter, letterIndex) => {
                    const isTyped = letterIndex < inputValue.length;
                    const isCorrect =
                      isTyped && inputValue[letterIndex] === letter;
                    const isIncorrect =
                      isTyped && inputValue[letterIndex] !== letter;
                    const isCurrent = letterIndex === inputValue.length;

                    return (
                      <span
                        key={letterIndex}
                        className={`rounded-sm ${isCorrect
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
          Word {currentIndex + 1} of {model?.words.length || 0} | Chunk{" "}
          {Math.floor(currentIndex / WORDS_PER_CHUNK) + 1} of{" "}
          {Math.ceil((model?.words.length || 0) / WORDS_PER_CHUNK)}
          {bettingEnabled && roomData && (
            <span className="text-yellow-300 ml-2">
              Prize: {roomData.totalPot} {networkInfo.currency}
            </span>
          )}
        </div>
      </div>
    );
  }, [getCurrentChunk, currentIndex, inputValue, model?.words.length, bettingEnabled, roomData, networkInfo.currency]);

  const getIndexProgress = useCallback((p: typeof player) => {
    if (!model?.words.length) return 0;
    return Math.min((p.index / model.words.length) * 100, 100);
  }, [model?.words.length]);

  const showGameOver = model.timeLeft === 0 || isCompleted;

  const getTrackLanes = useCallback(() => {
    if (!model) return [];
    
    const players = [...model.players.entries()];
    const laneHeight = 50;

    return players.map(([id, p], index) => ({
      id,
      player: p,
      yPosition: index * laneHeight,
      isCurrentPlayer: id === viewId,
    }));
  }, [model, viewId]);

  const CountdownOverlay = React.memo(() => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-24 w-auto mx-auto mb-8"
          />
          <div className="text-8xl font-bold text-white mb-4 animate-pulse font-staatliches">
            {model?.countdown && model.countdown > 0 ? model.countdown : "GO!"}
          </div>
          <div className="text-xl text-gray-300">
            {model?.countdown && model.countdown > 0 ? "Get Ready..." : "Start Typing!"}
          </div>
          {bettingEnabled && roomData && (
            <div className="text-lg text-white mt-4">
              Prize Pool: {roomData.totalPot} {networkInfo.currency}
              {hasOptimizedFlow && (
                <div className="text-green-300 text-sm mt-1">
                  Winner gets paid automatically
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {model.countdownActive && <CountdownOverlay />}

      {/* Header with room code */}
      <div className="flex justify-between items-center p-1 sm:p-2">
        <button
          onClick={handleExit}
          className="px-2 py-1 font-staatliches sm:px-2 sm:py-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-md border border-gray-600 transition-all duration-200 text-xs"
        >
          {model.started ? "Exit Game" : "Back to Lobby"}
        </button>
        <div className="text-gray-400 text-xs font-staatliches ">
          {roomCode ? (
            <>
              Room <span className="text-white font-mono">{roomCode}</span>
            </>
          ) : (
            <>
              Mode <span className="text-white font-mono">
                {bettingEnabled ? "betting" : "normal"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ✅ OPTIMIZED: Winner Reward Panel */}
      {showGameOver && <WinnerRewardPanel />}

      {/* Single Multiplayer Racing Track */}
      <div className="px-1 sm:px-2 py-1 sm:py-2">
        <div className="max-w-5xl mx-auto">
          <div className="mb-2 sm:mb-3">
            <div className="relative bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
              {getTrackLanes().map((lane) => (
                <div
                  key={`name-${lane.id}`}
                  className="absolute left-0 transform -translate-x-full -translate-y-1/2 pr-2 flex items-center"
                  style={{ top: `${lane.yPosition + 37}px` }}
                >
                  <div
                    className={`text-xs font-semibold font-staatliches whitespace-nowrap ${lane.isCurrentPlayer ? "text-blue-400" : "text-white"
                      }`}
                  >
                    {getTruncatedName(lane.player.initials || lane.id)}
                    {lane.isCurrentPlayer && (
                      <span className="text-blue-400 ml-1 font-staatliches">(You)</span>
                    )}
                  </div>
                </div>
              ))}

              {getTrackLanes().map((lane) => (
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
                      {bettingEnabled ? "WINNER!" : "FINISHED!"}
                    </div>
                  )}
                </div>
              ))}

              <div
                className="relative bg-gray-700 rounded-md border-3 border-gray-600 overflow-hidden"
                style={{ height: `${getTrackLanes().length * 50}px` }}
              >
                {getTrackLanes().map(
                  (lane, index) =>
                    index > 0 && (
                      <div
                        key={`divider-${index}`}
                        className="absolute left-0 right-0 h-0.5 bg-gray-600"
                        style={{ top: `${lane.yPosition}px` }}
                      />
                    )
                )}

                {getTrackLanes().map((lane, index) => (
                  <div
                    key={`centerline-${index}`}
                    className="absolute left-0 right-0 h-0.5 border-t-2 border-dotted border-gray-500"
                    style={{ top: `${lane.yPosition + 25}px` }}
                  />
                ))}

                <div className="absolute left-8 top-0 bottom-0 w-1 bg-white" />

                <div className="absolute right-0 top-0 bottom-0 w-3">
                  <div className="grid grid-cols-2 h-full">
                    {Array.from(
                      { length: getTrackLanes().length * 3 },
                      (_, i) => (
                        <div
                          key={i}
                          className={`${i % 2 === 0 ? "bg-white" : "bg-black"
                            } border border-gray-400`}
                        />
                      )
                    )}
                  </div>
                </div>

                {getTrackLanes().map((lane) => (
                  <div
                    key={lane.id}
                    className={`absolute transform -translate-y-1/2 transition-all duration-500 ease-out ${lane.player.progress >= 100 ? "animate-bounce" : ""
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
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    </div>
                    {lane.player.progress >= 100 && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                        <span className="text-sm">
                          {bettingEnabled ? "💰" : "👑"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ✅ OPTIMIZED: Enhanced Game Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="bg-gray-900 rounded-md p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">Time</div>
              <div className={`text-sm font-bold ${getTimeColor()}`}>
                {model.timeLeft}s
              </div>
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
                  Prize {hasOptimizedFlow && "⚡"}
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

      {/* Text Display */}
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
                <p className="text-green-400 font-staatliches">Game will start when host clicks start!</p>
              )}
            </div>
          ) : gameState === "playing" && !isCompleted ? (
            <div className="text-center">{renderChunkedText()}</div>
          ) : (
            <div className="text-center">
              {showGameOver ? (
                <div className="space-y-3 bg-gray-900 rounded-md p-6 border border-gray-700">
                  <h2 className="text-lg font-bold text-white mb-2 font-staatliches">
                    {isCompleted
                      ? "Race Finished!"
                      : player.score === model.words.length
                        ? "Perfect Score!"
                        : "Game Over!"}
                  </h2>

                  <div className="text-base mb-2 font-staatliches">
                    Final Score:{" "}
                    <span className="font-bold">{player.score}</span> /{" "}
                    {model.words.length} words
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
                      <div className="text-white font-bold">
                        {player.score > 0
                          ? Math.round((player.score / currentIndex) * 100)
                          : 100}
                        %
                      </div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Progress</div>
                      <div className="text-white font-bold">
                        {Math.round(player.progress) || 0}%
                      </div>
                    </div>
                  </div>

                  {/* ✅ Share and Exit buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches"
                    >
                       Share Results
                    </button>

                    {isHost && (
                      <button
                        onClick={handleExit}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches"
                      >
                         Exit Game
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-gray-900 rounded-md p-3 sm:p-4 border border-gray-700">
                  <h2 className="text-base sm:text-lg font-bold text-white mb-2 font-staatliches">
                    Ready to Race?
                  </h2>
                  <p className="text-gray-400 mb-2 text-xs font-staatliches">
                    {bettingEnabled ? (hasOptimizedFlow ? "Optimized Betting" : "Betting") : "Multiplayer"} typing challenge with {model.words.length} words
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
                      <div className="text-white font-semibold">
                        {model.words.length}
                      </div>
                    </div>
                    <div className="text-gray-400 font-staatliches">
                      <div>Time Limit</div>
                      <div className="text-white font-semibold">
                        {model.timeLimit}s
                      </div>
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

                  {isHost && model.players.size >= 2 && (
                    <button
                      onClick={handleExit}
                      className="px-3 sm:px-4 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-md text-xs sm:text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Exit Game
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Field */}
      {gameState === "playing" && !isCompleted && !model.countdownActive && (
        <div className="px-1 sm:px-2 pb-2">
          <div className="max-w-4xl mx-auto">
            <label className="block text-gray-400 text-xs mb-1 font-staatliches">
              Type here
            </label>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                if (gameState === "playing") {
                  setInputValue(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if ([" ", "Enter"].includes(e.key)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className={`w-full px-2 py-2 text-sm bg-white rounded-md text-black focus:outline-none transition-all duration-200 ${wordError
                ? "ring-2 ring-red-500"
                : "focus:ring-2 focus:ring-blue-500"
                }`}
              placeholder={word || "Start typing..."}
            />
            <div className="mt-1 text-center text-gray-400 text-xs font-staatliches">
              Press space or enter to submit
              {bettingEnabled && roomData && (
                <span className="text-yellow-400 ml-2 font-staatliches">
                  Win {roomData.totalPot} {networkInfo.currency} {hasOptimizedFlow ? " instantly!" : "!"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {(gameState === "waiting" || showGameOver || gameState === "ready") && (
        <>
          <SimpleLeaderboard />
          <ShareModal />
          <EndGameModal />
        </>
      )}
    </div>
  );
}