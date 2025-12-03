// JSONL Storage tests
// TDD: Write tests first, then implement

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JsonlStorage } from '../../storage/storage';
import { createCard, createReviewEvent } from '../../storage/schema';

describe('JSONL Storage', () => {
  let tempDir: string;
  let storage: JsonlStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wordslash-test-'));
    storage = new JsonlStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  describe('appendCard()', () => {
    it('should append a single card to file', async () => {
      const card = createCard({ type: 'word', front: { term: 'test' } });
      await storage.appendCard(card);

      const content = await fs.readFile(path.join(tempDir, 'cards.jsonl'), 'utf-8');
      expect(content.trim()).toBe(JSON.stringify(card));
    });

    it('should append multiple cards with newlines', async () => {
      const card1 = createCard({ type: 'word', front: { term: 'one' } });
      const card2 = createCard({ type: 'word', front: { term: 'two' } });

      await storage.appendCard(card1);
      await storage.appendCard(card2);

      const lines = (await fs.readFile(path.join(tempDir, 'cards.jsonl'), 'utf-8'))
        .trim()
        .split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).front.term).toBe('one');
      expect(JSON.parse(lines[1]).front.term).toBe('two');
    });

    it('should create directory if not exists', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'dir');
      const nestedStorage = new JsonlStorage(nestedDir);
      const card = createCard({ type: 'word', front: { term: 'test' } });

      await nestedStorage.appendCard(card);

      const content = await fs.readFile(path.join(nestedDir, 'cards.jsonl'), 'utf-8');
      expect(content.trim()).toBe(JSON.stringify(card));
    });
  });

  describe('appendEvent()', () => {
    it('should append a single event to file', async () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'good',
        mode: 'flashcard',
      });
      await storage.appendEvent(event);

      const content = await fs.readFile(path.join(tempDir, 'events.jsonl'), 'utf-8');
      expect(content.trim()).toBe(JSON.stringify(event));
    });

    it('should append multiple events', async () => {
      const event1 = createReviewEvent({ cardId: 'card-1', rating: 'good', mode: 'flashcard' });
      const event2 = createReviewEvent({ cardId: 'card-2', rating: 'again', mode: 'flashcard' });

      await storage.appendEvent(event1);
      await storage.appendEvent(event2);

      const lines = (await fs.readFile(path.join(tempDir, 'events.jsonl'), 'utf-8'))
        .trim()
        .split('\n');

      expect(lines).toHaveLength(2);
    });
  });

  describe('readAllCards()', () => {
    it('should read all cards from file', async () => {
      const card1 = createCard({ type: 'word', front: { term: 'one' } });
      const card2 = createCard({ type: 'word', front: { term: 'two' } });

      await storage.appendCard(card1);
      await storage.appendCard(card2);

      const cards = await storage.readAllCards();
      expect(cards).toHaveLength(2);
      expect(cards[0].front.term).toBe('one');
      expect(cards[1].front.term).toBe('two');
    });

    it('should return empty array for non-existent file', async () => {
      const cards = await storage.readAllCards();
      expect(cards).toEqual([]);
    });

    it('should skip invalid JSON lines and log warning', async () => {
      await fs.writeFile(
        path.join(tempDir, 'cards.jsonl'),
        '{"id":"1","type":"word","front":{"term":"valid"},"createdAt":0,"updatedAt":0,"version":1}\ninvalid json\n{"id":"2","type":"word","front":{"term":"also-valid"},"createdAt":0,"updatedAt":0,"version":1}\n'
      );

      const result = await storage.readAllCards();
      expect(result).toHaveLength(2);
      expect(result[0].front.term).toBe('valid');
      expect(result[1].front.term).toBe('also-valid');
    });

    it('should handle empty lines', async () => {
      await fs.writeFile(
        path.join(tempDir, 'cards.jsonl'),
        '{"id":"1","type":"word","front":{"term":"one"},"createdAt":0,"updatedAt":0,"version":1}\n\n{"id":"2","type":"word","front":{"term":"two"},"createdAt":0,"updatedAt":0,"version":1}\n\n'
      );

      const result = await storage.readAllCards();
      expect(result).toHaveLength(2);
    });
  });

  describe('readAllEvents()', () => {
    it('should read all events from file', async () => {
      const event1 = createReviewEvent({ cardId: 'card-1', rating: 'good', mode: 'flashcard' });
      const event2 = createReviewEvent({ cardId: 'card-2', rating: 'hard', mode: 'flashcard' });

      await storage.appendEvent(event1);
      await storage.appendEvent(event2);

      const events = await storage.readAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].cardId).toBe('card-1');
      expect(events[1].cardId).toBe('card-2');
    });

    it('should return empty array for non-existent file', async () => {
      const events = await storage.readAllEvents();
      expect(events).toEqual([]);
    });
  });

  describe('atomicWriteJson()', () => {
    it('should write JSON atomically using temp file', async () => {
      const data = { test: 'data', nested: { value: 123 } };
      await storage.atomicWriteJson('test.json', data);

      const content = await fs.readFile(path.join(tempDir, 'test.json'), 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should not leave temp file on success', async () => {
      await storage.atomicWriteJson('test.json', { data: 1 });

      const files = await fs.readdir(tempDir);
      expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
    });

    it('should overwrite existing file', async () => {
      await storage.atomicWriteJson('test.json', { version: 1 });
      await storage.atomicWriteJson('test.json', { version: 2 });

      const content = await fs.readFile(path.join(tempDir, 'test.json'), 'utf-8');
      expect(JSON.parse(content)).toEqual({ version: 2 });
    });
  });

  describe('readJson()', () => {
    it('should read JSON file', async () => {
      const data = { key: 'value' };
      await fs.writeFile(path.join(tempDir, 'data.json'), JSON.stringify(data));

      const result = await storage.readJson<typeof data>('data.json');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent file', async () => {
      const result = await storage.readJson('nonexistent.json');
      expect(result).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent append writes safely', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        storage.appendCard(
          createCard({
            type: 'word',
            front: { term: `word-${i}` },
          })
        )
      );

      await Promise.all(writes);

      const cards = await storage.readAllCards();
      expect(cards).toHaveLength(10);

      // All words should be present (order may vary)
      const terms = cards.map((c) => c.front.term).sort();
      expect(terms).toEqual(Array.from({ length: 10 }, (_, i) => `word-${i}`).sort());
    });
  });
});
