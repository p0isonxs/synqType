import { THEMES } from "../src/config/roomsetting";

export interface ImageWithFallbackProps {
  src: string;
  alt: string;
  fallbackIcon: string;
  className?: string;
}

export interface RoomSettingsProps {
  mode?: "create" | undefined;
}

export type RoomMode = "single" | "multi";
export type Theme = (typeof THEMES)[number];

export interface FormData {
  sentenceLength: string;
  timeLimit: string;
  maxPlayers: string;
  theme: Theme | ""
  enableBetting: boolean;
  betAmount: string;
}


export interface ExtendedFormData extends FormData {
  betAmount: string;
  enableBetting: boolean;
}

export interface RoomSettings {
  sentenceLength: number;
  timeLimit: number;
  maxPlayers: number;
  theme: Theme;
  words: string[];
  enableBetting: boolean;
  betAmount: string;
  roomId: string;
}

export interface ChatMessage {
  id: string;
  viewId: string;
  initials: string;
  avatarUrl: string;
  message: string;
  timestamp: number;
}