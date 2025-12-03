// Storage module - JSONL read/write with atomic operations
// PURE MODULE: No vscode imports allowed

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Card, ReviewEvent } from './schema';

const CARDS_FILE = 'cards.jsonl';
const EVENTS_FILE = 'events.jsonl';

/**
 * JSONL-based storage with atomic writes and concurrent-safe appends
 */
export class JsonlStorage {
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly basePath: string) {}

  /**
   * Append a card to cards.jsonl
   */
  async appendCard(card: Card): Promise<void> {
    await this.appendLine(CARDS_FILE, JSON.stringify(card));
  }

  /**
   * Append a review event to events.jsonl
   */
  async appendEvent(event: ReviewEvent): Promise<void> {
    await this.appendLine(EVENTS_FILE, JSON.stringify(event));
  }

  /**
   * Read all cards from cards.jsonl
   */
  async readAllCards(): Promise<Card[]> {
    return this.readJsonl<Card>(CARDS_FILE);
  }

  /**
   * Read all events from events.jsonl
   */
  async readAllEvents(): Promise<ReviewEvent[]> {
    return this.readJsonl<ReviewEvent>(EVENTS_FILE);
  }

  /**
   * Atomically write JSON to a file using temp file + rename
   */
  async atomicWriteJson<T>(filename: string, data: T): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.basePath, filename);
    const tempPath = `${filePath}.${Date.now()}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Read JSON file, returns null if file doesn't exist
   */
  async readJson<T>(filename: string): Promise<T | null> {
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
   * Append a line to a JSONL file with concurrent-safe locking
   */
  private async appendLine(filename: string, line: string): Promise<void> {
    // Queue this write after any pending writes
    this.writeLock = this.writeLock.then(async () => {
      await this.ensureDir();
      const filePath = path.join(this.basePath, filename);
      await fs.appendFile(filePath, line + '\n', 'utf-8');
    });
    await this.writeLock;
  }

  /**
   * Read a JSONL file and parse each line
   */
  private async readJsonl<T>(filename: string): Promise<T[]> {
    const filePath = path.join(this.basePath, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const results: T[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        try {
          results.push(JSON.parse(trimmed) as T);
        } catch {
          // Log warning but continue (skip invalid JSON lines)
          console.warn(`Skipping invalid JSON line: ${trimmed.substring(0, 50)}...`);
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
   * Ensure the base directory exists
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }
}
