import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useReactModelRoot, useDetachCallback, usePublish, useSubscribe, useViewId, useLeaveSession, } from "@multisynq/react";
import { useUserData } from "../contexts/UserContext";
import { useWeb3 } from "../contexts/Web3Context";
import { useOptimizedBettingContract } from "../hooks/useBettingContract";
import BetConfirmationModal from "./BetConfirmationModal";
import toast from "react-hot-toast";
import { SendIcon } from "lucide-react";
import { getNetworkInfo } from "../config/bettingContract";
const DEFAULT_AVATAR = "/avatars/avatar1.png";
export default function OptimizedRoomLobby() {
    const model = useReactModelRoot();
    const { code } = useParams();
    const networkInfo = getNetworkInfo();
    const navigate = useNavigate();
    const viewId = useViewId();
    const leaveSession = useLeaveSession();
    const { isConnected, address } = useWeb3();
    const [showBetModal, setShowBetModal] = useState(false);
    const [hasBetModalShown, setHasBetModalShown] = useState(false);
    const { userData } = useUserData();
    const roomModel = model;
    const bettingEnabled = roomModel?.enableBetting;
    const { roomData, isHost: isBettingHost, isPlayer: isBettingPlayer, canJoin, joinRoom, isLoading: isBettingLoading, hasOptimizedFlow, totalTransactionsNeeded } = useOptimizedBettingContract(code || "", bettingEnabled && isConnected);
    const lastPlayersRef = useRef("");
    const initsSentRef = useRef(false);
    const settingsInitializedRef = useRef(false);
    const chatScrollRef = useRef(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState("");
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    useDetachCallback(() => {
        leaveSession();
    });
    // Existing publish functions
    const sendStart = usePublish(() => ["game", "start"]);
    const sendInitials = usePublish((initials) => [
        viewId,
        "set-initials",
        initials,
    ]);
    const sendAvatar = usePublish((url) => [viewId, "set-avatar", url]);
    const initializeRoomSettings = usePublish((settings) => [
        "room",
        "initialize-settings",
        settings
    ]);
    const sendChatMessage = usePublish((message) => [
        "chat",
        "message",
        message
    ]);
    const [isHost, setIsHost] = useState(false);
    const [players, setPlayers] = useState(Array.from(model?.players.entries() || []));
    useEffect(() => {
        if (bettingEnabled &&
            roomData &&
            canJoin &&
            isConnected &&
            !hasBetModalShown &&
            !isBettingPlayer &&
            !isHost &&
            !isBettingHost) {
            setShowBetModal(true);
            setHasBetModalShown(true);
        }
    }, [
        bettingEnabled,
        roomData,
        canJoin,
        isConnected,
        hasBetModalShown,
        isBettingPlayer,
        isHost,
        isBettingHost
    ]);
    const canActuallyStart = () => {
        if (!bettingEnabled) {
            return players.length >= 2;
        }
        const allPlayersJoined = roomData?.playerCount === players.length;
        const maxPlayersFromSettings = model?.maxPlayers || 2;
        const reachedMaxCapacity = players.length >= maxPlayersFromSettings;
        return reachedMaxCapacity && allPlayersJoined;
    };
    const handleStart = async () => {
        if (!isHost)
            return;
        if (!canActuallyStart()) {
            if (bettingEnabled) {
                toast.error("Need more players in betting pool!");
            }
            else {
                toast.error("Need at least 2 players to start!");
            }
            return;
        }
        try {
            toast.success("Starting typing challenge...");
            sendStart();
        }
        catch (error) {
            console.error("Failed to start game:", error);
            toast.error("Failed to start game");
        }
    };
    const handleManualBet = async () => {
        if (!roomData?.betAmount) {
            toast.error("Betting amount not available");
            return;
        }
        try {
            await joinRoom(roomData.betAmount);
            toast.success('Joined betting pool!');
        }
        catch (error) {
            console.error('Manual bet error:', error);
            toast.error(error.message || "Failed to join betting pool");
        }
    };
    const getPlayerBettingStatus = (playerId) => {
        if (!bettingEnabled || !roomData || !address)
            return null;
        if (playerId === viewId) {
            if (isHost || isBettingHost) {
                return "joined";
            }
            return isBettingPlayer ? "joined" : "pending";
        }
        return "unknown";
    };
    const BettingStatusIndicator = ({ playerId, player }) => {
        if (!bettingEnabled)
            return null;
        const status = getPlayerBettingStatus(playerId);
        return (_jsxs("div", { className: "mt-2", children: [status === "joined" && (_jsx("span", { className: "bg-green-700 text-white text-xs px-2 py-1 rounded block text-center font-staatliches", children: "Bet Placed" })), status === "pending" && isConnected && (_jsx("button", { onClick: handleManualBet, disabled: isBettingLoading, className: "bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 rounded transition-colors duration-200 w-full font-staatliches", children: isBettingLoading ? "Betting..." : `Bet ${roomData?.betAmount} ${networkInfo.currency}` })), playerId === viewId && bettingEnabled && !isConnected && (_jsx("span", { className: "bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded block text-center font-staatliches", children: "Connect Wallet" }))] }));
    };
    const getStartButtonMessage = () => {
        const maxPlayersFromSettings = model?.maxPlayers || 2;
        if (players.length < 2) {
            return "Need More Players (Min 2)";
        }
        if (bettingEnabled) {
            if (!roomData) {
                return "Loading Room Data";
            }
            const playersInBettingPool = roomData.playerCount;
            const playersInLobby = players.length;
            if (playersInLobby < maxPlayersFromSettings) {
                const playersNeeded = maxPlayersFromSettings - playersInLobby;
                return `Waiting for ${playersNeeded} More Player${playersNeeded === 1 ? '' : 's'} (${playersInLobby}/${maxPlayersFromSettings})`;
            }
            else if (playersInBettingPool < playersInLobby) {
                const betsNeeded = playersInLobby - playersInBettingPool;
                return `Waiting for ${betsNeeded} Player${betsNeeded === 1 ? '' : 's'} to Bet`;
            }
            else {
                return `Start Typing Challenge (${playersInLobby}/${maxPlayersFromSettings} Ready)`;
            }
        }
        return `Start Game (${players.length}/${maxPlayersFromSettings})`;
    };
    const handleChatMessage = useCallback((message) => {
        setChatMessages(prev => [...prev, message]);
        if (!isChatOpen) {
            setUnreadCount(prev => prev + 1);
        }
    }, [isChatOpen]);
    useSubscribe("chat", "message-received", handleChatMessage);
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);
    useEffect(() => {
        if (isChatOpen) {
            setUnreadCount(0);
        }
    }, [isChatOpen]);
    const updatePlayers = useCallback(() => {
        if (!model)
            return;
        const entries = Array.from(model.players.entries());
        const playersKey = entries.map(([id, p]) => `${id}:${p.initials}`).join("|");
        if (playersKey !== lastPlayersRef.current) {
            lastPlayersRef.current = playersKey;
            setPlayers(entries);
            if (viewId && entries.length > 0) {
                const firstViewId = entries[0][0];
                setIsHost(viewId === firstViewId);
            }
        }
    }, [model, viewId]);
    useSubscribe("view", "update", updatePlayers);
    useEffect(() => {
        if (model && viewId && !initsSentRef.current) {
            sendInitials(userData.initials);
            sendAvatar(userData.avatarUrl);
            initsSentRef.current = true;
        }
    }, [model, viewId, sendInitials, sendAvatar, userData.initials, userData.avatarUrl]);
    useEffect(() => {
        if (model?.chatMessages && model.chatMessages.length !== chatMessages.length) {
            setChatMessages(model.chatMessages);
        }
    }, [model?.chatMessages?.length]);
    useEffect(() => {
        if (model && viewId && !settingsInitializedRef.current && model.players.size <= 1) {
            if (userData.roomSettings && Object.keys(userData.roomSettings).length > 0) {
                initializeRoomSettings(userData.roomSettings);
                settingsInitializedRef.current = true;
            }
        }
    }, [model, viewId, initializeRoomSettings, userData.roomSettings]);
    useEffect(() => {
        if (model?.countdownActive && code) {
            setTimeout(() => {
                navigate(`/room/${code}`);
            }, 100);
        }
    }, [model?.countdownActive, code, navigate]);
    const getPlayerAvatar = useCallback((playerId, player) => {
        if (playerId === viewId) {
            return userData.avatarUrl;
        }
        return player.avatarUrl || DEFAULT_AVATAR;
    }, [viewId, userData.avatarUrl]);
    const getPlayerName = useCallback((playerId, player) => {
        if (playerId === viewId) {
            return userData.initials || "You";
        }
        return player.initials || `Guest_${playerId.substring(0, 6)}`;
    }, [viewId, userData.initials]);
    const handleSendMessage = useCallback((e) => {
        e.preventDefault();
        if (!currentMessage.trim() || !viewId)
            return;
        const message = {
            id: `${viewId}-${Date.now()}`,
            viewId,
            initials: userData.initials,
            avatarUrl: userData.avatarUrl,
            message: currentMessage.trim(),
            timestamp: Date.now()
        };
        sendChatMessage(message);
        setCurrentMessage("");
    }, [currentMessage, viewId, userData.initials, userData.avatarUrl, sendChatMessage]);
    const toggleChat = useCallback(() => {
        setIsChatOpen(prev => !prev);
    }, []);
    const formatTime = useCallback((timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);
    const handleExit = () => {
        leaveSession();
        navigate("/multiplayer");
    };
    if (!model || !viewId) {
        return (_jsx("div", { className: "min-h-screen bg-black text-white flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" }), _jsx("p", { className: "text-gray-400 font-staatliches", children: "Loading lobby" })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-black text-white relative", children: [_jsxs("div", { className: "flex justify-between items-center p-3 sm:p-4", children: [_jsx("button", { onClick: handleExit, className: "top-4 left-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm", children: "\u2190 Back" }), _jsx("div", { className: "text-gray-400 text-sm font-staatliches", children: bettingEnabled ? "BETTING" : "MULTIPLAYER" })] }), _jsx("div", { className: "flex items-center justify-center p-4 min-h-[calc(100vh-80px)]", children: _jsxs("div", { className: "w-full max-w-4xl", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("p", { className: "text-gray-400 font-staatliches text-sm mb-2 uppercase tracking-wide", children: "Room Code" }), _jsx("div", { onClick: () => {
                                        if (code) {
                                            navigator.clipboard.writeText(code);
                                            toast.success("Room code copied");
                                        }
                                    }, className: "inline-block bg-gray-900 px-4 py-2 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800 transition duration-200", children: _jsx("span", { className: "text-xl font-staatliches text-white tracking-widest", children: code }) })] }), _jsxs("div", { className: "bg-gray-900 rounded-2xl p-4  shadow-2xl border border-gray-700 mb-4", children: [_jsx("h3", { className: "text-white font-staatliches text-sm mb-3 text-center uppercase tracking-wide", children: "Game Settings" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-center", children: [_jsxs("div", { className: "bg-gray-800 rounded-lg p-2 border border-gray-600", children: [_jsx("div", { className: "text-xs text-gray-400 font-staatliches mb-1", children: "THEME" }), _jsx("div", { className: "text-white font-staatliches text-sm capitalize", children: model.theme })] }), _jsxs("div", { className: "bg-gray-800 rounded-lg p-2 border border-gray-600", children: [_jsx("div", { className: "text-xs text-gray-400 font-staatliches mb-1", children: "WORDS" }), _jsx("div", { className: "text-white font-staatliches text-sm", children: model.sentenceLength })] }), _jsxs("div", { className: "bg-gray-800 rounded-lg p-2 border border-gray-600", children: [_jsx("div", { className: "text-xs text-gray-400 font-staatliches mb-1", children: "TIME" }), _jsxs("div", { className: "text-white font-staatliches text-sm", children: [model.timeLimit, "s"] })] }), _jsxs("div", { className: "bg-gray-800 rounded-lg p-2 border border-gray-600", children: [_jsx("div", { className: "text-xs text-gray-400 font-staatliches mb-1", children: "PLAYERS" }), _jsxs("div", { className: "text-white font-staatliches text-sm", children: [players.length, "/", model.maxPlayers] })] })] }), bettingEnabled && roomData && (_jsx("div", { className: "mt-3 p-2 bg-gray-800 border border-gray-600 rounded-lg", children: _jsx("div", { className: "text-center", children: _jsxs("span", { className: "text-gray-400 text-xs font-staatliches", children: ["Bet: ", roomData.betAmount, " ", networkInfo.currency, " \u2022 Pool: ", roomData.totalPot, " ", networkInfo.currency] }) }) }))] }), _jsxs("div", { className: " mb-4", children: [_jsxs("h3", { className: "text-white font-staatliches text-sm mb-3 text-center uppercase tracking-wide", children: ["Players (", players.length, "/", model.maxPlayers, ")"] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: [players.map(([id, player]) => (_jsx("div", { className: "bg-gray-800 rounded-lg p-3 border border-gray-600", children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("img", { src: getPlayerAvatar(id, player), alt: getPlayerName(id, player), className: "w-10 h-10 rounded-full object-cover border-2 border-gray-600", onError: (e) => {
                                                            e.currentTarget.src = DEFAULT_AVATAR;
                                                        } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx("span", { className: "font-staatliches text-white text-sm", children: getPlayerName(id, player) }), id === viewId && (_jsx("span", { style: { backgroundColor: "#836ef9" }, className: "text-white text-xs px-2 py-1 rounded font-staatliches", children: "YOU" })), players[0] && players[0][0] === id && (_jsx("span", { className: "bg-yellow-600 text-white text-xs px-2 py-1 rounded font-staatliches", children: "HOST" }))] }), _jsx(BettingStatusIndicator, { playerId: id, player: player })] })] }) }, id))), Array.from({ length: model.maxPlayers - players.length }).map((_, index) => (_jsx("div", { className: "bg-gray-800 rounded-lg p-3 border-2 border-dashed border-gray-600 opacity-50", children: _jsx("div", { className: "flex items-center justify-center h-10", children: _jsx("span", { className: "text-gray-500 text-xs font-staatliches", children: "Waiting for player" }) }) }, `empty-${index}`)))] })] }), _jsx("div", { className: "text-center", children: isHost ? (_jsxs("div", { className: "space-y-4", children: [_jsx("button", { onClick: handleStart, disabled: !canActuallyStart() || isBettingLoading, className: "mt-10 hover:bg-gray-100 py-2 px-8 rounded-lg btn-lby transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none", children: isBettingLoading ? "Starting..." :
                                            canActuallyStart() ? "Start Game" :
                                                bettingEnabled ? "Waiting for all players to bet" : "Need more players" }), bettingEnabled && !isBettingPlayer && (_jsx("div", { className: "bg-yellow-900/30 border border-yellow-600 rounded-lg p-3", children: _jsx("p", { className: "text-yellow-200 text-sm", children: "\u26A0\uFE0F As host, you need to join the betting pool before starting" }) }))] })) : (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-gray-400 text-lg", children: "Waiting for host to start the game..." }), bettingEnabled && canJoin && isConnected && !isBettingPlayer && (_jsxs("button", { onClick: () => setShowBetModal(true), className: "bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors", children: ["Join Betting Pool (", roomData?.betAmount || '0', " ", networkInfo.currency, ")"] }))] })) })] }) }), _jsx("footer", { className: "w-full py-6 px-8 border-t border-gray-800", children: _jsx("div", { className: "text-center", children: _jsx("p", { className: "text-gray-500 text-sm", children: "Share room code with friends to join \u2022 Click room code to copy" }) }) }), _jsxs("button", { onClick: toggleChat, className: "fixed bottom-6 right-6 bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full shadow-lg transition-all duration-200", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }), unreadCount > 0 && (_jsx("span", { className: "absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-staatliches", children: unreadCount > 9 ? '9+' : unreadCount }))] }), isChatOpen && (_jsxs("div", { className: "fixed bottom-20 right-6 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-40", children: [_jsxs("div", { className: "flex items-center justify-between p-3 border-b border-gray-700", children: [_jsx("h3", { className: "text-sm font-staatliches text-white uppercase tracking-wide", children: "Room Chat" }), _jsx("button", { onClick: toggleChat, className: "text-gray-400 hover:text-white transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { ref: chatScrollRef, className: "h-48 overflow-y-auto p-3 space-y-2 bg-gray-800", children: chatMessages.length === 0 ? (_jsx("div", { className: "text-center text-gray-500 py-6", children: _jsx("p", { className: "text-xs font-staatliches", children: "No messages yet" }) })) : (chatMessages.map((msg) => (_jsxs("div", { className: `flex items-start space-x-2 ${msg.viewId === viewId ? 'flex-row-reverse space-x-reverse' : ''}`, children: [_jsx("img", { src: msg.avatarUrl || DEFAULT_AVATAR, alt: msg.initials, className: "w-6 h-6 rounded-full object-cover border border-gray-600", onError: (e) => {
                                        e.currentTarget.src = DEFAULT_AVATAR;
                                    } }), _jsxs("div", { className: `max-w-[70%] ${msg.viewId === viewId ? 'text-right' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "text-xs font-staatliches text-gray-300", children: msg.viewId === viewId ? 'You' : msg.initials }), _jsx("span", { className: "text-xs text-gray-500 font-staatliches", children: formatTime(msg.timestamp) })] }), _jsx("div", { className: `px-2 py-1 rounded text-xs font-staatliches ${msg.viewId === viewId
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-700 text-gray-100'}`, children: msg.message })] })] }, msg.id)))) }), _jsx("form", { onSubmit: handleSendMessage, className: "p-3 border-t border-gray-700", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx("input", { type: "text", value: currentMessage, onChange: (e) => setCurrentMessage(e.target.value), placeholder: "Type a message", className: "flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-staatliches", maxLength: 200 }), _jsx("button", { type: "submit", disabled: !currentMessage.trim(), style: { backgroundColor: "#836ef9" }, className: " disabled:bg-gray-600 text-white px-2 py-1 rounded transition-colors duration-200", children: _jsx(SendIcon, { className: "w-4 h-4" }) })] }) })] })), bettingEnabled && roomData && !isHost && !isBettingHost && (_jsx(BetConfirmationModal, { isOpen: showBetModal, onClose: () => setShowBetModal(false), roomId: code || "", betAmount: roomData.betAmount, hostName: players.find(([id]) => id === players[0]?.[0])?.[1]?.initials || "Host", onConfirmed: () => {
                    setShowBetModal(false);
                }, isOptimized: hasOptimizedFlow }))] }));
}
