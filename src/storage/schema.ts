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
  example?: string;
  context?: CardContext;
}

export interface CardBack {
  translation?: string;
  explanation?: string;
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
