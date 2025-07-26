// src/validation/roomSettingValidation.ts
export const VALIDATION_RULES = {
  SENTENCE_LENGTH: { min: 10, max: 40 },
  TIME_LIMIT: { min: 30, max: 120 },
  MAX_PLAYERS: { min: 2, max: 6 },
} as const;


export const BETTING_VALIDATION_RULES = {
  MIN_BET: 0.001,
  MAX_BET: 10,
} as const;



