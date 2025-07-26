import { ReactModel } from "@multisynq/react";
import type { TypingModel } from "./TypingModel";

interface PlayerInitArgs {
  viewId: string;
  parent: TypingModel;
}

export class PlayerModel extends ReactModel {
  viewId!: string;
  score!: number;
  progress!: number;
  index!: number;
  initials!: string;
  parent!: TypingModel;
  wpm: number = 0;
  avatarUrl!: string;
  walletAddress?: `0x${string}`;

  // ✅ ANTI-SPAM: Throttling system
  private lastUpdateTime = 0;
  private lastWalletTime = 0;
  private lastAvatarTime = 0;
  private lastInitialsTime = 0;
  private readonly updateThrottleMs = 100; // Max 10 updates per second
  private readonly walletThrottleMs = 5000; // Max once per 5 seconds
  private readonly avatarThrottleMs = 3000; // Max once per 3 seconds
  private readonly initialsThrottleMs = 2000; // Max once per 2 seconds

  init({ viewId, parent }: PlayerInitArgs): void {
    super.init({ viewId, parent });
    this.viewId = viewId;
    this.parent = parent;
    this.score = 0;
    this.progress = 0;
    this.index = 0;
    this.initials = "";
    this.wpm = 0;
    this.avatarUrl = "";

    this.subscribe(this.viewId, "set-avatar", this.setAvatar);
    this.subscribe(this.viewId, "typed-word", this.typedWord);
    this.subscribe(this.viewId, "set-initials", this.setInitials);
    this.subscribe(this.viewId, "set-wallet", this.setWalletAddress);
  }

  // ✅ THROTTLED: Wallet address setting
  setWalletAddress(wallet: `0x${string}`): void {
    const now = this.now();
    
    // Skip if same wallet or too frequent
    if (this.walletAddress === wallet) return;
    if (now - this.lastWalletTime < this.walletThrottleMs) {
      console.log(' THROTTLED: Skipping wallet update (too frequent)');
      return;
    }

    this.walletAddress = wallet;
    this.lastWalletTime = now;
    this.throttledPublish("wallet-updated");
  }

  get typingModel(): TypingModel {
    return this.parent;
  }

  // ✅ THROTTLED: Avatar setting
  setAvatar(url: string): void {
    const now = this.now();
    
    // Skip if same avatar or too frequent
    if (this.avatarUrl === url) return;
    if (now - this.lastAvatarTime < this.avatarThrottleMs) {
      console.log(' THROTTLED: Skipping avatar update (too frequent)');
      return;
    }
    
    this.avatarUrl = url;
    this.lastAvatarTime = now;
    this.throttledPublish("avatar-updated");
  }

  // ✅ OPTIMIZED: Typed word with smart batching
  typedWord(correct: boolean): void {
    if (!this.typingModel.started) return;

    const oldScore = this.score;
    const oldProgress = this.progress;
    const oldWpm = this.wpm;

    if (correct) {
      this.score++;
      const newIndex = this.index + 1;

      if (newIndex >= this.typingModel.words.length) {
        this.index = newIndex;
        this.progress = 100;
      } else {
        this.index = newIndex;
        this.progress = Math.min(
          (this.score / this.typingModel.words.length) * 100,
          100
        );
      }
    }

    this.updateWPM();

    // ✅ BATCH UPDATE: Only publish if significant changes
    const significantChange = 
      this.score !== oldScore || 
      Math.abs(this.progress - oldProgress) >= 1 || // Only update if progress changed by 1%
      Math.abs(this.wpm - oldWpm) >= 2; // Only update if WPM changed by 2

    if (significantChange) {
      this.throttledPublish("typing-progress");
    }
  }

  // ✅ THROTTLED: WPM calculation
  updateWPM(): void {
    const timeElapsed = this.typingModel.timeLimit - this.typingModel.timeLeft;
    if (timeElapsed > 0) {
      const minutes = timeElapsed / 60;
      const newWpm = Math.round(this.score / minutes);
      
      // Only update WPM if it changed significantly
      if (Math.abs(this.wpm - newWpm) >= 2) {
        this.wpm = newWpm;
      }
    } else {
      this.wpm = 0;
    }
  }

