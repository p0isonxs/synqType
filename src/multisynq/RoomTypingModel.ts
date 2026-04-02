import { TypingModel } from "./TypingModel";

type RoomTypingSettings = {
  sentenceLength?: number;
  timeLimit?: number;
  maxPlayers?: number;
  theme?: string;
  words?: string[];
  enableBetting?: boolean;
  betAmount?: string;
  contractAddress?: string;
};

export class RoomTypingModel extends TypingModel {
  private settingsInitialized = false;
  public enableBetting?: boolean;
  public betAmount?: string;
  public contractAddress?: string;

  static roomSettings: RoomTypingSettings | null = null;

  static setRoomSettings(settings: RoomTypingSettings): void {
    RoomTypingModel.roomSettings = settings;
  }

  init(options: Record<string, unknown> = {}): void {
    this.subscribe("room", "sync-settings", this.syncRoomSettings);
    this.subscribe("room", "broadcast-settings", this.receiveBroadcastSettings);

    super.init(options);
    this.future(100).setupRoomSettings();
  }

  setupRoomSettings(): void {
    if (this.settingsInitialized) {
      return;
    }

    if (RoomTypingModel.roomSettings) {
      this.applyRoomSettings(RoomTypingModel.roomSettings);
      this.settingsInitialized = true;
      this.future(1000).broadcastRoomSettings(RoomTypingModel.roomSettings);
      return;
    }

    this.applyRoomSettings({
      sentenceLength: 30,
      timeLimit: 60,
      maxPlayers: 4,
      theme: "random",
      words: [],
      enableBetting: false,
      betAmount: undefined,
      contractAddress: undefined,
    });
  }

  broadcastRoomSettings(settings: RoomTypingSettings): void {
    this.publish("room", "broadcast-settings", settings);
    this.publish("view", "update");
  }

  receiveBroadcastSettings(settings: RoomTypingSettings): void {
    const isHost = Boolean(RoomTypingModel.roomSettings);
    if (isHost || !settings) {
      return;
    }

    this.theme = settings.theme ?? this.theme;
    this.sentenceLength = settings.sentenceLength ?? this.sentenceLength;
    this.timeLimit = settings.timeLimit ?? this.timeLimit;
    this.maxPlayers = settings.maxPlayers ?? this.maxPlayers;
    this.words = settings.words ? [...settings.words] : this.words;
    this.enableBetting = settings.enableBetting;
    this.betAmount = settings.betAmount;
    this.contractAddress = settings.contractAddress;
    this.timeLeft = this.timeLimit;
    this.settingsInitialized = true;

    this.publish("view", "update");
  }

  syncRoomSettings(): void {}

  handleViewJoin(viewId: string): void {
    super.handleViewJoin(viewId);

    const isHost = Boolean(RoomTypingModel.roomSettings);
    if (isHost && this.players.size > 1 && RoomTypingModel.roomSettings) {
      this.future(500).broadcastRoomSettings(RoomTypingModel.roomSettings);
    }
  }

  applyRoomSettings(settings: RoomTypingSettings): void {
    if (settings.theme) this.theme = settings.theme;
    if (settings.sentenceLength) this.sentenceLength = settings.sentenceLength;
    if (settings.timeLimit) this.timeLimit = settings.timeLimit;
    if (settings.maxPlayers) this.maxPlayers = settings.maxPlayers;

    if (Object.prototype.hasOwnProperty.call(settings, "enableBetting")) {
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

RoomTypingModel.register("RoomTypingModel");
