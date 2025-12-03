// Schema types and factory functions tests
// TDD: Write tests first, then implement

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCard, updateCard, createReviewEvent } from '../../storage/schema';

describe('Schema Types', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Card', () => {
    it('should create a valid word card with minimal fields', () => {
      const card = createCard({
        type: 'word',
        front: { term: 'ephemeral' },
      });

      expect(card.id).toBeDefined();
      expect(card.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(card.type).toBe('word');
      expect(card.front.term).toBe('ephemeral');
      expect(card.version).toBe(1);
      expect(card.createdAt).toBe(Date.now());
      expect(card.updatedAt).toBe(Date.now());
    });

    it('should create a card with full context', () => {
      const card = createCard({
        type: 'sentence',
        front: {
          term: 'The quick brown fox',
          example: 'Typing test sentence',
          context: {
            langId: 'typescript',
            filePath: '/src/app.ts',
            lineText: 'const msg = "The quick brown fox";',
          },
        },
        back: {
          translation: '敏捷的棕色狐狸',
          explanation: 'A common typing test sentence',
        },
        tags: ['typing', 'test'],
      });

      expect(card.front.context?.langId).toBe('typescript');
      expect(card.front.context?.filePath).toBe('/src/app.ts');
      expect(card.back?.translation).toBe('敏捷的棕色狐狸');
      expect(card.tags).toEqual(['typing', 'test']);
    });

    it('should create a phrase card', () => {
      const card = createCard({
        type: 'phrase',
        front: { term: 'break the ice' },
      });

      expect(card.type).toBe('phrase');
    });

    it('should increment version on update', () => {
      const card = createCard({ type: 'word', front: { term: 'test' } });

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      const updated = updateCard(card, { back: { translation: '测试' } });

      expect(updated.version).toBe(2);
      expect(updated.updatedAt).toBeGreaterThan(card.createdAt);
      expect(updated.back?.translation).toBe('测试');
      // Original fields should be preserved
      expect(updated.id).toBe(card.id);
      expect(updated.front.term).toBe('test');
      expect(updated.createdAt).toBe(card.createdAt);
    });

    it('should merge back fields on update', () => {
      const card = createCard({
        type: 'word',
        front: { term: 'test' },
        back: { translation: '测试', explanation: 'A test word' },
      });

      const updated = updateCard(card, {
        back: { synonyms: ['exam', 'trial'] },
      });

      expect(updated.back?.translation).toBe('测试');
      expect(updated.back?.explanation).toBe('A test word');
      expect(updated.back?.synonyms).toEqual(['exam', 'trial']);
    });

    it('should update tags', () => {
      const card = createCard({
        type: 'word',
        front: { term: 'test' },
        tags: ['old'],
      });

      const updated = updateCard(card, { tags: ['new', 'updated'] });

      expect(updated.tags).toEqual(['new', 'updated']);
    });

    it('should soft delete a card', () => {
      const card = createCard({ type: 'word', front: { term: 'test' } });

      const deleted = updateCard(card, { deleted: true });

      expect(deleted.deleted).toBe(true);
      expect(deleted.version).toBe(2);
    });
  });

  describe('ReviewEvent', () => {
    it('should create a valid review event', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'good',
        mode: 'flashcard',
      });

      expect(event.id).toBeDefined();
      expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(event.kind).toBe('review');
      expect(event.cardId).toBe('card-123');
      expect(event.rating).toBe('good');
      expect(event.mode).toBe('flashcard');
      expect(event.ts).toBe(Date.now());
    });

    it('should create event with again rating', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'again',
        mode: 'flashcard',
      });

      expect(event.rating).toBe('again');
    });

    it('should create event with hard rating', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'hard',
        mode: 'flashcard',
      });

      expect(event.rating).toBe('hard');
    });

    it('should create event with easy rating', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'easy',
        mode: 'flashcard',
      });

      expect(event.rating).toBe('easy');
    });

    it('should include optional duration', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'again',
        mode: 'flashcard',
        durationMs: 5000,
      });

      expect(event.durationMs).toBe(5000);
    });

    it('should create event with quickpeek mode', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'good',
        mode: 'quickpeek',
      });

      expect(event.mode).toBe('quickpeek');
    });
  });
});
