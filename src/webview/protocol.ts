// Webview protocol - Message type definitions
// PURE MODULE: No vscode imports allowed

import type {
  Card,
  ReviewRating,
  SrsState,
  DashboardStats,
  KnowledgeGraph,
} from '../storage/schema';

// Study mode types
export type StudyMode = 'loop' | 'studyUntilEmpty' | 'dueOnly';

// Session completion statistics
export interface SessionStats {
  reviewed: number;
  newLearned: number;
  correctRate: number; // good + easy / total
  duration: number; // session duration in ms
}

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

// Dashboard messages
export type GetDashboardStatsMessage = { type: 'get_dashboard_stats' };
export type GetKnowledgeGraphMessage = {
  type: 'get_knowledge_graph';
  maxNodes?: number;
  includeOrphans?: boolean;
  filterTag?: string;
};
export type GetCardDetailsMessage = { type: 'get_card_details'; cardId: string };
export type StartFlashcardStudyMessage = { type: 'start_flashcard_study' };
export type OpenSettingsMessage = { type: 'open_settings' };
export type GetTtsSettingsMessage = { type: 'get_tts_settings' };
export type RefreshMessage = { type: 'refresh' };

// Study mode messages
export type SetStudyModeMessage = { type: 'set_study_mode'; mode: StudyMode };
export type GetStudyModeMessage = { type: 'get_study_mode' };

export type UiToExtensionMessage =
  | UiReadyMessage
  | GetNextCardMessage
  | RateCardMessage
  | RevealBackMessage
  | NextMessage
  | GetDashboardStatsMessage
  | GetKnowledgeGraphMessage
  | GetCardDetailsMessage
  | StartFlashcardStudyMessage
  | OpenSettingsMessage
  | GetTtsSettingsMessage
  | RefreshMessage
  | SetStudyModeMessage
  | GetStudyModeMessage;

// Extension → UI messages
export type CardMessage = { type: 'card'; card: Card; srs?: SrsState };
export type EmptyMessage = { type: 'empty'; message: string };
export type ErrorMessage = { type: 'error'; message: string };

// Stats message for UI
export type StatsMessage = {
  type: 'stats';
  total: number;
  due: number;
  newCards: number;
};

// Dashboard messages
export type DashboardStatsMessage = { type: 'dashboard_stats'; stats: DashboardStats };
export type KnowledgeGraphMessage = { type: 'knowledge_graph'; graph: KnowledgeGraph };
export type CardDetailsMessage = { type: 'card_details'; card: Card; srs?: SrsState };
export type TtsSettingsMessage = {
  type: 'tts_settings';
  settings: {
    engine: string;
    rate: number;
    autoPlay: boolean;
    azureKey?: string;
    azureRegion?: string;
    openaiKey?: string;
  };
};

// Study mode response message
export type StudyModeMessage = {
  type: 'study_mode';
  mode: StudyMode;
};

// Session complete message (shown when studyUntilEmpty/dueOnly mode completes)
export type SessionCompleteMessage = {
  type: 'session_complete';
  stats: SessionStats;
};

export type ExtensionToUiMessage =
  | CardMessage
  | EmptyMessage
  | ErrorMessage
  | DashboardStatsMessage
  | KnowledgeGraphMessage
  | CardDetailsMessage
  | TtsSettingsMessage
  | StudyModeMessage
  | SessionCompleteMessage;

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
    case 'get_dashboard_stats':
    case 'start_flashcard_study':
    case 'open_settings':
    case 'get_tts_settings':
    case 'refresh':
    case 'get_study_mode':
      return true;

    case 'set_study_mode':
      return (
        typeof m.mode === 'string' &&
        ['loop', 'studyUntilEmpty', 'dueOnly'].includes(m.mode)
      );

    case 'get_knowledge_graph':
      // Optional parameters are validated loosely
      return true;

    case 'get_card_details':
      return typeof m.cardId === 'string';

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
