import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useReactModelRoot, useSession, usePublish, useSubscribe, useViewId, useLeaveSession, } from "@multisynq/react";
import { useNavigate, useParams } from "react-router";
import { useUserData } from "./contexts/UserContext";
import { useWeb3 } from "./contexts/Web3Context";
import { useOptimizedBettingContract } from "./hooks/useBettingContract";
import toast from "react-hot-toast";
import { getNetworkInfo } from "./config/bettingContract";
import React from "react";
const DEFAULT_AVATAR = "/avatars/avatar1.png";
export default function OptimizedTypingGame({ roomCode }) {
    const model = useReactModelRoot();
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
    const roomModel = model;
    const bettingEnabled = roomModel?.enableBetting;
    // ✅ ANTI-SPAM: Action throttling system
    const lastActionRef = useRef({});
    const actionThrottle = useCallback((actionKey, minInterval = 2000) => {
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
    const { roomData, isHost: isBettingHost, isPlayer: isBettingPlayer, canDeclareFinished, declareFinished, handleTimeUp, isLoading: isBettingLoading, hasOptimizedFlow, declareGameResult, } = useOptimizedBettingContract(actualRoomCode || "", bettingEnabled && isConnected);
    // ✅ ANTI-LOOP: Single source of truth for game state
    const [gameEndState, setGameEndState] = useState({
        processed: false,
        winner: null,
        isEnding: false,
    });
    const [gameState, setGameState] = useState("waiting");
    const [isHost, setIsHost] = useState(false);
    const inputRef = useRef(null);
    const lastPlayersRef = useRef("");
    const initsSentRef = useRef(false);
    // ✅ THROTTLED: Unique toast function
    const showUniqueToast = useCallback((message, type = 'info', id) => {
        const toastId = id || message.slice(0, 20);
        if (type === 'success') {
            toast.success(message, { id: toastId });
        }
        else if (type === 'error') {
            toast.error(message, { id: toastId });
        }
        else {
            toast(message, { id: toastId });
        }
    }, []);
    // ✅ THROTTLED: Publish functions with rate limiting
    const sendInitials = usePublish((initials) => [
        viewId,
        "set-initials",
        initials,
    ]);
    const sendAvatar = usePublish((url) => [viewId, "set-avatar", url]);
    // ✅ ANTI-SPAM: Throttled typed word
    const sendTypedWordThrottled = usePublish((correct) => [
        viewId,
        "typed-word",
        correct,
    ]);
    const sendTypedWord = useCallback((correct) => {
        if (actionThrottle('typed-word', 100)) { // Max 10 words per second
            sendTypedWordThrottled(correct);
        }
    }, [sendTypedWordThrottled, actionThrottle]);
    const startGame = usePublish(() => ["game", "start"]);
    const resetGame = usePublish(() => ["game", "reset"]);
    // ✅ MEMOIZED: Winner determination
    const determineWinner = useCallback(() => {
        if (!model || !model.players)
            return null;
        const players = Array.from(model.players.entries());
        const sortedPlayers = players.sort((a, b) => {
            const aCompleted = a[1].progress >= 100 ? 1 : 0;
            const bCompleted = b[1].progress >= 100 ? 1 : 0;
            if (aCompleted !== bCompleted)
                return bCompleted - aCompleted;
            return b[1].score - a[1].score;
        });
        if (sortedPlayers.length === 0 || sortedPlayers[0][1].progress < 100) {
            return null;
        }
        const topScore = sortedPlayers[0][1].score;
        const drawPlayers = sortedPlayers.filter(p => p[1].score === topScore);
        if (drawPlayers.length > 1) {
            console.log(" Draw detected between:", drawPlayers.map(p => p[0]));
            return "DRAW";
        }
        return sortedPlayers[0][0];
    }, [model?.players]);
    // ✅ THROTTLED: Wallet address sending
    const sendWalletAddressThrottled = usePublish((wallet) => [
        viewId,
        "set-wallet",
        wallet,
    ]);
    const sendWalletAddress = useCallback((wallet) => {
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
            if (!model || !roomData || !bettingEnabled)
                return;
            if (model.timeLeft !== 0 || roomData.gameEnded || gameEndState.processed)
                return;
            if (!actionThrottle('auto-declare-results', 10000))
                return; // Max once per 10 seconds
            const playersArray = Array.from(model.players.values());
            const hasAnyCompleted = playersArray.some(p => p.progress >= 100);
            if (hasAnyCompleted)
                return;
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
            const playerAddresses = players.map(p => p.walletAddress);
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
            }
            catch (error) {
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
            if (gameEndState.processed || !model || !bettingEnabled || !roomData)
                return;
            if (roomData.gameEnded || gameEndState.isEnding)
                return;
            if (!actionThrottle('handle-game-end', 5000))
                return; // Max once per 5 seconds
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
                        }
                        catch (error) {
                            showUniqueToast("Failed to declare victory. Try manual claim.", 'error', 'error-declare');
                        }
                        finally {
                            setGameEndState(prev => ({ ...prev, isEnding: false }));
                        }
                    }
                    else if (winner !== viewId) {
                        console.log(`Game ended, ${winner.slice(0, 8)} won and got paid automatically`);
                        showUniqueToast("Game ended! Winner received the prize automatically.", 'info', 'game-end');
                    }
                }
                // ✅ THROTTLED: Handle time-up scenarios
                if (timeIsUp && !winner && model.players.size >= 2) {
                    if (actionThrottle('handle-timeup', 15000)) { // Max once per 15 seconds
                        try {
                            await handleTimeUp();
                            showUniqueToast("Time's up! Finding fastest player...", 'info', 'time-up');
                        }
                        catch (error) {
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
            if (!model || !viewId || !bettingEnabled)
                return;
            if (!actionThrottle('auto-finish', 8000))
                return; // Max once per 8 seconds
            const currentPlayer = model.players.get(viewId);
            if (!currentPlayer || currentPlayer.progress < 100)
                return;
            // Check if this is the first player to finish
            const allPlayers = Array.from(model.players.values());
            const finishedPlayers = allPlayers.filter(p => p.progress >= 100);
            if (finishedPlayers.length === 1 && canDeclareFinished && !gameEndState.processed) {
                setGameEndState(prev => ({ ...prev, processed: true }));
                try {
                    await declareFinished();
                    showUniqueToast("Victory declared and reward claimed automatically!", 'success', 'auto-declare');
                }
                catch (error) {
                    console.error("Auto declare failed:", error);
                }
            }
        };
        handleAutoFinish();
    }, [model?.players, viewId, canDeclareFinished, gameEndState.processed, bettingEnabled, declareFinished, actionThrottle, showUniqueToast]);
    // ✅ OPTIMIZED: Winner reward panel
    const WinnerRewardPanel = React.memo(() => {
        if (!bettingEnabled || !roomData)
            return null;
        const typingGameOver = model?.timeLeft === 0 || Array.from(model?.players?.values() || []).some(p => p.progress >= 100);
        const shouldShow = roomData.gameEnded || (typingGameOver && gameEndState.winner);
        if (!shouldShow)
            return null;
        const isRoomWinner = roomData.winner && address &&
            roomData.winner.toLowerCase() === address.toLowerCase();
        const isTypingWinner = gameEndState.winner === viewId;
        // Show winner info for others
        if (roomData.winner) {
            return (_jsx("div", { className: "bg-gray-800 border border-gray-600 rounded-md p-3 max-w-5xl mx-auto mb-4", children: _jsx("div", { className: "text-center", children: _jsxs("p", { className: "text-gray-400 text-sm", children: ["Game completed \u2022 Winner received ", roomData.totalPot, " ", networkInfo.currency, " automatically"] }) }) }));
        }
        // Processing state
        return (_jsx("div", { className: "bg-gray-800 border border-gray-600 rounded-md p-3 max-w-5xl mx-auto mb-4", children: _jsxs("div", { className: "text-center", children: [_jsxs("p", { className: "text-gray-400 text-sm", children: ["Processing results \u2022 ", roomData.totalPot, " ", networkInfo.currency, " prize pool"] }), _jsx("p", { className: "text-gray-500 text-xs mt-1", children: "Winner will receive payout automatically" })] }) }));
    });
    // ✅ MEMOIZED: Simplified Leaderboard
    const SimpleLeaderboard = React.memo(() => {
        if (!model)
            return null;
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
        return (_jsxs("div", { className: "max-w-md mx-auto mb-8", children: [_jsx("h3", { className: "text-white text-lg font-bold mb-4 text-center font-staatliches", children: showGameOver ? "FINAL RESULTS" : "LIVE SCORES" }), _jsx("div", { className: "space-y-2", children: sortedPlayers.map(([id, p], index) => {
                        const isRoomWinner = roomData?.winner &&
                            roomData.winner.toLowerCase() === (id === viewId ? address?.toLowerCase() : 'unknown');
                        const isWinnerCandidate = p.progress >= 100 && index === 0;
                        return (_jsxs("div", { className: `flex justify-between items-center p-3 rounded-xl ${isRoomWinner
                                ? "bg-green-800 border border-green-500"
                                : isWinnerCandidate && bettingEnabled
                                    ? "bg-blue-800 border border-blue-500"
                                    : "bg-gray-800 border border-gray-600"}`, children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("span", { className: "text-lg font-bold text-white ", children: ["#", index + 1] }), _jsxs("div", { children: [_jsx("div", { className: `font-semibold font-staatliches ${id === viewId ? "text-blue-400" : "text-white"}`, children: id === viewId
                                                        ? `${getTruncatedName(p.initials || id)} (You)`
                                                        : getTruncatedName(p.initials || id) }), _jsxs("div", { className: "text-xs text-gray-400 font-staatliches", children: [p.wpm || 0, " WPM"] })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-bold text-white font-staatliches", children: [p.score, " words"] }), _jsxs("div", { className: "text-xs text-gray-400 font-staatliches", children: [Math.round(p.progress), "%"] }), p.progress >= 100 && (_jsx("div", { className: "text-xs text-yellow-400 font-bold font-staatliches", children: isRoomWinner ? "WINNER" : "FINISHED" })), isRoomWinner && (_jsxs("div", { className: "text-xs text-green-300 font-bold font-staatliches", children: ["Won ", roomData?.totalPot || '0', " ", networkInfo.currency] }))] })] }, id));
                    }) })] }));
    });
    // ✅ MEMOIZED: Share text generation
    const generateShareText = useCallback(() => {
        if (!model)
            return '';
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
    const handleShare = useCallback((platform) => {
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
        window.open(shareUrls[platform], '_blank', 'width=600,height=500,scrollbars=yes');
        setShowShareModal(false);
    }, [generateShareText]);
    const ShareModal = React.memo(() => {
        if (!showShareModal)
            return null;
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm", children: _jsx("div", { className: "max-w-sm w-full mx-4", children: _jsxs("div", { className: "bg-black border border-gray-600 rounded-xl p-8", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("div", { className: "flex-1" }), _jsx("h3", { className: "text-white text-xl font-bold font-staatliches", children: "Share Results" }), _jsx("div", { className: "flex-1 flex justify-end", children: _jsx("button", { onClick: () => setShowShareModal(false), className: "text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center", children: "X" }) })] }), _jsx("div", { className: "text-gray-400 text-sm", children: "Share your typing battle performance" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("button", { onClick: () => handleShare('twitter'), className: "w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3", children: [_jsx("span", { className: "font-bold text-lg", children: "X" }), _jsx("span", { className: "font-staatliches", children: "Twitter" })] }), _jsxs("button", { onClick: () => handleShare('facebook'), className: "w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3", children: [_jsx("span", { className: "font-bold text-lg", children: "f" }), _jsx("span", { className: "font-staatliches", children: "Facebook" })] }), _jsxs("button", { onClick: () => handleShare('linkedin'), className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3", children: [_jsx("span", { className: "font-bold text-lg", children: "in" }), _jsx("span", { className: "font-staatliches", children: "LinkedIn" })] }), _jsxs("button", { onClick: () => handleShare('reddit'), className: "w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3", children: [_jsx("span", { className: "font-bold text-lg", children: "r/" }), _jsx("span", { className: "font-staatliches", children: "Reddit" })] }), _jsxs("button", { onClick: () => handleShare('telegram'), className: "w-full bg-blue-400 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3", children: [_jsx("span", { className: "font-bold text-lg", children: "TG" }), _jsx("span", { className: "font-staatliches", children: "Telegram" })] })] }), _jsx("div", { className: "text-center mt-6", children: _jsx("p", { className: "text-gray-500 text-xs font-staatliches", children: "Challenge your friends to beat your score" }) })] }) }) }));
    });
    const EndGameModal = React.memo(() => {
        if (!showEndGameModal)
            return null;
        const myPlayer = model?.players.get(viewId);
        const isWinner = gameEndState.winner === viewId;
        const myRank = model ? [...model.players.entries()]
            .sort((a, b) => {
            const aCompleted = a[1].progress >= 100 ? 1 : 0;
            const bCompleted = b[1].progress >= 100 ? 1 : 0;
            if (aCompleted !== bCompleted)
                return bCompleted - aCompleted;
            return b[1].score - a[1].score;
        })
            .findIndex(([id]) => id === viewId) + 1 : 0;
        const handleExit = () => {
            setShowEndGameModal(false);
            if (!model?.started) {
                navigate(`/room/${actualRoomCode}/mode`);
            }
            else {
                leaveSession();
                navigate("/multiplayer");
            }
        };
        const handleShareFromModal = () => {
            setShowEndGameModal(false);
            setShowShareModal(true);
        };
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm", children: _jsx("div", { className: "max-w-md w-full mx-4", children: _jsxs("div", { className: "bg-black border border-gray-600 rounded-xl p-8 text-center", children: [_jsx("div", { className: "mb-6", children: isWinner ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-2xl font-bold text-yellow-400 mb-2 font-staatliches", children: "CONGRATULATIONS!" }), _jsx("p", { className: "text-white font-staatliches", children: "You won the typing battle!" }), bettingEnabled && roomData?.totalPot && (_jsxs("p", { className: "text-yellow-300 text-sm mt-2 font-staatliches", children: ["Prize: ", roomData.totalPot, " ", networkInfo.currency] }))] })) : gameEndState.winner === "DRAW" ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-2xl font-bold text-blue-400 mb-2 font-staatliches", children: "IT'S A DRAW!" }), _jsx("p", { className: "text-white font-staatliches", children: "Great effort from everyone!" })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-2xl font-bold text-white mb-2 font-staatliches", children: "GAME ENDED!" }), _jsxs("p", { className: "text-gray-400 font-staatliches", children: ["You finished #", myRank, " - Nice try!"] })] })) }), _jsx("div", { className: "bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700", children: _jsxs("div", { className: "grid grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-gray-400 font-staatliches", children: "Score" }), _jsxs("div", { className: "text-white font-bold font-staatliches", children: [myPlayer?.score || 0, "/", model?.words.length || 0] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-gray-400 font-staatliches", children: "WPM" }), _jsx("div", { className: "text-white font-bold font-staatliches", children: myPlayer?.wpm || 0 })] }), _jsxs("div", { children: [_jsx("div", { className: "text-gray-400 font-staatliches", children: "Rank" }), _jsxs("div", { className: "text-white font-bold font-staatliches", children: ["#", myRank] })] })] }) }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("button", { onClick: handleShareFromModal, className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches", children: "Share Results" }), _jsx("button", { onClick: handleExit, className: "w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 font-staatliches", children: "Exit Game" })] })] }) }) }));
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
        if (!model || !viewId)
            return;
        const playerCount = model.players.size;
        if (model.countdownActive) {
            setGameState("countdown");
        }
        else if (model.started && model.timeLeft > 0) {
            setGameState("playing");
        }
        else if (!model.started && model.timeLeft === 0) {
            setGameState("finished");
        }
        else if (!model.started && playerCount < 2) {
            setGameState("waiting");
        }
        else {
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
        }
        else {
            leaveSession();
            navigate("/multiplayer");
        }
    }, [model?.started, navigate, actualRoomCode, leaveSession]);
    // ✅ THROTTLED: Player updates
    const updatePlayers = useCallback(() => {
        if (!model)
            return;
        if (!actionThrottle('update-players', 500))
            return; // Max 2 updates per second
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
    const getPlayerAvatar = useCallback((playerId, player) => {
        if (playerId === viewId) {
            return userData.avatarUrl;
        }
        return player.avatarUrl || DEFAULT_AVATAR;
    }, [viewId, userData.avatarUrl]);
    const getTruncatedName = useCallback((name) => {
        return name.length > 8 ? name.substring(0, 8) + "..." : name;
    }, []);
    const handlePlayAgain = useCallback(() => {
        if (!isHost)
            return;
        if (!actionThrottle('play-again', 5000))
            return;
        // Reset all states
        setGameEndState({ processed: false, winner: null, isEnding: false });
        resetGame();
        setTimeout(() => {
            startGame();
        }, 100);
    }, [isHost, resetGame, startGame, actionThrottle]);
    // Keep all existing game rendering logic...
    const player = model?.players.get(viewId);
    if (!model || !viewId || !player) {
        return (_jsx("div", { className: "min-h-screen bg-black text-white flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" }), _jsx("p", { className: "text-gray-400 font-staatliches", children: "Loading Optimized Typing Battle..." })] }) }));
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
        if (!inputValue.trim() || isCompleted || gameState !== "playing")
            return;
        if (!actionThrottle('submit-word', 50))
            return; // Max 20 words per second
        const correct = inputValue.trim() === word;
        new Audio(correct ? "/uwu-sound-119010.mp3" : "/fart-83471.mp3").play();
        if (!correct) {
            setWordError(true);
            setTimeout(() => setWordError(false), 500);
        }
        else {
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
        if (!model)
            return "text-white";
        if (model.timeLeft > model.timeLimit * 0.5)
            return "text-white";
        if (model.timeLeft > model.timeLimit * 0.25)
            return "text-yellow-400";
        return "text-red-400";
    }, [model]);
    const WORDS_PER_CHUNK = 20;
    const getCurrentChunk = useCallback(() => {
        if (!model)
            return { words: [], startIndex: 0, chunkIndex: 0 };
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
        return (_jsxs("div", { className: "text-xs sm:text-sm md:text-base font-mono leading-relaxed bg-gray-900 rounded-md p-2 sm:p-3 border border-gray-700 min-h-[100px] sm:min-h-[120px] max-h-[180px] sm:max-h-[200px] overflow-hidden transition-opacity duration-300 select-none", children: [_jsx("div", { className: "flex flex-wrap gap-x-1 gap-y-1", children: chunk.words.map((chunkWord, wordIndex) => (_jsx("span", { className: "inline-block", children: wordIndex < relativeIndex
                            ? chunkWord.split("").map((letter, letterIndex) => (_jsx("span", { className: "text-green-400 rounded-sm", children: letter }, letterIndex)))
                            : wordIndex === relativeIndex
                                ? chunkWord.split("").map((letter, letterIndex) => {
                                    const isTyped = letterIndex < inputValue.length;
                                    const isCorrect = isTyped && inputValue[letterIndex] === letter;
                                    const isIncorrect = isTyped && inputValue[letterIndex] !== letter;
                                    const isCurrent = letterIndex === inputValue.length;
                                    return (_jsx("span", { className: `rounded-sm ${isCorrect
                                            ? "text-green-400"
                                            : isIncorrect
                                                ? "text-red-400"
                                                : isCurrent
                                                    ? "text-white"
                                                    : "text-gray-300"}`, children: letter }, letterIndex));
                                })
                                : chunkWord.split("").map((letter, letterIndex) => (_jsx("span", { className: "text-gray-400", children: letter }, letterIndex))) }, chunk.startIndex + wordIndex))) }), _jsxs("div", { className: "mt-2 text-center text-xs text-gray-500", children: ["Word ", currentIndex + 1, " of ", model?.words.length || 0, " | Chunk", " ", Math.floor(currentIndex / WORDS_PER_CHUNK) + 1, " of", " ", Math.ceil((model?.words.length || 0) / WORDS_PER_CHUNK), bettingEnabled && roomData && (_jsxs("span", { className: "text-yellow-300 ml-2", children: ["Prize: ", roomData.totalPot, " ", networkInfo.currency] }))] })] }));
    }, [getCurrentChunk, currentIndex, inputValue, model?.words.length, bettingEnabled, roomData, networkInfo.currency]);
    const getIndexProgress = useCallback((p) => {
        if (!model?.words.length)
            return 0;
        return Math.min((p.index / model.words.length) * 100, 100);
    }, [model?.words.length]);
    const showGameOver = model.timeLeft === 0 || isCompleted;
    const getTrackLanes = useCallback(() => {
        if (!model)
            return [];
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
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm", children: _jsxs("div", { className: "text-center", children: [_jsx("img", { src: "/logo.png", alt: "Logo", className: "h-24 w-auto mx-auto mb-8" }), _jsx("div", { className: "text-8xl font-bold text-white mb-4 animate-pulse font-staatliches", children: model?.countdown && model.countdown > 0 ? model.countdown : "GO!" }), _jsx("div", { className: "text-xl text-gray-300", children: model?.countdown && model.countdown > 0 ? "Get Ready..." : "Start Typing!" }), bettingEnabled && roomData && (_jsxs("div", { className: "text-lg text-white mt-4", children: ["Prize Pool: ", roomData.totalPot, " ", networkInfo.currency, hasOptimizedFlow && (_jsx("div", { className: "text-green-300 text-sm mt-1", children: "Winner gets paid automatically" }))] }))] }) }));
    });
    return (_jsxs("div", { className: "min-h-screen bg-black text-white", children: [model.countdownActive && _jsx(CountdownOverlay, {}), _jsxs("div", { className: "flex justify-between items-center p-1 sm:p-2", children: [_jsx("button", { onClick: handleExit, className: "px-2 py-1 font-staatliches sm:px-2 sm:py-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-md border border-gray-600 transition-all duration-200 text-xs", children: model.started ? "Exit Game" : "Back to Lobby" }), _jsx("div", { className: "text-gray-400 text-xs font-staatliches ", children: roomCode ? (_jsxs(_Fragment, { children: ["Room ", _jsx("span", { className: "text-white font-mono", children: roomCode })] })) : (_jsxs(_Fragment, { children: ["Mode ", _jsx("span", { className: "text-white font-mono", children: bettingEnabled ? "betting" : "normal" })] })) })] }), showGameOver && _jsx(WinnerRewardPanel, {}), _jsx("div", { className: "px-1 sm:px-2 py-1 sm:py-2", children: _jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsx("div", { className: "mb-2 sm:mb-3", children: _jsxs("div", { className: "relative bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700", children: [getTrackLanes().map((lane) => (_jsx("div", { className: "absolute left-0 transform -translate-x-full -translate-y-1/2 pr-2 flex items-center", style: { top: `${lane.yPosition + 37}px` }, children: _jsxs("div", { className: `text-xs font-semibold font-staatliches whitespace-nowrap ${lane.isCurrentPlayer ? "text-blue-400" : "text-white"}`, children: [getTruncatedName(lane.player.initials || lane.id), lane.isCurrentPlayer && (_jsx("span", { className: "text-blue-400 ml-1 font-staatliches", children: "(You)" }))] }) }, `name-${lane.id}`))), getTrackLanes().map((lane) => (_jsxs("div", { className: "absolute right-0 transform translate-x-full -translate-y-1/2 pl-2", style: { top: `${lane.yPosition + 37}px` }, children: [_jsxs("div", { className: "text-xs text-gray-400 font-staatliches", children: [Math.round(lane.player.progress), "%"] }), lane.player.progress >= 100 && (_jsx("div", { className: "text-xs text-yellow-400 font-bold font-staatliches", children: bettingEnabled ? "WINNER!" : "FINISHED!" }))] }, `progress-${lane.id}`))), _jsxs("div", { className: "relative bg-gray-700 rounded-md border-3 border-gray-600 overflow-hidden", style: { height: `${getTrackLanes().length * 50}px` }, children: [getTrackLanes().map((lane, index) => index > 0 && (_jsx("div", { className: "absolute left-0 right-0 h-0.5 bg-gray-600", style: { top: `${lane.yPosition}px` } }, `divider-${index}`))), getTrackLanes().map((lane, index) => (_jsx("div", { className: "absolute left-0 right-0 h-0.5 border-t-2 border-dotted border-gray-500", style: { top: `${lane.yPosition + 25}px` } }, `centerline-${index}`))), _jsx("div", { className: "absolute left-8 top-0 bottom-0 w-1 bg-white" }), _jsx("div", { className: "absolute right-0 top-0 bottom-0 w-3", children: _jsx("div", { className: "grid grid-cols-2 h-full", children: Array.from({ length: getTrackLanes().length * 3 }, (_, i) => (_jsx("div", { className: `${i % 2 === 0 ? "bg-white" : "bg-black"} border border-gray-400` }, i))) }) }), getTrackLanes().map((lane) => (_jsxs("div", { className: `absolute transform -translate-y-1/2 transition-all duration-500 ease-out ${lane.player.progress >= 100 ? "animate-bounce" : ""}`, style: {
                                                    left: `${getIndexProgress(lane.player)}%`,
                                                    top: `${lane.yPosition + 25}px`,
                                                }, children: [_jsx("div", { className: "w-14 h-14 sm:w-16 sm:h-18", children: _jsx("img", { src: getPlayerAvatar(lane.id, lane.player), alt: lane.player.initials || lane.id, className: "w-full h-full object-cover", onError: (e) => {
                                                                e.currentTarget.src = DEFAULT_AVATAR;
                                                            } }) }), lane.player.progress >= 100 && (_jsx("div", { className: "absolute -top-5 left-1/2 transform -translate-x-1/2", children: _jsx("span", { className: "text-sm", children: bettingEnabled ? "💰" : "👑" }) }))] }, lane.id)))] })] }) }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2", children: [_jsxs("div", { className: "bg-gray-900 rounded-md p-2 text-center border border-gray-700", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1 font-staatliches", children: "Time" }), _jsxs("div", { className: `text-sm font-bold ${getTimeColor()}`, children: [model.timeLeft, "s"] })] }), _jsxs("div", { className: "bg-gray-900 rounded-md p-2 text-center border border-gray-700", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1 font-staatliches", children: "Players" }), _jsxs("div", { className: "text-sm font-bold", children: [model.players.size, "/", model.maxPlayers || 6] })] }), _jsxs("div", { className: "bg-gray-900 rounded-md p-2 text-center border border-gray-700", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1 font-staatliches", children: "WPM" }), _jsx("div", { className: "text-sm font-bold", children: player.wpm || 0 })] }), bettingEnabled && roomData ? (_jsxs("div", { className: "bg-gray-900 rounded-md p-2 text-center border border-gray-700", children: [_jsxs("div", { className: "text-xs text-gray-400 mb-1 font-staatliches", children: ["Prize ", hasOptimizedFlow && "⚡"] }), _jsxs("div", { className: "text-sm font-bold text-yellow-300", children: [roomData.totalPot, " ", networkInfo.currency] })] })) : (_jsxs("div", { className: "bg-gray-900 rounded-md p-2 text-center border border-gray-700", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1 font-staatliches", children: "Score" }), _jsx("div", { className: "text-sm font-bold", children: player.score })] }))] })] }) }), _jsx("div", { className: "px-2 sm:px-3 py-2 sm:py-3", children: _jsx("div", { className: "max-w-5xl mx-auto", children: gameState === "waiting" ? (_jsxs("div", { className: "text-center bg-gray-900 rounded-md p-6 border border-gray-700", children: [_jsx("h2", { className: "text-xl font-bold text-white mb-2 font-staatliches", children: "Waiting for Players" }), _jsxs("p", { className: "text-gray-400 mb-4 font-staatliches", children: [model.players.size, " of ", model.maxPlayers || 6, " players joined"] }), bettingEnabled && roomData && (_jsx("div", { className: "mb-2", children: _jsxs("p", { className: "text-yellow-300 mb-1 font-staatliches", children: ["Prize Pool: ", roomData.totalPot, " ", networkInfo.currency] }) })), model.players.size >= 2 && (_jsx("p", { className: "text-green-400 font-staatliches", children: "Game will start when host clicks start!" }))] })) : gameState === "playing" && !isCompleted ? (_jsx("div", { className: "text-center", children: renderChunkedText() })) : (_jsx("div", { className: "text-center", children: showGameOver ? (_jsxs("div", { className: "space-y-3 bg-gray-900 rounded-md p-6 border border-gray-700", children: [_jsx("h2", { className: "text-lg font-bold text-white mb-2 font-staatliches", children: isCompleted
                                        ? "Race Finished!"
                                        : player.score === model.words.length
                                            ? "Perfect Score!"
                                            : "Game Over!" }), _jsxs("div", { className: "text-base mb-2 font-staatliches", children: ["Final Score:", " ", _jsx("span", { className: "font-bold", children: player.score }), " /", " ", model.words.length, " words"] }), _jsxs("div", { className: "grid grid-cols-3 gap-2 mb-2 text-sm", children: [_jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "WPM" }), _jsx("div", { className: "text-white font-bold font-staatliches", children: player.wpm || 0 })] }), _jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "Accuracy" }), _jsxs("div", { className: "text-white font-bold", children: [player.score > 0
                                                            ? Math.round((player.score / currentIndex) * 100)
                                                            : 100, "%"] })] }), _jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "Progress" }), _jsxs("div", { className: "text-white font-bold", children: [Math.round(player.progress) || 0, "%"] })] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-2 justify-center items-center", children: [_jsx("button", { onClick: () => setShowShareModal(true), className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches", children: "Share Results" }), isHost && (_jsx("button", { onClick: handleExit, className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-staatliches", children: "Exit Game" }))] })] })) : (_jsxs("div", { className: "space-y-2 bg-gray-900 rounded-md p-3 sm:p-4 border border-gray-700", children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-white mb-2 font-staatliches", children: "Ready to Race?" }), _jsxs("p", { className: "text-gray-400 mb-2 text-xs font-staatliches", children: [bettingEnabled ? (hasOptimizedFlow ? "Optimized Betting" : "Betting") : "Multiplayer", " typing challenge with ", model.words.length, " words"] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 text-xs", children: [_jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "Theme" }), _jsx("div", { className: "text-white font-semibold", children: model.theme || "Default" })] }), _jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "Max Length" }), _jsx("div", { className: "text-white font-semibold", children: model.words.length })] }), _jsxs("div", { className: "text-gray-400 font-staatliches", children: [_jsx("div", { children: "Time Limit" }), _jsxs("div", { className: "text-white font-semibold", children: [model.timeLimit, "s"] })] }), bettingEnabled && roomData && (_jsxs("div", { className: "text-yellow-400 font-staatliches", children: [_jsx("div", { children: "Prize Pool" }), _jsxs("div", { className: "text-yellow-200 font-semibold", children: [roomData.totalPot, " ", networkInfo.currency] })] }))] }), isHost && model.players.size >= 2 && (_jsx("button", { onClick: handleExit, className: "px-3 sm:px-4 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-md text-xs sm:text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200", children: "Exit Game" }))] })) })) }) }), gameState === "playing" && !isCompleted && !model.countdownActive && (_jsx("div", { className: "px-1 sm:px-2 pb-2", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsx("label", { className: "block text-gray-400 text-xs mb-1 font-staatliches", children: "Type here" }), _jsx("input", { ref: inputRef, value: inputValue, onChange: (e) => {
                                if (gameState === "playing") {
                                    setInputValue(e.target.value);
                                }
                            }, onKeyDown: (e) => {
                                if ([" ", "Enter"].includes(e.key)) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }, className: `w-full px-2 py-2 text-sm bg-white rounded-md text-black focus:outline-none transition-all duration-200 ${wordError
                                ? "ring-2 ring-red-500"
                                : "focus:ring-2 focus:ring-blue-500"}`, placeholder: word || "Start typing..." }), _jsxs("div", { className: "mt-1 text-center text-gray-400 text-xs font-staatliches", children: ["Press space or enter to submit", bettingEnabled && roomData && (_jsxs("span", { className: "text-yellow-400 ml-2 font-staatliches", children: ["Win ", roomData.totalPot, " ", networkInfo.currency, " ", hasOptimizedFlow ? " instantly!" : "!"] }))] })] }) })), (gameState === "waiting" || showGameOver || gameState === "ready") && (_jsxs(_Fragment, { children: [_jsx(SimpleLeaderboard, {}), _jsx(ShareModal, {}), _jsx(EndGameModal, {})] }))] }));
}
