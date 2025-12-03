// Type definitions for WordSlash data
// Mirrors the types from the main extension

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
  morphemes?: string[];
  example?: string;
  exampleCn?: string;
  context?: CardContext;
}

export interface CardBack {
  translation?: string;
  explanation?: string;
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

export interface CardIndex {
  version: number;
  cardCount: number;
  dueCount: number;
  newCount: number;
  updatedAt: number;
}

export interface CreateCardInput {
  type?: CardType;
  term: string;
  phonetic?: string;
  morphemes?: string[];
  example?: string;
  exampleCn?: string;
  translation?: string;
  explanation?: string;
  explanationCn?: string;
  synonyms?: string[];
  antonyms?: string[];
  notes?: string;
  tags?: string[];
}

export interface UpdateCardInput {
  phonetic?: string;
  morphemes?: string[];
  example?: string;
  exampleCn?: string;
  translation?: string;
  explanation?: string;
  explanationCn?: string;
  synonyms?: string[];
  antonyms?: string[];
  notes?: string;
  tags?: string[];
}

// ============================================
// Dashboard Statistics Types
// ============================================

export interface DashboardStats {
  totalCards: number;
  dueCards: number;
  newCards: number;
  learnedCards: number;
  masteredCards: number;
  totalReviews: number;
  reviewsToday: number;
  currentStreak: number;
  averageEaseFactor: number;
  retentionRate: number;
  cardsByType: {
    word: number;
    phrase: number;
    sentence: number;
  };
  ratingsDistribution: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  reviewsPerDay: Array<{ date: string; count: number }>;
}

// ============================================
// Knowledge Graph Types
// ============================================

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'card' | 'synonym' | 'antonym' | 'tag';
  masteryLevel?: number;
  color?: string;
  weight?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: 'synonym' | 'antonym' | 'tag' | 'related';
  weight?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  meta: {
    totalCards: number;
    totalConnections: number;
    generatedAt: number;
  };
}
