import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLocation } from "react-router";
import isEqual from "lodash.isequal";
const DEFAULT_AVATAR = "/avatars/avatar1.png";
import { useUserData } from "../contexts/UserContext";

interface HighscoreEntry {
  initials: string;
  score: number;
  avatarUrl: string;
  timestamp: number;
  wpm: number;
  accuracy: number;
}

export default function SinglePlayer() {
  const location = useLocation();
  const { userData, updateUserData } = useUserData();
  const settings = location.state || userData.roomSettings;
  const sentenceLength = settings.sentenceLength || 30;
  const duration = settings.timeLimit || 30;
  const fallbackWords = [
    "blockchain",
    "crypto",
    "wallet",
    "dao",
    "airdrop",
    "gas",
    "token",
    "mint",
    "burn",
    "web3",
    "staking",
    "zkproof",
    "defi",
    "bridge",
    "vault",
    "multisynq",
    "monad",
    "layer2",
    "protocol",
    "consensus",
  ];

  const wordPool = settings.words?.length
    ? settings.words
    : fallbackWords.filter((w) => w.length <= sentenceLength);

  const [words, setWords] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [gameStarted, setGameStarted] = useState(false);
  const [chunkTransition, setChunkTransition] = useState(false);
  const [leaderboard, setLeaderboard] = useState<HighscoreEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const WORDS_PER_CHUNK = 20;
  const LEADERBOARD_KEY = "singlePlayerLeaderboard";

  const getTruncatedName = (name: string) => {
    return name.length > 5 ? name.substring(0, 5) + "..." : name;
  };

  function loadLeaderboard(): HighscoreEntry[] {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  }

  function saveLeaderboard(leaderboard: HighscoreEntry[]) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  }

  function updateLeaderboard(initials: string, score: number, avatarUrl: string, wpm: number, accuracy: number) {
    const current = loadLeaderboard();

    const isDuplicate = current.some(entry =>
      entry.initials === initials &&
      entry.score === score &&
      entry.wpm === wpm &&
      entry.accuracy === accuracy &&
      Math.abs(entry.timestamp - Date.now()) < 5000
    );

    if (isDuplicate) {
      console.log('Duplicate score detected, skipping...');
      return;
    }

    current.push({
      initials,
      score,
      avatarUrl,
      wpm,
      accuracy,
      timestamp: Date.now()
    });

    const top5 = current
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    saveLeaderboard(top5);
  }





  useEffect(() => {
    if (
      location.state &&
      !isEqual(location.state, userData.roomSettings)
    ) {
      updateUserData({ roomSettings: location.state });
    }
  }, [location.state, userData.roomSettings]);

  useEffect(() => {
    if (gameStarted && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((t: number) => t - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (timeLeft === 0 && gameStarted) {
      const finalWPM = Math.round((score / duration) * 60);
      const finalAccuracy = Math.round((score / Math.max(1, words.length)) * 100) || 0;

      updateLeaderboard(userData.initials, score, userData.avatarUrl, finalWPM, finalAccuracy);
      setLeaderboard(loadLeaderboard());

      setGameStarted(false);
    }
  }, [timeLeft, gameStarted, score, userData.initials, userData.avatarUrl, words.length, duration]);

  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  const shuffle = (array: string[]) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const startGame = () => {
    setIndex(0);
    setInput("");
    setScore(0);
    setWords(shuffle(wordPool));
    setTimeLeft(duration);
    setGameStarted(true);
    setChunkTransition(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const getCurrentChunk = () => {
    const chunkStart = Math.floor(index / WORDS_PER_CHUNK) * WORDS_PER_CHUNK;
    const chunkEnd = Math.min(chunkStart + WORDS_PER_CHUNK, words.length);
    return {
      words: words.slice(chunkStart, chunkEnd),
      startIndex: chunkStart,
      endIndex: chunkEnd,
    };
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    const correct = input.trim() === words[index];
    new Audio(correct ? "/uwu-sound-119010.mp3" : "/fart-83471.mp3").play();

    if (!correct) {
      setError(true);
      setTimeout(() => setError(false), 500);
    } else {
      setScore((s) => s + 1);
      const newIndex = index + 1;

      if (newIndex >= words.length) {
        setIndex(newIndex);
        setGameStarted(false);
        setTimeLeft(0);
        setInput("");
        return;
      }

      setIndex(newIndex);

      const currentChunkEnd =
        Math.floor(index / WORDS_PER_CHUNK) * WORDS_PER_CHUNK + WORDS_PER_CHUNK;
      const nextChunkStart =
        Math.floor(newIndex / WORDS_PER_CHUNK) * WORDS_PER_CHUNK;

      if (
        currentChunkEnd <= newIndex &&
        nextChunkStart !== Math.floor(index / WORDS_PER_CHUNK) * WORDS_PER_CHUNK
      ) {
        setChunkTransition(true);
        setTimeout(() => {
          setChunkTransition(false);
        }, 300);
      }
    }

    setInput("");
  };

  const getTimeColor = () => {
    if (timeLeft > duration * 0.5) return "text-white";
    if (timeLeft > duration * 0.25) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressPercentage = () => {
    if (words.length === 0) return 0;
    return Math.min((score / words.length) * 100, 100);
  };

  const PlayerAvatar = ({ size = "w-14 h-14 sm:w-16 sm:h-16" }: { size?: string }) => (
    <div className={`${size} overflow-hidden`}>
      <img
        src={userData.avatarUrl}
        alt="Player avatar"
        className="w-full h-full"
        onError={(e) => {
          e.currentTarget.src = DEFAULT_AVATAR;
        }}
      />
    </div>
  );

  const renderChunkedText = () => {
    const chunk = getCurrentChunk();
    const relativeIndex = index - chunk.startIndex;

    return (
      <div
        className={`text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-mono leading-relaxed bg-gray-900 rounded-lg p-2 sm:p-3 md:p-4 border border-gray-700 min-h-[120px] sm:min-h-[140px] md:min-h-[160px] max-h-[200px] sm:max-h-[220px] md:max-h-[240px] overflow-hidden transition-opacity duration-300 select-none ${chunkTransition ? "opacity-50" : "opacity-100"
          }`}
      >
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {chunk.words.map((word, wordIndex) => (
            <span key={chunk.startIndex + wordIndex} className="inline-block">
              {wordIndex < relativeIndex
                ? word.split("").map((letter, letterIndex) => (
                  <span
                    key={letterIndex}
                    className="text-green-400 rounded-sm"
                  >
                    {letter}
                  </span>
                ))
                : wordIndex === relativeIndex
                  ? word.split("").map((letter, letterIndex) => {
                    const isTyped = letterIndex < input.length;
                    const isCorrect = isTyped && input[letterIndex] === letter;
                    const isIncorrect =
                      isTyped && input[letterIndex] !== letter;
                    const isCurrent = letterIndex === input.length;

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
                  : word.split("").map((letter, letterIndex) => (
                    <span key={letterIndex} className="text-gray-400">
                      {letter}
                    </span>
                  ))}
            </span>
          ))}
        </div>

        <div className="mt-2 sm:mt-3 text-center text-xs text-gray-500">
          Chunk {Math.floor(index / WORDS_PER_CHUNK) + 1} of{" "}
          {Math.ceil(words.length / WORDS_PER_CHUNK)}
          {chunk.words.length < WORDS_PER_CHUNK && " (Final)"}
        </div>
      </div>
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short'
      });
    }
  };

  const topLeaderboard = useMemo(() => {
    const weighted = [...leaderboard].map(entry => ({
      ...entry,
      compositeScore: entry.score * 2 + entry.accuracy * 1 + entry.wpm * 1.5,
    }));

    return weighted
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 5);
  }, [leaderboard]);


  //   Artinya:
  // Score lebih penting, jadi dikali 2
  // Accuracy tetap penting, tapi tidak dominan
  // WPM dianggap sebagai faktor kecepatan (kali 1.5)


  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex justify-between items-center p-2 sm:p-3">
        <button
          onClick={() => navigate("/mode")}
          className="px-2 py-1 sm:px-3 sm:py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-xs sm:text-sm"
        >
          ← Back
        </button>
        <div className="text-gray-400 text-xs sm:text-sm font-staatliches">
          Mode <span className="text-white font-staatliches">solo</span>
        </div>
      </div>

      <div className="px-2 sm:px-3 py-2 sm:py-3">
        <div className="max-w-5xl mx-auto">
          <div className="relative mb-3 sm:mb-4">
            <div className="relative bg-gray-800 rounded-xl p-3 sm:p-4 md:p-5 border border-gray-700">
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full pr-3 flex items-center">
                <div className="text-xs sm:text-sm text-white font-semibold whitespace-nowrap ">
                  {getTruncatedName(userData.initials)}
                </div>
              </div>

              <div className="relative h-12 sm:h-16 md:h-18 bg-gray-700 rounded-lg border-4 border-gray-600 overflow-hidden">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white opacity-30 transform -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white opacity-30 transform -translate-y-1/2 border-t-2 border-dotted border-white"></div>

                <div className="absolute left-10 top-0 bottom-0 w-1 bg-white"></div>

                <div className="absolute right-0 top-0 bottom-0 w-3 sm:w-4">
                  <div className="grid grid-cols-2 h-full">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className={`${i % 2 === 0 ? "bg-white" : "bg-black"
                          } border border-gray-400`}
                      ></div>
                    ))}
                  </div>
                </div>

                <div
                  className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-500 ease-out"
                  style={{
                    left: `${getProgressPercentage()}%`,
                  }}
                >
                  <PlayerAvatar size="w-14 h-14 sm:w-16 sm:h-16" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
            <div className="bg-gray-900 rounded-lg p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">Time</div>
              <div
                className={`text-base sm:text-lg font-bold ${getTimeColor()}`}
              >
                {timeLeft}s
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2 text-center border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">Score</div>
              <div className="text-base sm:text-lg font-bold">{score}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2 text-center border border-gray-700 col-span-2 sm:col-span-1">
              <div className="text-xs text-gray-400 mb-1 font-staatliches">WPM</div>
              <div className="text-base sm:text-lg font-bold">
                {gameStarted
                  ? Math.round((score / Math.max(1, duration - timeLeft)) * 60)
                  : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-3 py-2 sm:py-3">
        <div className="max-w-5xl mx-auto">
          {gameStarted && timeLeft > 0 ? (
            <div className="text-center">{renderChunkedText()}</div>
          ) : (
            <div className="text-center">
              {timeLeft === 0 ? (
                <div className="space-y-3 bg-gray-900 rounded-lg p-6 border border-gray-700">
                  <div className="text-3xl mb-2"></div>
                  <h2 className="text-xl font-bold text-white mb-2 font-staatliches">
                    {score === words.length ? "Finish Line!" : "Game Over!"}
                  </h2>

                  <div className="text-lg mb-3 font-staatliches">
                    Final Score: <span className="font-bold font-staatliches">{score}</span>{" "}
                    words
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="text-gray-400">
                      <div className="font-staatliches">WPM</div>
                      <div className="text-white font-bold font-staatliches">
                        {Math.round((score / duration) * 60)}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <div className="font-staatliches">Accuracy</div>
                      <div className="text-white font-bold font-staatliches">
                        {Math.round(
                          (score / (score + (words.length - score))) * 100
                        ) || 0}
                        %
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <div className="font-staatliches">Progress</div>
                      <div className="text-white font-bold font-staatliches">
                        {Math.round((index / words.length) * 100) || 0}%
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    className="px-5 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-lg text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-staatliches"
                  >
                    Play Again
                  </button>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-900 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-700">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-2 font-staatliches">
                    Ready to Race?
                  </h2>
                  <p className="text-gray-400 mb-3 text-sm font-staatliches">
                    Solo typing challenge with {settings.sentenceLength} words
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3 text-xs sm:text-sm">
                    <div className="text-gray-400">
                      <div className="font-staatliches">Theme</div>
                      <div className="text-white font-semibold font-staatliches">
                        {settings.theme || "Default"}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <div className="font-staatliches">Max Length</div>
                      <div className="text-white font-semibold font-staatliches">
                        {settings.sentenceLength}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <div className="font-staatliches">Time Limit</div>
                      <div className="text-white font-semibold font-staatliches">
                        {duration}s
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    className="px-4 sm:px-5 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-lg text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-staatliches"
                  >
                    Start Race
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {gameStarted && timeLeft > 0 && (
        <div className="px-2 sm:px-3 pb-3">
          <div className="max-w-5xl mx-auto">
            <label className="block text-gray-400 text-xs mb-2 font-staatliches">
              Type here
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ([" ", "Enter"].includes(e.key)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className={`w-full px-3 py-2 text-sm sm:text-base bg-white rounded-lg text-black focus:outline-none transition-all duration-200 ${error
                ? "ring-2 ring-red-500"
                : "focus:ring-2 focus:ring-blue-500"
                }`}
              placeholder={words[index] || "Start typing..."}
            />
            <div className="mt-2 text-center text-gray-400 text-xs font-staatliches">
              Press space or enter to submit
            </div>
          </div>
        </div>
      )}

      {(!gameStarted || timeLeft === 0) && (
        <div className="px-2 sm:px-3 pb-4 sm:pb-6">
          <div className="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700 max-w-5xl mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 text-center font-staatliches">
              Leaderboard
            </h3>

            {leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Mobile Card Layout */}
                <div className="block sm:hidden space-y-2">
                  {topLeaderboard.map(({ initials, score, avatarUrl, wpm, accuracy, timestamp }, index) => (
                    <div
                      key={`${initials}-${timestamp}`}
                      className="bg-gray-800 rounded-lg p-3 border border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm font-bold px-2 py-1 rounded ${index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-400 text-black' :
                              index === 2 ? 'bg-orange-600 text-white' :
                                'bg-gray-600 text-white'
                            }`}>
                            #{index + 1}
                          </span>
                          <div className="w-10 h-10 overflow-hidden rounded-full border-2 border-gray-600">
                            <img
                              src={avatarUrl}
                              alt={`${initials} avatar`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_AVATAR;
                              }}
                            />
                          </div>
                          <span className="font-semibold text-white font-staatliches">
                            {getTruncatedName(initials)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-staatliches">
                          {formatDate(timestamp)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-gray-400 font-staatliches">Score</div>
                          <div className="text-white font-bold font-staatliches">{score}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 font-staatliches">WPM</div>
                          <div className="text-white font-bold font-staatliches">{wpm}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 font-staatliches">Accuracy</div>
                          <div className="text-white font-bold font-staatliches">{accuracy}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Rank</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Avatar</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Name</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Score</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">WPM</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Accuracy</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 font-staatliches">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topLeaderboard.map(({ initials, score, avatarUrl, wpm, accuracy, timestamp }, index) => (
                        <tr
                          key={`${initials}-${timestamp}`}
                          className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${index < 3 ? 'bg-gray-800/30' : ''
                            }`}
                        >
                          <td className="py-3 px-3">
                            <span className={`text-sm font-bold px-2 py-1 rounded ${index === 0 ? 'bg-yellow-500 text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                                index === 2 ? 'bg-orange-600 text-white' :
                                  'bg-gray-600 text-white'
                              }`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="w-8 h-8 overflow-hidden rounded-full border-2 border-gray-600">
                              <img
                                src={avatarUrl}
                                alt={`${initials} avatar`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_AVATAR;
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-white text-sm font-staatliches">
                              {getTruncatedName(initials)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-white text-sm font-staatliches">
                              {score}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-white text-sm font-staatliches">
                              {wpm}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-white text-sm font-staatliches">
                              {accuracy}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-xs text-gray-400 font-staatliches">
                              {formatDate(timestamp)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6 text-sm font-staatliches">
                <div>No scores yet. Be the first to play!</div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}


//localStorage.removeItem('singlePlayerLeaderboard')