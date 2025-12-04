// Tests for storage/stats.ts
// PURE MODULE: Tests dashboard statistics and knowledge graph generation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDashboardStats, generateKnowledgeGraph } from '../../storage/stats';
import { buildIndex } from '../../storage/indexer';
import type { Card, ReviewEvent, SrsState } from '../../storage/schema';

// Helper to create test cards
function createTestCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    type: 'word',
    front: { term: 'test' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...overrides,
  };
}

// Helper to create test review events
function createTestEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: 'event-1',
    cardId: 'card-1',
    ts: Date.now(),
    kind: 'review',
    rating: 'good',
    mode: 'flashcard',
    ...overrides,
  };
}

describe('Dashboard Statistics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateDashboardStats', () => {
    it('should return zero stats for empty data', () => {
      const index = buildIndex([], []);
      const stats = calculateDashboardStats(index, []);

      expect(stats.totalCards).toBe(0);
      expect(stats.dueCards).toBe(0);
      expect(stats.newCards).toBe(0);
      expect(stats.learnedCards).toBe(0);
      expect(stats.masteredCards).toBe(0);
      expect(stats.totalReviews).toBe(0);
      expect(stats.currentStreak).toBe(0);
    });

    it('should count cards by type', () => {
      const cards: Card[] = [
        createTestCard({ id: '1', type: 'word' }),
        createTestCard({ id: '2', type: 'word' }),
        createTestCard({ id: '3', type: 'phrase' }),
        createTestCard({ id: '4', type: 'sentence' }),
      ];
      const index = buildIndex(cards, []);
      const stats = calculateDashboardStats(index, []);

      expect(stats.cardsByType.word).toBe(2);
      expect(stats.cardsByType.phrase).toBe(1);
      expect(stats.cardsByType.sentence).toBe(1);
    });

    it('should count ratings distribution', () => {
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        createTestEvent({ id: '1', rating: 'again' }),
        createTestEvent({ id: '2', rating: 'hard' }),
        createTestEvent({ id: '3', rating: 'good' }),
        createTestEvent({ id: '4', rating: 'good' }),
        createTestEvent({ id: '5', rating: 'easy' }),
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.ratingsDistribution.again).toBe(1);
      expect(stats.ratingsDistribution.hard).toBe(1);
      expect(stats.ratingsDistribution.good).toBe(2);
      expect(stats.ratingsDistribution.easy).toBe(1);
    });

    it('should calculate retention rate correctly', () => {
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        createTestEvent({ id: '1', rating: 'again' }),
        createTestEvent({ id: '2', rating: 'hard' }),
        createTestEvent({ id: '3', rating: 'good' }),
        createTestEvent({ id: '4', rating: 'easy' }),
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      // (good + easy) / total = 2/4 = 0.5
      expect(stats.retentionRate).toBe(0.5);
    });

    it('should count new cards correctly', () => {
      const cards: Card[] = [
        createTestCard({ id: '1' }),
        createTestCard({ id: '2' }),
        createTestCard({ id: '3' }),
      ];
      // Only card-1 has been reviewed
      const events: ReviewEvent[] = [
        createTestEvent({ cardId: '1' }),
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.newCards).toBe(2);
      expect(stats.learnedCards).toBe(1);
    });

    it('should count reviews today', () => {
      const now = Date.now();
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        createTestEvent({ id: '1', ts: now - 1000 }), // Today
        createTestEvent({ id: '2', ts: now - 2000 }), // Today
        createTestEvent({ id: '3', ts: now - 24 * 60 * 60 * 1000 - 1000 }), // Yesterday
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.reviewsToday).toBe(2);
      expect(stats.totalReviews).toBe(3);
    });

    it('should generate reviews per day for last 90 days', () => {
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.reviewsPerDay).toHaveLength(90);
      expect(stats.reviewsPerDay[89].date).toBe('2024-01-15'); // Today
    });

    it('should calculate streak correctly', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        createTestEvent({ id: '1', ts: now }), // Today
        createTestEvent({ id: '2', ts: now - day }), // Yesterday
        createTestEvent({ id: '3', ts: now - 2 * day }), // 2 days ago
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.currentStreak).toBe(3);
    });

    it('should reset streak if day is missed', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        // No review today or yesterday
        createTestEvent({ id: '1', ts: now - 3 * day }), // 3 days ago
        createTestEvent({ id: '2', ts: now - 4 * day }), // 4 days ago
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.currentStreak).toBe(0);
    });

    it('should generate retention history for last 30 days', () => {
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.retentionHistory).toHaveLength(30);
      expect(stats.retentionHistory[29].date).toBe('2024-01-15'); // Today
      expect(stats.retentionHistory[29].rate).toBe(0); // No events = 0 rate
    });

    it('should calculate retention history with rolling window', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      
      const cards = [createTestCard()];
      const events: ReviewEvent[] = [
        // Today: good ratings
        createTestEvent({ id: '1', ts: now, rating: 'good' }),
        createTestEvent({ id: '2', ts: now, rating: 'easy' }),
        // Yesterday: mixed
        createTestEvent({ id: '3', ts: now - day, rating: 'again' }),
        createTestEvent({ id: '4', ts: now - day, rating: 'good' }),
      ];
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      expect(stats.retentionHistory).toHaveLength(30);
      // With 7-day rolling window, today's retention should include events from last 7 days
      const todayRetention = stats.retentionHistory[29].rate;
      // 3 good/easy out of 4 total = 0.75
      expect(todayRetention).toBe(0.75);
    });
  });
});

