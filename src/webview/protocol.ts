// Webview protocol - Message type definitions
// PURE MODULE: No vscode imports allowed

import type { Card, ReviewRating, SrsState } from '../storage/schema';

// UI → Extension messages
export type UiReadyMessage = { type: 'ui_ready' };
export type GetNextCardMessage = { type: 'get_next_card' };
export type RateCardMessage = {
  type: 'rate_card';
  cardId: string;
  rating: ReviewRating;
  mode: 'flashcard';
};
export type RevealBackMessage = { type: 'reveal_back'; cardId: string };
export type NextMessage = { type: 'next' };

export type UiToExtensionMessage =
  | UiReadyMessage
  | GetNextCardMessage
  | RateCardMessage
  | RevealBackMessage
  | NextMessage;

// Extension → UI messages
export type CardMessage = { type: 'card'; card: Card; srs?: SrsState };
export type EmptyMessage = { type: 'empty'; message: string };
export type ErrorMessage = { type: 'error'; message: string };

export type ExtensionToUiMessage = CardMessage | EmptyMessage | ErrorMessage;

// Stats message for UI
export type StatsMessage = {
  type: 'stats';
  total: number;
  due: number;
  newCards: number;
};

/**
 * Validate UI to Extension message
 */
export function isValidUiMessage(msg: unknown): msg is UiToExtensionMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }

  const m = msg as Record<string, unknown>;

  switch (m.type) {
    case 'ui_ready':
    case 'get_next_card':
    case 'next':
      return true;

    case 'rate_card':
      return (
        typeof m.cardId === 'string' &&
        typeof m.rating === 'string' &&
        ['again', 'hard', 'good', 'easy'].includes(m.rating) &&
        m.mode === 'flashcard'
      );

    case 'reveal_back':
      return typeof m.cardId === 'string';

    default:
      return false;
  }
}
