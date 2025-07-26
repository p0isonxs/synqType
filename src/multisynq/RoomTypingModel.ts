
import { TypingModel } from './TypingModel';

export class RoomTypingModel extends TypingModel {
  private settingsInitialized = false;    
  // ✅ NEW: Add betting properties to class
  public enableBetting?: boolean;
  public betAmount?: string;
  public contractAddress?: string;

  // ✅ Static approach for room settings
  static roomSettings: any = null;

  static setRoomSettings(settings: any): void {
    RoomTypingModel.roomSettings = settings;
  }

  init(options: any = {}): void {
    // ✅ CRITICAL: Subscribe FIRST, before super.init
    this.subscribe("room", "sync-settings", this.syncRoomSettings);
    
    // ✅ CRITICAL: Add broadcast listener for ALL instances
    this.subscribe("room", "broadcast-settings", this.receiveBroadcastSettings);

    super.init(options);

    // ✅ Wait for model to be fully initialized before setting up
    this.future(100).setupRoomSettings();
  }

  setupRoomSettings(): void {
    if (this.settingsInitialized) {
      return;
    }

    let roomSettings = {};

    if (RoomTypingModel.roomSettings) {
      // HOST SETUP
      roomSettings = RoomTypingModel.roomSettings;
      this.applyRoomSettings(roomSettings);
      this.settingsInitialized = true;

      
      // ✅ CRITICAL: Broadcast with different channel name
      this.future(1000).broadcastRoomSettings(roomSettings);

    } else {
      // GUEST SETUP - Don't initialize, wait for broadcast
      roomSettings = {
        sentenceLength: 30,
        timeLimit: 60,
        maxPlayers: 4,
        theme: 'random',
        words: [],
        enableBetting: false,
        betAmount: undefined,
        contractAddress: undefined
      };
      this.applyRoomSettings(roomSettings);
    }
  }

  // ✅ CRITICAL: Use different broadcast method
  broadcastRoomSettings(settings: any): void {
    
    // ✅ Use different channel for broadcast
    this.publish("room", "broadcast-settings", settings);
    this.publish("view", "update");
  }

  // ✅ NEW: Separate method for receiving broadcasts  
  receiveBroadcastSettings(settings: any): void {
    // ✅ CRITICAL: Only guests should receive broadcasts
    const isHost = !!RoomTypingModel.roomSettings;
    
    if (isHost) {
      return;
    }

    if (!settings) {
      console.log(' No settings in broadcast');
      return;
    }

    // Apply settings to guest
    this.theme = settings.theme;
    this.sentenceLength = settings.sentenceLength;
    this.timeLimit = settings.timeLimit;
    this.maxPlayers = settings.maxPlayers;
    this.words = [...settings.words];

    // ✅ CRITICAL: Apply betting fields
    this.enableBetting = settings.enableBetting;
    this.betAmount = settings.betAmount;
    this.contractAddress = settings.contractAddress;

    this.timeLeft = settings.timeLimit;
    this.settingsInitialized = true;

    this.publish("view", "update");
  }

  // ✅ Keep old method for compatibility
  syncRoomSettings(settings: any): void {
    // This method is kept for backward compatibility but may not be used
  }

  // ✅ Enhanced: Re-broadcast when new player joins
  handleViewJoin(viewId: string): void {
    super.handleViewJoin(viewId);

    const isHost = !!RoomTypingModel.roomSettings;
    
    if (isHost && this.players.size > 1) {
      this.future(500).broadcastRoomSettings(RoomTypingModel.roomSettings);
    }
  }

  // ✅ Keep existing applyRoomSettings method
  applyRoomSettings(settings: any): void {
    if (settings.theme) this.theme = settings.theme;
    if (settings.sentenceLength) this.sentenceLength = settings.sentenceLength;
    if (settings.timeLimit) this.timeLimit = settings.timeLimit;
    if (settings.maxPlayers) this.maxPlayers = settings.maxPlayers;

    if (settings.hasOwnProperty('enableBetting')) {
      this.enableBetting = settings.enableBetting;
    }
    if (settings.betAmount !== undefined) {
      this.betAmount = settings.betAmount;
    }
    if (settings.contractAddress !== undefined) {
      this.contractAddress = settings.contractAddress;
    }

    if (settings.words && settings.words.length > 0) {
      this.words = [...settings.words];
    } else if (!this.words || this.words.length === 0) {
      this.words = this.generateWords(this.sentenceLength, this.theme);
    }

    if (!settings.words || settings.words.length === 0) {
      this.shuffle(this.words);
    }

  }

  // ✅ Getter methods remain the same
  get bettingEnabled(): boolean {
    return this.enableBetting || false;
  }

  get bettingAmount(): string | undefined {
    return this.betAmount;
  }

  get bettingContractAddress(): string | undefined {
    return this.contractAddress;
  }
}

RoomTypingModel.register('RoomTypingModel');