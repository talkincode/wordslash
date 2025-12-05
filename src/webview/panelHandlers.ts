// Webview panel - Message handlers and session logic
// PURE MODULE: No vscode imports allowed - fully testable

import type { Card, ReviewRating, SrsState, CardIndex } from '../storage/schema';
import type { SessionStats, StudyMode } from './protocol';

/**
 * Session state for tracking study progress
 */
export interface SessionState {
  startTime: number;
  reviewCount: number;
  newCount: number;
  correctCount: number;
}

/**
 * Create initial session state
 */
export function createSessionState(): SessionState {
  return {
    startTime: Date.now(),
    reviewCount: 0,
    newCount: 0,
    correctCount: 0,
  };
}

/**
 * Reset session state to initial values
 */
export function resetSessionState(state: SessionState): SessionState {
  return {
    startTime: Date.now(),
    reviewCount: 0,
    newCount: 0,
    correctCount: 0,
  };
}

/**
 * Update session state after a card rating
 */
export function updateSessionAfterRating(
  state: SessionState,
  rating: ReviewRating,
  wasNewCard: boolean
): SessionState {
  const isCorrect = rating === 'good' || rating === 'easy';
  
  return {
    ...state,
    reviewCount: state.reviewCount + 1,
    newCount: wasNewCard ? state.newCount + 1 : state.newCount,
    correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
  };
}

/**
 * Calculate session statistics from session state
 */
export function calculateSessionStats(state: SessionState, endTime?: number): SessionStats {
  const duration = (endTime ?? Date.now()) - state.startTime;
  const correctRate = state.reviewCount > 0 
    ? state.correctCount / state.reviewCount 
    : 0;

  return {
    reviewed: state.reviewCount,
    newLearned: state.newCount,
    correctRate,
    duration,
  };
}

/**
 * Check if a card is new (never reviewed)
 */
export function isNewCard(srs: SrsState | undefined): boolean {
  return !srs || srs.reps === 0;
}

/**
 * Recent cards manager - tracks recently reviewed cards to avoid immediate repetition
 */
export interface RecentCardsState {
  cardIds: string[];
  maxSize: number;
}

/**
 * Create initial recent cards state
 */
export function createRecentCardsState(maxSize: number): RecentCardsState {
  return {
    cardIds: [],
    maxSize,
  };
}

/**
 * Add a card to recent cards list (maintains FIFO order)
 */
export function addToRecentCards(state: RecentCardsState, cardId: string): RecentCardsState {
  // Remove if already in list
  const filtered = state.cardIds.filter((id) => id !== cardId);
  // Add to front
  const newIds = [cardId, ...filtered];
  // Keep only last N cards
  const trimmed = newIds.slice(0, state.maxSize);
  
  return {
    ...state,
    cardIds: trimmed,
  };
}

/**
 * Clear recent cards list
 */
export function clearRecentCards(state: RecentCardsState): RecentCardsState {
  return {
    ...state,
    cardIds: [],
  };
}

/**
 * Get scheduler options based on study mode
 */
export interface SchedulerModeOptions {
  loopMode: boolean;
  dueOnly: boolean;
}

/**
 * Convert study mode to scheduler options
 */
export function getSchedulerOptionsFromMode(mode: StudyMode): SchedulerModeOptions {
  switch (mode) {
    case 'loop':
      return { loopMode: true, dueOnly: false };
    case 'studyUntilEmpty':
      return { loopMode: false, dueOnly: false };
    case 'dueOnly':
      return { loopMode: false, dueOnly: true };
    default:
      return { loopMode: true, dueOnly: false };
  }
}

/**
 * Determine if session should show completion screen
 */
export function shouldShowSessionComplete(
  mode: StudyMode,
  hasNextCard: boolean,
  reviewCount: number
): boolean {
  // Only show completion in non-loop modes when we've done some reviews
  // and there's no next card
  return mode !== 'loop' && !hasNextCard && reviewCount > 0;
}

/**
 * Get empty message based on study mode and card counts
 */
export function getEmptyMessage(
  mode: StudyMode,
  totalCards: number,
  dueCards: number
): string {
  if (totalCards === 0) {
    return "📭 No cards yet! Select text and use 'Add to WordSlash' to create cards.";
  }
  
  if (mode === 'dueOnly' && dueCards === 0) {
    return "✨ All caught up! No cards due for review right now.";
  }
  
  return "🎉 You've reviewed all available cards!";
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format correct rate as percentage string
 */
export function formatCorrectRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * TTS settings interface
 */
export interface TtsSettings {
  engine: string;
  rate: number;
  autoPlay: boolean;
  azureKey?: string;
  azureRegion?: string;
  openaiKey?: string;
}

/**
 * Default TTS settings
 */
export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  engine: 'youdao',
  rate: 1.0,
  autoPlay: true,
};

/**
 * Merge TTS settings with defaults
 */
export function mergeTtsSettings(partial: Partial<TtsSettings>): TtsSettings {
  return {
    ...DEFAULT_TTS_SETTINGS,
    ...partial,
  };
}
