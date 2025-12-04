// JSONL Storage for WordSlash MCP Server
// Provides read/write access to cards.jsonl, events.jsonl, and index.json

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import type { Card, CardIndex, CreateCardInput, ReviewEvent, UpdateCardInput } from './types.js';

const CARDS_FILE = 'cards.jsonl';
const EVENTS_FILE = 'events.jsonl';
const INDEX_FILE = 'index.json';

/**
 * Get the default storage path for WordSlash data
 */
export function getDefaultStoragePath(): string {
  const platform = os.platform();
  const home = os.homedir();

  // The path format is: globalStorage/<publisher>.<extension-name>
  // Publisher: TeraTeams, Extension: wordslash
  if (platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Code/User/globalStorage/terateams.wordslash');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || home, 'Code/User/globalStorage/terateams.wordslash');
  } else {
    return path.join(home, '.config/Code/User/globalStorage/terateams.wordslash');
  }
}

/**
 * Infer card type from term word count
 */
function inferCardType(term: string): 'word' | 'phrase' | 'sentence' {
  const wordCount = term.trim().split(/\s+/).length;
  if (wordCount === 1) return 'word';
  if (wordCount <= 4) return 'phrase';
  return 'sentence';
}

/**
 * Storage class for managing WordSlash data files
 */
export class Storage {
  private basePath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(basePath?: string) {
    this.basePath = basePath || getDefaultStoragePath();
  }

  /**
   * Get the storage base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Ensure the storage directory exists
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * Check if storage directory exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.basePath);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Cards Operations
  // ============================================

  /**
   * Read all card entries from cards.jsonl
   */
  async readAllCardEntries(): Promise<Card[]> {
    return this.readJsonl<Card>(CARDS_FILE);
  }

  /**
   * Get deduplicated cards (latest version, excluding deleted)
   */
  async getCards(): Promise<Map<string, Card>> {
    const entries = await this.readAllCardEntries();
    const latest = new Map<string, Card>();

    // Sort by version to ensure we process in order
    const sorted = [...entries].sort((a, b) => a.version - b.version);

    for (const card of sorted) {
      if (card.deleted) {
        latest.delete(card.id);
      } else {
        latest.set(card.id, card);
      }
    }

    return latest;
  }

  /**
   * Get a single card by ID
   */
  async getCard(id: string): Promise<Card | null> {
    const cards = await this.getCards();
    return cards.get(id) || null;
  }

  /**
   * Get a card by term (case-insensitive)
   */
  async getCardByTerm(term: string): Promise<Card | null> {
    const cards = await this.getCards();
    const normalized = term.toLowerCase().trim();

    for (const card of cards.values()) {
      if (card.front.term.toLowerCase().trim() === normalized) {
        return card;
      }
    }

    return null;
  }

