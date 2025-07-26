import Lottie from "lottie-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { v4 as uuidv4 } from "uuid";
import loadingAnimation from "../assets/loading.json";
import { useUserData } from "../contexts/UserContext";
import { useWeb3 } from "../contexts/Web3Context";
import { useOptimizedBettingContract } from '../hooks/useBettingContract';
import toast from "react-hot-toast";
import {
  FormData,
  RoomMode,
  RoomSettings,
  RoomSettingsProps,
  Theme,
} from "../../type/global";
import { AI_CONTEXTS, THEMES } from "../config/roomsetting";
import { BETTING_VALIDATION_RULES, VALIDATION_RULES } from "../validation/roomSettingValidation";
import { getNetworkInfo } from "../config/bettingContract";



export default function OptimizedRoomSettings({ mode: propMode }: RoomSettingsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const networkInfo = getNetworkInfo(); 
  const { isConnected } = useWeb3();
  const { playClickSound, updateUserData } = useUserData();
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RoomMode>("multi");
  const [formData, setFormData] = useState<FormData>({
    sentenceLength: "",
    timeLimit: "",
    maxPlayers: "",
    theme: "Monad",
    betAmount: "",
    enableBetting: true,
  });

  const [roomCode] = useState(() => uuidv4().slice(0, 4).toUpperCase());

  const {
    createRoomAndBet,
    isLoading: isContractLoading,
  } = useOptimizedBettingContract(roomCode, mode === "multi" && isConnected);
    // Determine mode from props or query params
    useEffect(() => {
      if (propMode === "create") {
        setMode("multi");
      } else {
        const params = new URLSearchParams(location.search);
        const selectedMode = params.get("mode");
        setMode(selectedMode === "single" ? "single" : "multi");
      }
    }, [propMode, location.search]);




  const getFieldError = useCallback(
    (field: keyof FormData): string | null => {
      if (!touchedFields[field]) return null;

      const value = formData[field] as string;
      const numValue = parseInt(value);

      switch (field) {
        case "sentenceLength":
          if (
            !numValue ||
            numValue < VALIDATION_RULES.SENTENCE_LENGTH.min ||
            numValue > VALIDATION_RULES.SENTENCE_LENGTH.max
          ) {
            return `Sentence length must be between ${VALIDATION_RULES.SENTENCE_LENGTH.min}–${VALIDATION_RULES.SENTENCE_LENGTH.max}`;
          }
          break;
        case "timeLimit":
          if (
            !numValue ||
            numValue < VALIDATION_RULES.TIME_LIMIT.min ||
            numValue > VALIDATION_RULES.TIME_LIMIT.max
          ) {
            return `Time limit must be between ${VALIDATION_RULES.TIME_LIMIT.min}–${VALIDATION_RULES.TIME_LIMIT.max}`;
          }
          break;
        case "maxPlayers":
          if (mode === "multi") {
            if (
              !numValue ||
              numValue < VALIDATION_RULES.MAX_PLAYERS.min ||
              numValue > VALIDATION_RULES.MAX_PLAYERS.max
            ) {
              return `Players must be between ${VALIDATION_RULES.MAX_PLAYERS.min}–${VALIDATION_RULES.MAX_PLAYERS.max}`;
            }
          }
          break;
        case "theme":
          if (!value) return "Please select a theme";
          break;
          case "betAmount":
            const betValue = parseFloat(formData.betAmount);
            if (!betValue || betValue < BETTING_VALIDATION_RULES.MIN_BET) {
              return `Minimum bet is ${BETTING_VALIDATION_RULES.MIN_BET} ${networkInfo.currency}`;
            }
            if (betValue > BETTING_VALIDATION_RULES.MAX_BET) {
              return `Maximum bet is ${BETTING_VALIDATION_RULES.MAX_BET} ${networkInfo.currency}`;
            }
            break;
      }
      return null;
    },
    [formData, mode, touchedFields]
  );


  const handleBlur = useCallback((field: keyof FormData) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Enhanced form validation
  const validation = useMemo(() => {
    const { sentenceLength, timeLimit, maxPlayers, theme, betAmount, enableBetting } = formData;
    const len = parseInt(sentenceLength);
    const time = parseInt(timeLimit);
    const players = parseInt(maxPlayers);

    const errors: string[] = [];

    // Original validations
    if (!theme) errors.push("Please select a theme");
    if (
      !len ||
      len < VALIDATION_RULES.SENTENCE_LENGTH.min ||
      len > VALIDATION_RULES.SENTENCE_LENGTH.max
    ) {
      errors.push(
        `Sentence length must be between ${VALIDATION_RULES.SENTENCE_LENGTH.min}–${VALIDATION_RULES.SENTENCE_LENGTH.max} words`
      );
    }
    if (
      !time ||
      time < VALIDATION_RULES.TIME_LIMIT.min ||
      time > VALIDATION_RULES.TIME_LIMIT.max
    ) {
      errors.push(
        `Time limit must be between ${VALIDATION_RULES.TIME_LIMIT.min}–${VALIDATION_RULES.TIME_LIMIT.max} seconds`
      );
    }
    if (
      mode === "multi" &&
      (!players ||
        players < VALIDATION_RULES.MAX_PLAYERS.min ||
        players > VALIDATION_RULES.MAX_PLAYERS.max)
    ) {
      errors.push(
        `Players must be between ${VALIDATION_RULES.MAX_PLAYERS.min}–${VALIDATION_RULES.MAX_PLAYERS.max}`
      );
    }

    // Betting validations (always required for multiplayer)
    if (mode === "multi" && enableBetting) {
      if (!isConnected) {
        errors.push("Connect wallet to create betting room");
      }

      const betValue = parseFloat(betAmount);
      if (!betValue || betValue < BETTING_VALIDATION_RULES.MIN_BET) {
        errors.push(`Minimum bet is ${BETTING_VALIDATION_RULES.MIN_BET} ${networkInfo.currency}`);
      }
      if (betValue > BETTING_VALIDATION_RULES.MAX_BET) {
        errors.push(`Maximum bet is ${BETTING_VALIDATION_RULES.MAX_BET} ${networkInfo.currency}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [formData, mode, isConnected]);

  const updateFormData = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fetchAIWords = useCallback(
    async (theme: Theme, sentenceLength: number): Promise<{ sentence: string }> => {
      try {
        const contextKey = theme.toLowerCase() as keyof typeof AI_CONTEXTS;
        const context = AI_CONTEXTS[contextKey] || "";

        const prompt = `
        You are a helpful assistant.
        
        ${context}
        
        Generate EXACTLY ${sentenceLength} words related to ${theme}. Return them as a simple sentence separated by spaces.
        
        Respond ONLY with this exact JSON format:
        
        {
          "sentence": "word1 word2 word3... (exactly ${sentenceLength} words total)"
        }
        
        CRITICAL REQUIREMENTS:
        - Output EXACTLY ${sentenceLength} words, count them carefully
        - Each word separated by single space only
        - No punctuation marks (., ! ? etc.)
        - No special characters or symbols
        - Words should be related to "${theme}" theme
        - Double-check the word count before responding
        `;

        const response = await fetch(import.meta.env.VITE_BACKEND_GEMINI_URL, {
          method: "POST",
          body: JSON.stringify({ prompt }),
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("AI fetch failed");

        const data = await response.json();
        return { sentence: data.sentence || "" };
      } catch (error) {
        console.error("Failed to fetch AI sentence:", error);
        toast.error("Failed to fetch AI sentence. Using fallback.");
        return { sentence: "" };
      }
    },
    []
  );

  const processWords = useCallback((sentence: string): string[] => {
    return sentence
      .split(/\s+/)
      .map((word: string) => word.replace(/[.,!?]/g, ""))
      .filter(Boolean);
  }, []);


  const handleCreate = useCallback(async () => {
    if (!validation.isValid || loading || isContractLoading) {
      toast.error(validation.errors[0] || "Please fix form errors");
      return;
    }

    try {
      playClickSound();
      setLoading(true);

      const len = parseInt(formData.sentenceLength);
      const time = parseInt(formData.timeLimit);
      const players = parseInt(formData.maxPlayers);
      const theme = formData.theme as Theme;

      // Generate AI words first
      toast.success("Generating words...");
      const response = await fetchAIWords(theme, len);
      const words = processWords(response.sentence);


      if (mode === "multi" && formData.enableBetting && isConnected) {
        await createRoomAndBet(formData.betAmount, time);
      
      }

      const settings: RoomSettings = {
        sentenceLength: len,
        timeLimit: time,
        maxPlayers: players,
        theme,
        words,
        enableBetting: mode === "multi" && formData.enableBetting,
        betAmount: formData.betAmount,
        roomId: roomCode,
      };

      updateUserData({ roomSettings: settings });

      if (mode === "single") {
        navigate("/single", { state: settings });
      } else {
        navigate(`/room/${roomCode}/lobby`, { state: settings });
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create room. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    validation,
    loading,
    isContractLoading,
    formData,
    mode,
    isConnected,
    playClickSound,
    fetchAIWords,
    processWords,
    createRoomAndBet,
    updateUserData,
    navigate,
    roomCode,
  ]);

  const handleBack = useCallback(() => {
    const destination =
      propMode === "create"
        ? "/multiplayer"
        : mode === "single"
          ? "/mode"
          : "/multiplayer";
    navigate(destination);
  }, [propMode, mode, navigate]);

  const isProcessing = loading || isContractLoading;

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <Lottie
          animationData={loadingAnimation}
          loop
          style={{ width: 200, height: 200 }}
        />
        <p className="mt-4 text-gray-400">
          {isContractLoading ? "Creating room and placing bet..." : "Generating words..."}
        </p>
        {isContractLoading && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 mb-2">
              ✅ Single transaction - you'll auto-join the betting pool
            </p>
            <p className="text-xs text-gray-600">
              Please confirm the transaction in your wallet
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={handleBack}
            
            className="absolute top-4 left-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm"
          >
            ← Back
          </button>
          <h1
            style={{ fontFamily: "Staatliches" }}
            className="text-5xl font-bold text-white mb-2"
          >
            {mode === "single" ? "SOLO SETTINGS" : "BETTING ROOM"}
          </h1>
          <p
            style={{ fontFamily: "Staatliches" }}
            className="text-gray-400 text-lg"
          >
            {mode === "single"
              ? "Configure your solo experience"
              : "Create a competitive betting room"}
          </p>
              
        </div>


        {/* Settings Card */}
        <main className="bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-700">
        {mode === "multi" && (
            <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-staatliches text-sm">Enable Betting</h3>
                    <p className="text-gray-400 font-staatliches text-xs">Create a competitive betting room</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableBetting}
                    onChange={(e) => updateFormData("enableBetting", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-600 peer-focus:outline-none   rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all "></div>
                </label>
              </div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="space-y-6"
          >
            {/* ✅ IMPROVED: Betting Amount with gas info */}
            {mode === "multi" && formData.enableBetting && (
              <div className="space-y-2">
                <label
                  htmlFor="bet-amount"
                  className="block k-p0 tracking-wide"
                >
                  Bet Amount ${networkInfo.currency}
                </label>
                <input
                  id="bet-amount"
                  type="number"
                  step="0.001"
                  min={BETTING_VALIDATION_RULES.MIN_BET}
                  max={BETTING_VALIDATION_RULES.MAX_BET}
                  value={formData.betAmount}
                  onChange={(e) => updateFormData("betAmount", e.target.value)}
                  onBlur={() => handleBlur("betAmount")}
                  placeholder={`e.g. ${BETTING_VALIDATION_RULES.MIN_BET}`}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getFieldError("betAmount")
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-600 focus:ring-white"
                    }`}
                  required
                />
                {getFieldError("betAmount") ? (
                  <p className="text-xs text-red-500">{getFieldError("betAmount")}</p>
                ) : (
                  <div className="text-xs text-gray-500">
                    <p>Min: {BETTING_VALIDATION_RULES.MIN_BET} {networkInfo.currency} • Max: {BETTING_VALIDATION_RULES.MAX_BET} {networkInfo.currency}</p>
                  
                  </div>
                )}

                {!isConnected && (
                  <div className="border border-yellow-500 rounded-lg p-3">
                    <p className="text-yellow-200 text-sm">
                      Connect your wallet to create betting room
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Words Count */}
            <div className="space-y-2">
              <label
                htmlFor="sentence-length"
                className="block k-p0 tracking-wide"
              >
                Words Count
              </label>
              <input
                id="sentence-length"
                type="text"
                value={formData.sentenceLength}
                onChange={(e) => updateFormData("sentenceLength", e.target.value)}
                placeholder="e.g. 30"
                onBlur={() => handleBlur("sentenceLength")}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getFieldError("sentenceLength")
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-600 focus:ring-white"
                  }`}
                required
              />
              {getFieldError("sentenceLength") ? (
                <p className="text-xs text-red-500">{getFieldError("sentenceLength")}</p>
              ) : (
                <p className="text-xs text-gray-500">
                  Between {VALIDATION_RULES.SENTENCE_LENGTH.min}–{VALIDATION_RULES.SENTENCE_LENGTH.max} words to type
                </p>
              )}
            </div>

            {/* Time Limit */}
            <div className="space-y-2">
              <label
                htmlFor="time-limit"
                className="block k-p0 tracking-wide"
              >
                Time Limit (seconds)
              </label>
              <input
                id="time-limit"
                type="text"
                value={formData.timeLimit}
                onChange={(e) => updateFormData("timeLimit", e.target.value)}
                placeholder="e.g. 60"
                onBlur={() => handleBlur("timeLimit")}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getFieldError("timeLimit")
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-600 focus:ring-white"
                  }`}
                required
              />
              {getFieldError("timeLimit") ? (
                <p className="text-xs text-red-500">{getFieldError("timeLimit")}</p>
              ) : (
                <p className="text-xs text-gray-500">
                  Race duration: {VALIDATION_RULES.TIME_LIMIT.min}–{VALIDATION_RULES.TIME_LIMIT.max} seconds
                </p>
              )}
            </div>

            {/* Players (only for multi mode) */}
            {mode === "multi" && (
              <div className="space-y-2">
                <label
                  htmlFor="max-players"
                  className="block k-p0 tracking-wide"
                >
                  Max Players
                </label>
                <input
                  id="max-players"
                  type="text"
                  value={formData.maxPlayers}
                  onChange={(e) => updateFormData("maxPlayers", e.target.value)}
                  placeholder="e.g. 4"
                  onBlur={() => handleBlur("maxPlayers")}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getFieldError("maxPlayers")
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-600 focus:ring-white"
                    }`}
                  required
                />
                {getFieldError("maxPlayers") ? (
                  <p className="text-xs text-red-500">{getFieldError("maxPlayers")}</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Room capacity: {VALIDATION_RULES.MAX_PLAYERS.min}–{VALIDATION_RULES.MAX_PLAYERS.max} players
                  </p>
                )}
              </div>
            )}

            {/* Theme Selection */}
            <div className="space-y-2">
              <label
                htmlFor="theme"
                className="block k-p0 tracking-wide"
              >
                Word Theme
              </label>
              <select
                id="theme"
                value={formData.theme}
                onChange={(e) => updateFormData("theme", e.target.value)}
                onBlur={() => handleBlur("theme")}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all duration-200 appearance-none cursor-pointer ${getFieldError("theme")
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-600 focus:ring-white"
                  }`}
                required
              >
                <option value="" disabled className="bg-gray-900">
                  Select word category...
                </option>
                {THEMES.map((theme) => (
                  <option key={theme} value={theme} className="bg-gray-900">
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </option>
                ))}
              </select>
              {getFieldError("theme") ? (
                <p className="text-xs text-red-500">{getFieldError("theme")}</p>
              ) : (
                <p className="text-xs text-gray-500">Choose your typing challenge theme</p>
              )}
            </div>

            {/* ✅ IMPROVED: Action Button with gas info */}
            <button
              type="submit"
              disabled={!validation.isValid || isProcessing}
              className="w-full mt-6 px-6 py-4 btn-modeselector shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-black rounded-full animate-spin"></div>
                  <span>
                    {isContractLoading ? "Creating Room + Placing Bet..." : "Generating Words..."}
                  </span>
                </div>
              ) : (
                <span className="font-staatliches text-lg">
                  {mode === "single"
                    ? "Start Solo Challenge"
                    : `${formData.enableBetting ? ` Create & Join Betting Pool (${formData.betAmount} ${networkInfo.currency})` : `Create & Join Typing Room`}`}
                </span>
              )}
            </button>
          </form>
        </main>

        {/* ✅ IMPROVED: Mode Indicator with gas info */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center ">
            <span
              style={{ fontFamily: "Staatliches" }}
              className="text-sm text-gray-300"
            >
              {mode === "single" ? "Solo Challenge" : " Multiplayer"}
            </span>
          </div>

          
        </div>
      </div>
    </div>
  );
} 