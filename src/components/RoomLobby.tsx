import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useReactModelRoot,
  useSession,
  useDetachCallback,
  usePublish,
  useSubscribe,
  useViewId,
  useLeaveSession,
} from "@multisynq/react";
import { TypingModel } from "../multisynq/TypingModel";
import { useUserData } from "../contexts/UserContext";
import { useWeb3 } from "../contexts/Web3Context";
import { useOptimizedBettingContract } from "../hooks/useBettingContract";
import BetConfirmationModal from "./BetConfirmationModal";
import toast from "react-hot-toast";
import { SendIcon } from "lucide-react";
import { ChatMessage } from "../../type/global";
import { getNetworkInfo } from "../config/bettingContract";
const DEFAULT_AVATAR = "/avatars/avatar1.png";

export default function OptimizedRoomLobby() {
  const model = useReactModelRoot<TypingModel>();
  const { code } = useParams();
  const networkInfo = getNetworkInfo();
  const navigate = useNavigate();
  const viewId = useViewId();
  const leaveSession = useLeaveSession();

  const { isConnected, address } = useWeb3();
  const [showBetModal, setShowBetModal] = useState(false);
  const [hasBetModalShown, setHasBetModalShown] = useState(false);

  const { userData } = useUserData();

  const roomModel = model as any;
  const bettingEnabled = roomModel?.enableBetting;

  const {
    roomData,
    isHost: isBettingHost,
    isPlayer: isBettingPlayer,
    canJoin,
    joinRoom,
    isLoading: isBettingLoading,
    hasOptimizedFlow,
    totalTransactionsNeeded
  } = useOptimizedBettingContract(
    code || "",
    bettingEnabled && isConnected
  );

  const lastPlayersRef = useRef<string>("");
  const initsSentRef = useRef(false);
  const settingsInitializedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useDetachCallback(() => {
    leaveSession();
  });

  // Existing publish functions
  const sendStart = usePublish(() => ["game", "start"]);
  const sendInitials = usePublish<string>((initials) => [
    viewId!,
    "set-initials",
    initials,
  ]);
  const sendAvatar = usePublish<string>((url) => [viewId!, "set-avatar", url]);
 
  const initializeRoomSettings = usePublish<any>((settings) => [
    "room",
    "initialize-settings",
    settings
  ]);
  const sendChatMessage = usePublish<ChatMessage>((message) => [
    "chat",
    "message",
    message
  ]);

  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState(
    Array.from(model?.players.entries() || [])
  );

  useEffect(() => {
    if (
      bettingEnabled &&
      roomData &&
      canJoin &&
      isConnected &&
      !hasBetModalShown &&
      !isBettingPlayer &&
      !isHost &&
      !isBettingHost
    ) {
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
    if (!isHost) return;

    if (!canActuallyStart()) {
      if (bettingEnabled) {
        toast.error("Need more players in betting pool!");
      } else {
        toast.error("Need at least 2 players to start!");
      }
      return;
    }

    try {
      toast.success("Starting typing challenge...");
      sendStart();
    } catch (error) {
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
    } catch (error: any) {
      console.error('Manual bet error:', error);
      toast.error(error.message || "Failed to join betting pool");
    }
  };

  const getPlayerBettingStatus = (playerId: string) => {
    if (!bettingEnabled || !roomData || !address) return null;

    if (playerId === viewId) {
      if (isHost || isBettingHost) {
        return "joined";
      }
      return isBettingPlayer ? "joined" : "pending";
    }
    return "unknown";
  };

  const BettingStatusIndicator = ({ playerId, player }: { playerId: string, player: any }) => {
    if (!bettingEnabled) return null;

    const status = getPlayerBettingStatus(playerId);

    return (
      <div className="mt-2">
        {status === "joined" && (
          <span className="bg-green-700 text-white text-xs px-2 py-1 rounded block text-center font-staatliches">
            Bet Placed
          </span>
        )}

        {status === "pending" && isConnected && (
          <button
            onClick={handleManualBet}
            disabled={isBettingLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 rounded transition-colors duration-200 w-full font-staatliches"
          >
            {isBettingLoading ? "Betting..." : `Bet ${roomData?.betAmount} ${networkInfo.currency}`}
          </button>
        )}

        {playerId === viewId && bettingEnabled && !isConnected && (
          <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded block text-center font-staatliches">
            Connect Wallet
          </span>
        )}
      </div>
    );
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
      } else if (playersInBettingPool < playersInLobby) {
        const betsNeeded = playersInLobby - playersInBettingPool;
        return `Waiting for ${betsNeeded} Player${betsNeeded === 1 ? '' : 's'} to Bet`;
      } else {
        return `Start Typing Challenge (${playersInLobby}/${maxPlayersFromSettings} Ready)`;
      }
    }

    return `Start Game (${players.length}/${maxPlayersFromSettings})`;
  };

  const handleChatMessage = useCallback((message: ChatMessage) => {
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
    if (!model) return;

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

  const getPlayerAvatar = useCallback((playerId: string, player: any) => {
    if (playerId === viewId) {
      return userData.avatarUrl;
    }
    return player.avatarUrl || DEFAULT_AVATAR;
  }, [viewId, userData.avatarUrl]);

  const getPlayerName = useCallback((playerId: string, player: any) => {
    if (playerId === viewId) {
      return userData.initials || "You";
    }
    return player.initials || `Guest_${playerId.substring(0, 6)}`;
  }, [viewId, userData.initials]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !viewId) return;

    const message: ChatMessage = {
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

  const formatTime = useCallback((timestamp: number) => {
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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400 font-staatliches">Loading lobby</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Header */}
      <div className="flex justify-between items-center p-3 sm:p-4">
        <button
          onClick={handleExit}
          className="top-4 left-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm"
        >
          ← Back
        </button>
        <div className="text-gray-400 text-sm font-staatliches">
          {bettingEnabled ? "BETTING" : "MULTIPLAYER"}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-6">
            <p className="text-gray-400 font-staatliches text-sm mb-2 uppercase tracking-wide">Room Code</p>
            <div
              onClick={() => {
                if (code) {
                  navigator.clipboard.writeText(code);
                  toast.success("Room code copied");
                }
              }}
              className="inline-block bg-gray-900 px-4 py-2 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800 transition duration-200"
            >
              <span className="text-xl font-staatliches text-white tracking-widest">
                {code}
              </span>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4  shadow-2xl border border-gray-700 mb-4">
            <h3 className="text-white font-staatliches text-sm mb-3 text-center uppercase tracking-wide">
              Game Settings
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-600">
                <div className="text-xs text-gray-400 font-staatliches mb-1">THEME</div>
                <div className="text-white font-staatliches text-sm capitalize">
                  {model.theme}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-600">
                <div className="text-xs text-gray-400 font-staatliches mb-1">WORDS</div>
                <div className="text-white font-staatliches text-sm">
                  {model.sentenceLength}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-600">
                <div className="text-xs text-gray-400 font-staatliches mb-1">TIME</div>
                <div className="text-white font-staatliches text-sm">
                  {model.timeLimit}s
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-600">
                <div className="text-xs text-gray-400 font-staatliches mb-1">PLAYERS</div>
                <div className="text-white font-staatliches text-sm">
                  {players.length}/{model.maxPlayers}
                </div>
              </div>
            </div>

            {bettingEnabled && roomData && (
              <div className="mt-3 p-2 bg-gray-800 border border-gray-600 rounded-lg">
                <div className="text-center">
                  <span className="text-gray-400 text-xs font-staatliches">
                    Bet: {roomData.betAmount} {networkInfo.currency} • Pool: {roomData.totalPot} {networkInfo.currency}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Players Section */}
          <div className=" mb-4">
            <h3 className="text-white font-staatliches text-sm mb-3 text-center uppercase tracking-wide">
              Players ({players.length}/{model.maxPlayers})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map(([id, player]) => (
                <div
                  key={id}
                  className="bg-gray-800 rounded-lg p-3 border border-gray-600"
                >
                  <div className="flex items-start space-x-3">
                    <img
                      src={getPlayerAvatar(id, player)}
                      alt={getPlayerName(id, player)}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-staatliches text-white text-sm">
                          {getPlayerName(id, player)}
                        </span>
                        {id === viewId && (
                          <span style={{ backgroundColor: "#836ef9" }} className="text-white text-xs px-2 py-1 rounded font-staatliches">
                            YOU
                          </span>
                        )}
                        {players[0] && players[0][0] === id && (
                          <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded font-staatliches">
                            HOST
                          </span>
                        )}
                      </div>
                      <BettingStatusIndicator playerId={id} player={player} />
                    </div>
                  </div>
                </div>
              ))}


              {Array.from({ length: model.maxPlayers - players.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="bg-gray-800 rounded-lg p-3 border-2 border-dashed border-gray-600 opacity-50"
                >
                  <div className="flex items-center justify-center h-10">
                    <span className="text-gray-500 text-xs font-staatliches">Waiting for player</span>
                  </div>
                </div>
              ))}
            </div>

          
          </div>

         
          <div className="text-center">
            {isHost ? (
              <div className="space-y-4">
                <button
                  onClick={handleStart}
                  disabled={!canActuallyStart() || isBettingLoading}
                  className="mt-10 hover:bg-gray-100 py-2 px-8 rounded-lg btn-lby transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isBettingLoading ? "Starting..." : 
                   canActuallyStart() ? "Start Game" : 
                   bettingEnabled ? "Waiting for all players to bet" : "Need more players"}
                </button>

                {/* ✅ ADDED: Host betting reminder */}
                {bettingEnabled && !isBettingPlayer && (
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                    <p className="text-yellow-200 text-sm">
                      ⚠️ As host, you need to join the betting pool before starting
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-lg">
                  Waiting for host to start the game...
                </p>
                
                {/* Manual Bet Button for non-hosts */}
                {bettingEnabled && canJoin && isConnected && !isBettingPlayer && (
                  <button
                    onClick={() => setShowBetModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Join Betting Pool ({roomData?.betAmount || '0'} {networkInfo.currency})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-6 px-8 border-t border-gray-800">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            Share room code with friends to join • Click room code to copy
          </p>
        </div>
      </footer>

      {/* Chat Toggle Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-full shadow-lg transition-all duration-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-staatliches">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-20 right-6 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-40">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-sm font-staatliches text-white uppercase tracking-wide">Room Chat</h3>
            <button
              onClick={toggleChat}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            ref={chatScrollRef}
            className="h-48 overflow-y-auto p-3 space-y-2 bg-gray-800"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-6">
                <p className="text-xs font-staatliches">No messages yet</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-2 ${msg.viewId === viewId ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <img
                    src={msg.avatarUrl || DEFAULT_AVATAR}
                    alt={msg.initials}
                    className="w-6 h-6 rounded-full object-cover border border-gray-600"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div className={`max-w-[70%] ${msg.viewId === viewId ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-staatliches text-gray-300">
                        {msg.viewId === viewId ? 'You' : msg.initials}
                      </span>
                      <span className="text-xs text-gray-500 font-staatliches">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-staatliches ${msg.viewId === viewId
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                        }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type a message"
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-staatliches"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!currentMessage.trim()}
                style={{ backgroundColor: "#836ef9" }}
                className=" disabled:bg-gray-600 text-white px-2 py-1 rounded transition-colors duration-200"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

  {/* Betting Confirmation Modal */}
  {bettingEnabled && roomData && !isHost && !isBettingHost && (
        <BetConfirmationModal
          isOpen={showBetModal}
          onClose={() => setShowBetModal(false)}
          roomId={code || ""}
          betAmount={roomData.betAmount}
          hostName={players.find(([id]) => id === players[0]?.[0])?.[1]?.initials || "Host"}
          onConfirmed={() => {
            setShowBetModal(false);
          }}
          isOptimized={hasOptimizedFlow}
        />
      )}
    </div>
  );
}