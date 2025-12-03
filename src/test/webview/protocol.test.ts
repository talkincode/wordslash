import { describe, it, expect } from 'vitest';
import { isValidUiMessage } from '../../webview/protocol';

describe('Webview Protocol', () => {
  describe('isValidUiMessage()', () => {
    describe('ui_ready message', () => {
      it('should accept valid ui_ready message', () => {
        expect(isValidUiMessage({ type: 'ui_ready' })).toBe(true);
      });
    });

    describe('get_next_card message', () => {
      it('should accept valid get_next_card message', () => {
        expect(isValidUiMessage({ type: 'get_next_card' })).toBe(true);
      });
    });

    describe('next message', () => {
      it('should accept valid next message', () => {
        expect(isValidUiMessage({ type: 'next' })).toBe(true);
      });
    });

    describe('rate_card message', () => {
      it('should accept valid rate_card message with all ratings', () => {
        const ratings = ['again', 'hard', 'good', 'easy'] as const;
        for (const rating of ratings) {
          expect(
            isValidUiMessage({
              type: 'rate_card',
              cardId: 'card-123',
              rating,
              mode: 'flashcard',
            })
          ).toBe(true);
        }
      });

      it('should reject rate_card without cardId', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            rating: 'good',
            mode: 'flashcard',
          })
        ).toBe(false);
      });

      it('should reject rate_card with non-string cardId', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            cardId: 123,
            rating: 'good',
            mode: 'flashcard',
          })
        ).toBe(false);
      });

      it('should reject rate_card without rating', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            cardId: 'card-123',
            mode: 'flashcard',
          })
        ).toBe(false);
      });

      it('should reject rate_card with invalid rating', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            cardId: 'card-123',
            rating: 'invalid',
            mode: 'flashcard',
          })
        ).toBe(false);
      });

      it('should reject rate_card without mode', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            cardId: 'card-123',
            rating: 'good',
          })
        ).toBe(false);
      });

      it('should reject rate_card with invalid mode', () => {
        expect(
          isValidUiMessage({
            type: 'rate_card',
            cardId: 'card-123',
            rating: 'good',
            mode: 'invalid',
          })
        ).toBe(false);
      });
    });

    describe('reveal_back message', () => {
      it('should accept valid reveal_back message', () => {
        expect(
          isValidUiMessage({
            type: 'reveal_back',
            cardId: 'card-123',
          })
        ).toBe(true);
      });

      it('should reject reveal_back without cardId', () => {
        expect(
          isValidUiMessage({
            type: 'reveal_back',
          })
        ).toBe(false);
      });

      it('should reject reveal_back with non-string cardId', () => {
        expect(
          isValidUiMessage({
            type: 'reveal_back',
            cardId: 456,
          })
        ).toBe(false);
      });
    });

    describe('invalid messages', () => {
      it('should reject null', () => {
        expect(isValidUiMessage(null)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(isValidUiMessage(undefined)).toBe(false);
      });

      it('should reject primitive values', () => {
        expect(isValidUiMessage('string')).toBe(false);
        expect(isValidUiMessage(123)).toBe(false);
        expect(isValidUiMessage(true)).toBe(false);
      });

      it('should reject empty object', () => {
        expect(isValidUiMessage({})).toBe(false);
      });

      it('should reject object without type', () => {
        expect(isValidUiMessage({ cardId: '123' })).toBe(false);
      });

      it('should reject unknown message type', () => {
        expect(isValidUiMessage({ type: 'unknown' })).toBe(false);
      });

      it('should reject array', () => {
        expect(isValidUiMessage([])).toBe(false);
      });
    });
  });
});