  // ✅ THROTTLED: Initials setting
  setInitials(initials: string): void {
    const now = this.now();
    
    if (!initials) return;

    // Skip if same initials or too frequent
    if (this.initials === initials) return;
    if (now - this.lastInitialsTime < this.initialsThrottleMs) {
      console.log('THROTTLED: Skipping initials update (too frequent)');
      return;
    }

    // Keep original duplicate name check logic
    for (const p of this.typingModel.players.values()) {
      if (p.initials === initials && p.viewId !== this.viewId) {
        return;
      }
    }

    this.initials = initials;
    this.lastInitialsTime = now;

    const old = this.typingModel.highscores[initials] ?? 0;
    if (this.score > old) {
      this.typingModel.setHighscore(initials, this.score);
    }

    this.throttledPublish("initials-updated");
  }

  // ✅ CENTRAL THROTTLED PUBLISH: Single point of control
  private throttledPublish(eventType: string): void {
    const now = this.now();
    
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      // Schedule delayed update instead of dropping it
      this.future(this.updateThrottleMs).delayedPublish(eventType);
      return;
    }

    this.lastUpdateTime = now;
    this.publish("view", "update");
    
    // Optional: Log significant events
    if (eventType === "typing-progress" && this.progress >= 100) {
      console.log(`🏁 PLAYER FINISHED: ${this.initials} (${this.viewId.slice(0, 8)})`);
    }
  }

  // ✅ DELAYED PUBLISH: For throttled events
  private delayedPublish(eventType: string): void {
    const now = this.now();
    
    // Only publish if enough time has passed
    if (now - this.lastUpdateTime >= this.updateThrottleMs) {
      this.lastUpdateTime = now;
      this.publish("view", "update");
    }
  }

  // ✅ OPTIMIZED: Reset with single update
  reset(): void {
    const hasChanges = this.score !== 0 || this.progress !== 0 || this.index !== 0 || this.wpm !== 0;
    
    this.score = 0;
    this.progress = 0;
    this.index = 0;
    this.wpm = 0;
    
    // Only publish if there were actual changes
    if (hasChanges) {
      this.throttledPublish("player-reset");
    }
  }

  // ✅ Keep all other methods exactly the same but optimized
  isCompleted(): boolean {
    return this.index >= this.typingModel.words.length;
  }

  getCompletionPercentage(): number {
    return Math.round(this.progress);
  }

  getCurrentWord(): string | undefined {
    if (this.index < this.typingModel.words.length) {
      return this.typingModel.words[this.index];
    }
    return undefined;
  }

  // ✅ CACHED: Rank calculation with memoization
  private cachedRank = 0;
  private lastRankCalculation = 0;
  private readonly rankCacheMs = 500; // Cache rank for 500ms

  getRank(): number {
    const now = this.now();
    
    // Return cached rank if recent
    if (now - this.lastRankCalculation < this.rankCacheMs) {
      return this.cachedRank;
    }

    const allPlayers = Array.from(this.typingModel.players.values());
    const sortedPlayers = allPlayers.sort((a, b) => {
      const aCompleted = a.progress >= 100 ? 1 : 0;
      const bCompleted = b.progress >= 100 ? 1 : 0;

      if (aCompleted !== bCompleted) {
        return bCompleted - aCompleted;
      }

      return b.score - a.score;
    });

    this.cachedRank = sortedPlayers.findIndex((p) => p.viewId === this.viewId) + 1;
    this.lastRankCalculation = now;
    
    return this.cachedRank;
  }

  // ✅ PERFORMANCE: Get player stats without causing updates
  getStats(): {
    score: number;
    progress: number;
    wpm: number;
    rank: number;
    isCompleted: boolean;
  } {
    return {
      score: this.score,
      progress: this.progress,
      wpm: this.wpm,
      rank: this.getRank(),
      isCompleted: this.isCompleted(),
    };
  }

  // ✅ DEBUG: Method to check throttling status
  getThrottleStatus(): {
    canUpdateWallet: boolean;
    canUpdateAvatar: boolean;
    canUpdateInitials: boolean;
    canPublish: boolean;
  } {
    const now = this.now();
    return {
      canUpdateWallet: now - this.lastWalletTime >= this.walletThrottleMs,
      canUpdateAvatar: now - this.lastAvatarTime >= this.avatarThrottleMs,
      canUpdateInitials: now - this.lastInitialsTime >= this.initialsThrottleMs,
      canPublish: now - this.lastUpdateTime >= this.updateThrottleMs,
    };
  }
}

PlayerModel.register("PlayerModel");