  /**
   * Create a new card
   */
  async createCard(input: CreateCardInput): Promise<Card> {
    const now = Date.now();
    const card: Card = {
      id: randomUUID(),
      type: input.type || inferCardType(input.term),
      front: {
        term: input.term.trim(),
        phonetic: input.phonetic?.trim(),
        morphemes: input.morphemes?.map(m => m.trim()).filter(Boolean),
        example: input.example?.trim(),
        exampleCn: input.exampleCn?.trim(),
      },
      back: {
        translation: input.translation?.trim(),
        explanation: input.explanation?.trim(),
        explanationCn: input.explanationCn?.trim(),
        synonyms: input.synonyms?.map(s => s.trim()).filter(Boolean),
        antonyms: input.antonyms?.map(a => a.trim()).filter(Boolean),
        notes: input.notes?.trim(),
      },
      tags: input.tags?.map(t => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.appendCard(card);
    return card;
  }

  /**
   * Update an existing card
   */
  async updateCard(id: string, updates: UpdateCardInput): Promise<Card | null> {
    const existing = await this.getCard(id);
    if (!existing) {
      return null;
    }

    const now = Date.now();
    const updated: Card = {
      ...existing,
      front: {
        ...existing.front,
        phonetic: updates.phonetic?.trim() ?? existing.front.phonetic,
        morphemes: updates.morphemes?.map(m => m.trim()).filter(Boolean) ?? existing.front.morphemes,
        example: updates.example?.trim() ?? existing.front.example,
        exampleCn: updates.exampleCn?.trim() ?? existing.front.exampleCn,
      },
      back: {
        ...existing.back,
        translation: updates.translation?.trim() ?? existing.back?.translation,
        explanation: updates.explanation?.trim() ?? existing.back?.explanation,
        explanationCn: updates.explanationCn?.trim() ?? existing.back?.explanationCn,
        synonyms: updates.synonyms?.map(s => s.trim()).filter(Boolean) ?? existing.back?.synonyms,
        antonyms: updates.antonyms?.map(a => a.trim()).filter(Boolean) ?? existing.back?.antonyms,
        notes: updates.notes?.trim() ?? existing.back?.notes,
      },
      tags: updates.tags?.map(t => t.trim()).filter(Boolean) ?? existing.tags,
      updatedAt: now,
      version: existing.version + 1,
    };

    await this.appendCard(updated);
    return updated;
  }

  /**
   * Delete a card (soft delete)
   */
  async deleteCard(id: string): Promise<boolean> {
    const existing = await this.getCard(id);
    if (!existing) {
      return false;
    }

    const deleted: Card = {
      ...existing,
      deleted: true,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.appendCard(deleted);
    return true;
  }

  /**
   * Append a card to cards.jsonl
   */
  async appendCard(card: Card): Promise<void> {
    await this.appendLine(CARDS_FILE, JSON.stringify(card));
  }

  // ============================================
  // Events Operations (Read-only)
  // ============================================

  /**
   * Read all review events
   */
  async readAllEvents(): Promise<ReviewEvent[]> {
    return this.readJsonl<ReviewEvent>(EVENTS_FILE);
  }

  /**
   * Get events for a specific card
   */
  async getEventsForCard(cardId: string): Promise<ReviewEvent[]> {
    const events = await this.readAllEvents();
    return events.filter(e => e.cardId === cardId).sort((a, b) => a.ts - b.ts);
  }

  // ============================================
  // Index Operations
  // ============================================

  /**
   * Read the index file
   */
  async readIndex(): Promise<CardIndex | null> {
    return this.readJson<CardIndex>(INDEX_FILE);
  }

  /**
   * Update the index file
   */
  async updateIndex(): Promise<CardIndex> {
    const cards = await this.getCards();
    const events = await this.readAllEvents();

    // Calculate due and new counts
    const now = Date.now();
    let dueCount = 0;
    let newCount = 0;

    const cardEventMap = new Map<string, ReviewEvent[]>();
    for (const event of events) {
      if (!cardEventMap.has(event.cardId)) {
        cardEventMap.set(event.cardId, []);
      }
      cardEventMap.get(event.cardId)!.push(event);
    }

    for (const [cardId] of cards) {
      const cardEvents = cardEventMap.get(cardId) || [];
      if (cardEvents.length === 0) {
        newCount++;
      } else {
        // Simplified due check - would need full SRS calculation for accuracy
        dueCount++;
      }
    }

    const index: CardIndex = {
      version: 1,
      cardCount: cards.size,
      dueCount,
      newCount,
      updatedAt: now,
    };

    await this.atomicWriteJson(INDEX_FILE, index);
    return index;
  }

  // ============================================
  // Low-level Operations
  // ============================================

  /**
   * Read a JSONL file
   */
  private async readJsonl<T>(filename: string): Promise<T[]> {
    const filePath = path.join(this.basePath, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const results: T[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          results.push(JSON.parse(trimmed) as T);
        } catch {
          // Skip invalid JSON lines
        }
      }

      return results;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read a JSON file
   */
  private async readJson<T>(filename: string): Promise<T | null> {
    const filePath = path.join(this.basePath, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Append a line to a file with locking
   */
  private async appendLine(filename: string, line: string): Promise<void> {
    this.writeLock = this.writeLock.then(async () => {
      await this.ensureDir();
      const filePath = path.join(this.basePath, filename);
      await fs.appendFile(filePath, line + '\n', 'utf-8');
    });
    await this.writeLock;
  }

  /**
   * Atomically write JSON to a file
   */
  private async atomicWriteJson<T>(filename: string, data: T): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.basePath, filename);
    const tempPath = `${filePath}.${Date.now()}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