describe('Knowledge Graph', () => {
  describe('generateKnowledgeGraph', () => {
    it('should return empty graph for empty cards', () => {
      const index = buildIndex([], []);
      const graph = generateKnowledgeGraph(index);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.meta.totalCards).toBe(0);
    });

    it('should create nodes for cards with tag connections', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions'],
        }),
        createTestCard({
          id: '2',
          front: { term: 'sad' },
          tags: ['emotions'],
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index);

      // Should have card nodes
      const cardNodes = graph.nodes.filter(n => n.type === 'card');
      expect(cardNodes).toHaveLength(2);
      expect(cardNodes.map(n => n.label)).toContain('happy');
      expect(cardNodes.map(n => n.label)).toContain('sad');
      
      // Check that cards have reps and ef properties
      expect(cardNodes[0].reps).toBeDefined();
      expect(cardNodes[0].ef).toBeDefined();
    });

    it('should NOT create synonym nodes (only tags now)', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          back: { synonyms: ['joyful'] },
          tags: ['emotions'], // Need tags to not be filtered as orphan
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index);

      // Synonym nodes should NOT exist anymore
      const synonymNodes = graph.nodes.filter(n => n.type === 'synonym' as string);
      expect(synonymNodes).toHaveLength(0);

      // Only tag edges should exist
      const tagEdges = graph.edges.filter(e => e.type === 'tag');
      expect(tagEdges.length).toBeGreaterThan(0);
    });

    it('should NOT create antonym nodes (only tags now)', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          back: { antonyms: ['sad'] },
          tags: ['emotions'], // Need tags to not be filtered as orphan
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index);

      // Antonym nodes should NOT exist anymore
      const antonymNodes = graph.nodes.filter(n => n.type === 'antonym' as string);
      expect(antonymNodes).toHaveLength(0);
    });

    it('should create tag nodes and edges', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions', 'common'],
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index);

      const tagNodes = graph.nodes.filter(n => n.type === 'tag');
      expect(tagNodes).toHaveLength(2);
      expect(tagNodes.map(n => n.label)).toContain('#emotions');
      expect(tagNodes.map(n => n.label)).toContain('#common');

      const tagEdges = graph.edges.filter(e => e.type === 'tag');
      expect(tagEdges).toHaveLength(2);
    });

    it('should connect cards via shared tags', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions'],
        }),
        createTestCard({
          id: '2',
          front: { term: 'joyful' },
          tags: ['emotions'],
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index);

      // Both cards should connect to the same tag
      const tagEdges = graph.edges.filter(e => e.type === 'tag');
      expect(tagEdges).toHaveLength(2); // One edge per card to the tag
      
      // Verify the tag node exists
      const tagNode = graph.nodes.find(n => n.type === 'tag' && n.label === '#emotions');
      expect(tagNode).toBeDefined();
    });

    it('should filter by tag', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions'],
          back: { synonyms: ['joyful'] },
        }),
        createTestCard({
          id: '2',
          front: { term: 'run' },
          tags: ['verbs'],
          back: { synonyms: ['sprint'] },
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index, { filterTag: 'emotions' });

      const cardNodes = graph.nodes.filter(n => n.type === 'card');
      expect(cardNodes).toHaveLength(1);
      expect(cardNodes[0].label).toBe('happy');
    });

    it('should exclude orphan cards by default (only cards without tags)', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions'],
        }),
        createTestCard({
          id: '2',
          front: { term: 'lonely' },
          // No tags = orphan now
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index, { includeOrphans: false });

      const cardNodes = graph.nodes.filter(n => n.type === 'card');
      expect(cardNodes).toHaveLength(1);
      expect(cardNodes[0].label).toBe('happy');
    });

    it('should include orphan cards when requested', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'happy' },
          tags: ['emotions'],
        }),
        createTestCard({
          id: '2',
          front: { term: 'lonely' },
          // No tags = orphan
        }),
      ];
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index, { includeOrphans: true });

      const cardNodes = graph.nodes.filter(n => n.type === 'card');
      expect(cardNodes).toHaveLength(2);
    });

    it('should respect maxNodes limit', () => {
      const cards: Card[] = Array.from({ length: 10 }, (_, i) =>
        createTestCard({
          id: String(i + 1),
          front: { term: `word${i + 1}` },
          tags: [`tag${i + 1}`], // Use tags instead of synonyms
        })
      );
      const index = buildIndex(cards, []);
      const graph = generateKnowledgeGraph(index, { maxNodes: 3 });

      const cardNodes = graph.nodes.filter(n => n.type === 'card');
      expect(cardNodes.length).toBeLessThanOrEqual(3);
    });

    it('should calculate mastery level and include reps/ef from SRS state', () => {
      const cards: Card[] = [
        createTestCard({
          id: '1',
          front: { term: 'mastered' },
          tags: ['test'], // Use tags to avoid orphan filtering
        }),
      ];
      // Create events to build up mastery
      const events: ReviewEvent[] = Array.from({ length: 10 }, (_, i) =>
        createTestEvent({
          id: String(i + 1),
          cardId: '1',
          rating: 'good',
          ts: Date.now() - (10 - i) * 24 * 60 * 60 * 1000,
        })
      );
      const index = buildIndex(cards, events);
      const graph = generateKnowledgeGraph(index);

      const cardNode = graph.nodes.find(n => n.id === '1');
      expect(cardNode?.masteryLevel).toBe(5); // 10 reps = mastery level 5
      expect(cardNode?.reps).toBe(10);
      expect(cardNode?.ef).toBeDefined();
    });
  });
});
