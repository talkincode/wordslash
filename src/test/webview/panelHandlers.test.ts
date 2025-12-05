// Tests for panelHandlers.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSessionState,
  resetSessionState,
  updateSessionAfterRating,
  calculateSessionStats,
  isNewCard,
  createRecentCardsState,
  addToRecentCards,
  clearRecentCards,
  getSchedulerOptionsFromMode,
  shouldShowSessionComplete,
  getEmptyMessage,
  formatDuration,
  formatCorrectRate,
  mergeTtsSettings,
  DEFAULT_TTS_SETTINGS,
  type SessionState,
  type RecentCardsState,
} from '../../webview/panelHandlers';
import type { SrsState } from '../../storage/schema';

describe('panelHandlers', () => {
  describe('SessionState management', () => {
    describe('createSessionState', () => {
      it('should create initial session state with current time', () => {
        const before = Date.now();
        const state = createSessionState();
        const after = Date.now();

        expect(state.startTime).toBeGreaterThanOrEqual(before);
        expect(state.startTime).toBeLessThanOrEqual(after);
        expect(state.reviewCount).toBe(0);
        expect(state.newCount).toBe(0);
        expect(state.correctCount).toBe(0);
      });
    });

    describe('resetSessionState', () => {
      it('should reset session state to initial values', () => {
        const oldState: SessionState = {
          startTime: 1000,
          reviewCount: 10,
          newCount: 5,
          correctCount: 8,
        };

        const before = Date.now();
        const newState = resetSessionState(oldState);
        const after = Date.now();

        expect(newState.startTime).toBeGreaterThanOrEqual(before);
        expect(newState.startTime).toBeLessThanOrEqual(after);
        expect(newState.reviewCount).toBe(0);
        expect(newState.newCount).toBe(0);
        expect(newState.correctCount).toBe(0);
      });
    });

    describe('updateSessionAfterRating', () => {
      it('should increment reviewCount for any rating', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'good', false);

        expect(updated.reviewCount).toBe(1);
      });

      it('should increment correctCount for good rating', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'good', false);

        expect(updated.correctCount).toBe(1);
      });

      it('should increment correctCount for easy rating', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'easy', false);

        expect(updated.correctCount).toBe(1);
      });

      it('should not increment correctCount for again rating', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'again', false);

        expect(updated.correctCount).toBe(0);
      });

      it('should not increment correctCount for hard rating', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'hard', false);

        expect(updated.correctCount).toBe(0);
      });

      it('should increment newCount when wasNewCard is true', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'good', true);

        expect(updated.newCount).toBe(1);
      });

      it('should not increment newCount when wasNewCard is false', () => {
        const state = createSessionState();

        const updated = updateSessionAfterRating(state, 'good', false);

        expect(updated.newCount).toBe(0);
      });

      it('should accumulate counts over multiple ratings', () => {
        let state = createSessionState();

        state = updateSessionAfterRating(state, 'good', true);
        state = updateSessionAfterRating(state, 'easy', false);
        state = updateSessionAfterRating(state, 'again', true);
        state = updateSessionAfterRating(state, 'hard', false);

        expect(state.reviewCount).toBe(4);
        expect(state.newCount).toBe(2);
        expect(state.correctCount).toBe(2);
      });
    });

    describe('calculateSessionStats', () => {
      it('should calculate correct stats', () => {
        const state: SessionState = {
          startTime: Date.now() - 60000, // 1 minute ago
          reviewCount: 10,
          newCount: 3,
          correctCount: 8,
        };

        const stats = calculateSessionStats(state);

        expect(stats.reviewed).toBe(10);
        expect(stats.newLearned).toBe(3);
        expect(stats.correctRate).toBeCloseTo(0.8, 2);
        expect(stats.duration).toBeGreaterThanOrEqual(60000);
      });

      it('should handle zero reviews', () => {
        const state: SessionState = {
          startTime: Date.now() - 1000,
          reviewCount: 0,
          newCount: 0,
          correctCount: 0,
        };

        const stats = calculateSessionStats(state);

        expect(stats.reviewed).toBe(0);
        expect(stats.correctRate).toBe(0);
      });

      it('should use provided endTime', () => {
        const startTime = 1000;
        const endTime = 61000;
        const state: SessionState = {
          startTime,
          reviewCount: 5,
          newCount: 2,
          correctCount: 4,
        };

        const stats = calculateSessionStats(state, endTime);

        expect(stats.duration).toBe(60000);
      });
    });
  });

  describe('isNewCard', () => {
    it('should return true for undefined srs', () => {
      expect(isNewCard(undefined)).toBe(true);
    });

    it('should return true for srs with reps = 0', () => {
      const srs: SrsState = {
        cardId: 'test',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
      };

      expect(isNewCard(srs)).toBe(true);
    });

    it('should return false for srs with reps > 0', () => {
      const srs: SrsState = {
        cardId: 'test',
        dueAt: Date.now(),
        intervalDays: 1,
        easeFactor: 2.5,
        reps: 1,
        lapses: 0,
      };

      expect(isNewCard(srs)).toBe(false);
    });
  });

  describe('RecentCardsState management', () => {
    describe('createRecentCardsState', () => {
      it('should create empty state with specified maxSize', () => {
        const state = createRecentCardsState(5);

        expect(state.cardIds).toEqual([]);
        expect(state.maxSize).toBe(5);
      });
    });

    describe('addToRecentCards', () => {
      it('should add card to front of list', () => {
        let state = createRecentCardsState(5);

        state = addToRecentCards(state, 'card1');

        expect(state.cardIds).toEqual(['card1']);
      });

      it('should maintain FIFO order', () => {
        let state = createRecentCardsState(5);

        state = addToRecentCards(state, 'card1');
        state = addToRecentCards(state, 'card2');
        state = addToRecentCards(state, 'card3');

        expect(state.cardIds).toEqual(['card3', 'card2', 'card1']);
      });

      it('should move existing card to front', () => {
        let state = createRecentCardsState(5);

        state = addToRecentCards(state, 'card1');
        state = addToRecentCards(state, 'card2');
        state = addToRecentCards(state, 'card1');

        expect(state.cardIds).toEqual(['card1', 'card2']);
      });

      it('should trim to maxSize', () => {
        let state = createRecentCardsState(3);

        state = addToRecentCards(state, 'card1');
        state = addToRecentCards(state, 'card2');
        state = addToRecentCards(state, 'card3');
        state = addToRecentCards(state, 'card4');

        expect(state.cardIds).toEqual(['card4', 'card3', 'card2']);
        expect(state.cardIds.length).toBe(3);
      });
    });

    describe('clearRecentCards', () => {
      it('should clear all card ids but keep maxSize', () => {
        let state = createRecentCardsState(5);
        state = addToRecentCards(state, 'card1');
        state = addToRecentCards(state, 'card2');

        state = clearRecentCards(state);

        expect(state.cardIds).toEqual([]);
        expect(state.maxSize).toBe(5);
      });
    });
  });

  describe('getSchedulerOptionsFromMode', () => {
    it('should return loop options for loop mode', () => {
      const options = getSchedulerOptionsFromMode('loop');

      expect(options.loopMode).toBe(true);
      expect(options.dueOnly).toBe(false);
    });

    it('should return non-loop options for studyUntilEmpty mode', () => {
      const options = getSchedulerOptionsFromMode('studyUntilEmpty');

      expect(options.loopMode).toBe(false);
      expect(options.dueOnly).toBe(false);
    });

    it('should return dueOnly options for dueOnly mode', () => {
      const options = getSchedulerOptionsFromMode('dueOnly');

      expect(options.loopMode).toBe(false);
      expect(options.dueOnly).toBe(true);
    });

    it('should default to loop mode for unknown mode', () => {
      const options = getSchedulerOptionsFromMode('unknown' as any);

      expect(options.loopMode).toBe(true);
      expect(options.dueOnly).toBe(false);
    });
  });

  describe('shouldShowSessionComplete', () => {
    it('should return false for loop mode', () => {
      expect(shouldShowSessionComplete('loop', false, 10)).toBe(false);
    });

    it('should return false when hasNextCard is true', () => {
      expect(shouldShowSessionComplete('studyUntilEmpty', true, 10)).toBe(false);
    });

    it('should return false when reviewCount is 0', () => {
      expect(shouldShowSessionComplete('studyUntilEmpty', false, 0)).toBe(false);
    });

    it('should return true for studyUntilEmpty with no next card and reviews', () => {
      expect(shouldShowSessionComplete('studyUntilEmpty', false, 5)).toBe(true);
    });

    it('should return true for dueOnly with no next card and reviews', () => {
      expect(shouldShowSessionComplete('dueOnly', false, 3)).toBe(true);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return no cards message when totalCards is 0', () => {
      const message = getEmptyMessage('loop', 0, 0);

      expect(message).toContain('No cards yet');
    });

    it('should return all caught up for dueOnly with no due cards', () => {
      const message = getEmptyMessage('dueOnly', 10, 0);

      expect(message).toContain('All caught up');
    });

    it('should return reviewed all message otherwise', () => {
      const message = getEmptyMessage('studyUntilEmpty', 10, 5);

      expect(message).toContain('reviewed all');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only for less than a minute', () => {
      expect(formatDuration(30000)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('should handle exact minutes', () => {
      expect(formatDuration(120000)).toBe('2m 0s');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });

  describe('formatCorrectRate', () => {
    it('should format rate as percentage', () => {
      expect(formatCorrectRate(0.85)).toBe('85%');
    });

    it('should handle 100%', () => {
      expect(formatCorrectRate(1.0)).toBe('100%');
    });

    it('should handle 0%', () => {
      expect(formatCorrectRate(0)).toBe('0%');
    });

    it('should round to nearest integer', () => {
      expect(formatCorrectRate(0.333)).toBe('33%');
      expect(formatCorrectRate(0.666)).toBe('67%');
    });
  });

  describe('TtsSettings', () => {
    describe('DEFAULT_TTS_SETTINGS', () => {
      it('should have correct defaults', () => {
        expect(DEFAULT_TTS_SETTINGS.engine).toBe('youdao');
        expect(DEFAULT_TTS_SETTINGS.rate).toBe(1.0);
        expect(DEFAULT_TTS_SETTINGS.autoPlay).toBe(true);
      });
    });

    describe('mergeTtsSettings', () => {
      it('should return defaults when given empty object', () => {
        const settings = mergeTtsSettings({});

        expect(settings).toEqual(DEFAULT_TTS_SETTINGS);
      });

      it('should override specific values', () => {
        const settings = mergeTtsSettings({
          engine: 'azure',
          rate: 0.8,
        });

        expect(settings.engine).toBe('azure');
        expect(settings.rate).toBe(0.8);
        expect(settings.autoPlay).toBe(true); // default
      });

      it('should include optional azure settings', () => {
        const settings = mergeTtsSettings({
          engine: 'azure',
          azureKey: 'test-key',
          azureRegion: 'westus',
        });

        expect(settings.azureKey).toBe('test-key');
        expect(settings.azureRegion).toBe('westus');
      });
    });
  });
});
