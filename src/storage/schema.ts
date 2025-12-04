// Storage module - Type definitions
// This file contains all type definitions for the data layer
// PURE MODULE: No vscode imports allowed

import { v4 as uuidv4 } from 'uuid';

export type CardType = 'word' | 'phrase' | 'sentence';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardContext {
  langId?: string;
  filePath?: string;
  lineText?: string;
}

export interface CardFront {
  term: string;
  phonetic?: string;
  /** Morpheme segmentation: e.g., ['ephe', 'meral'] for 'ephemeral' */
  morphemes?: string[];
  example?: string;
  /** Chinese translation of example sentence */
  exampleCn?: string;
  context?: CardContext;
}

export interface CardBack {
  translation?: string;
  explanation?: string;
  /** Chinese explanation */
  explanationCn?: string;
  synonyms?: string[];
  antonyms?: string[];
  notes?: string;
}

export interface Card {
  id: string;
  type: CardType;
  front: CardFront;
  back?: CardBack;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  version: number;
}

export interface ReviewEvent {
  id: string;
  cardId: string;
  ts: number;
  kind: 'review';
  rating: ReviewRating;
  mode: 'flashcard' | 'quickpeek';
  durationMs?: number;
}

export interface SrsState {
  cardId: string;
  dueAt: number;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastReviewAt?: number;
}

export interface Meta {
  schemaVersion: number;
  createdAt: number;
}

export interface CardIndex {
  cards: Map<string, Card>;
  srsStates: Map<string, SrsState>;
  dueCards: string[];
  newCards: string[];
}

// ============================================
// Factory Functions
// ============================================

/**
 * Input type for creating a new card
 */
export interface CreateCardInput {
  type: CardType;
  front: CardFront;
  back?: CardBack;
  tags?: string[];
}

/**
 * Input type for updating a card
 */
export interface UpdateCardInput {
  back?: Partial<CardBack>;
  tags?: string[];
  deleted?: boolean;
}

/**
 * Input type for creating a review event
 */
export interface CreateReviewEventInput {
  cardId: string;
  rating: ReviewRating;
  mode: 'flashcard' | 'quickpeek';
  durationMs?: number;
}

/**
 * Create a new card with auto-generated id, timestamps, and version
 */
export function createCard(input: CreateCardInput): Card {
  const now = Date.now();
  return {
    id: uuidv4(),
    type: input.type,
    front: input.front,
    back: input.back,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Update a card, incrementing version and updating timestamp
 * Merges back fields instead of replacing entirely
 */
export function updateCard(card: Card, updates: UpdateCardInput): Card {
  const now = Date.now();
  return {
    ...card,
    back: updates.back ? { ...card.back, ...updates.back } : card.back,
    tags: updates.tags !== undefined ? updates.tags : card.tags,
    deleted: updates.deleted !== undefined ? updates.deleted : card.deleted,
    updatedAt: now,
    version: card.version + 1,
  };
}

/**
 * Create a new review event with auto-generated id and timestamp
 */
export function createReviewEvent(input: CreateReviewEventInput): ReviewEvent {
  return {
    id: uuidv4(),
    cardId: input.cardId,
    ts: Date.now(),
    kind: 'review',
    rating: input.rating,
    mode: input.mode,
    durationMs: input.durationMs,
  };
}

// ============================================
// Bulk Import Types
// ============================================

/**
 * Template format for bulk import JSON file
 */
export interface BulkImportTemplate {
  version: number;
  cards: BulkCardInput[];
}

/**
 * Simplified input format for each card in bulk import
 */
export interface BulkCardInput {
  /** Required: the word, phrase, or sentence */
  term: string;
  /** Optional: auto-inferred from word count if not provided */
  type?: CardType;
  /** Optional: phonetic transcription */
  phonetic?: string;
  /** Optional: morpheme segmentation, e.g., ['un', 'believe', 'able'] */
  morphemes?: string[];
  /** Optional: example sentence */
  example?: string;
  /** Optional: Chinese translation of example sentence */
  exampleCn?: string;
  /** Optional: Chinese translation */
  translation?: string;
  /** Optional: English explanation */
  explanation?: string;
  /** Optional: Chinese explanation */
  explanationCn?: string;
  /** Optional: list of synonyms */
  synonyms?: string[];
  /** Optional: list of antonyms */
  antonyms?: string[];
  /** Optional: personal notes */
  notes?: string;
  /** Optional: tags for categorization */
  tags?: string[];
}

/**
 * Result of bulk import operation
 */
export interface BulkImportResult {
  /** Number of cards successfully imported */
  imported: number;
  /** Number of cards updated (overwritten) */
  updated: number;
  /** Number of cards skipped due to errors */
  skipped: number;
  /** Error messages for skipped cards */
  errors: string[];
}

// ============================================
// Dashboard Statistics Types
// ============================================

/**
 * Statistics for the dashboard
 */
export interface DashboardStats {
  /** Total number of active cards */
  totalCards: number;
  /** Number of cards due for review */
  dueCards: number;
  /** Number of new cards (never reviewed) */
  newCards: number;
  /** Number of cards learned (at least one review) */
  learnedCards: number;
  /** Number of cards mastered (interval >= 21 days) */
  masteredCards: number;
  /** Total review count */
  totalReviews: number;
  /** Reviews today */
  reviewsToday: number;
  /** Current streak (consecutive days with reviews) */
  currentStreak: number;
  /** Average ease factor */
  averageEaseFactor: number;
  /** Retention rate (good/easy vs again/hard) */
  retentionRate: number;
  /** Cards by type */
  cardsByType: {
    word: number;
    phrase: number;
    sentence: number;
  };
  /** Review ratings distribution */
  ratingsDistribution: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  /** Reviews per day (last 90 days for heatmap) */
  reviewsPerDay: Array<{ date: string; count: number }>;
  /** Retention rate history (last 30 days with 7-day rolling window) */
  retentionHistory: Array<{ date: string; rate: number }>;
}

// ============================================
// Knowledge Graph Types
// ============================================

/**
 * A node in the vocabulary knowledge graph
 */
export interface KnowledgeGraphNode {
  /** Unique identifier (card ID or generated ID for related terms) */
  id: string;
  /** The term/word */
  label: string;
  /** Node type */
  type: 'card' | 'tag';
  /** SRS mastery level (0-5): 0=new, 1-2=learning, 3-4=learned, 5=mastered */
  masteryLevel?: number;
  /** Review count (reps) - used for node size */
  reps?: number;
  /** Ease factor (ef) - used for node color (1.3-2.5+) */
  ef?: number;
  /** Color for visualization (optional, UI can derive from ef) */
  color?: string;
  /** Size weight for visualization */
  weight?: number;
}

/**
 * An edge in the vocabulary knowledge graph
 */
export interface KnowledgeGraphEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship type */
  type: 'tag';
  /** Edge weight for visualization */
  weight?: number;
}

/**
 * The complete knowledge graph structure
 */
export interface KnowledgeGraph {
  /** All nodes in the graph */
  nodes: KnowledgeGraphNode[];
  /** All edges in the graph */
  edges: KnowledgeGraphEdge[];
  /** Metadata */
  meta: {
    totalCards: number;
    totalConnections: number;
    generatedAt: number;
  };
}
