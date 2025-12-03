import type { Card, CardIndex, CreateCardInput, ReviewEvent, UpdateCardInput } from './types.js';
/**
 * Get the default storage path for WordSlash data
 */
export declare function getDefaultStoragePath(): string;
/**
 * Storage class for managing WordSlash data files
 */
export declare class Storage {
    private basePath;
    private writeLock;
    constructor(basePath?: string);
    /**
     * Get the storage base path
     */
    getBasePath(): string;
    /**
     * Ensure the storage directory exists
     */
    ensureDir(): Promise<void>;
    /**
     * Check if storage directory exists
     */
    exists(): Promise<boolean>;
    /**
     * Read all card entries from cards.jsonl
     */
    readAllCardEntries(): Promise<Card[]>;
    /**
     * Get deduplicated cards (latest version, excluding deleted)
     */
    getCards(): Promise<Map<string, Card>>;
    /**
     * Get a single card by ID
     */
    getCard(id: string): Promise<Card | null>;
    /**
     * Get a card by term (case-insensitive)
     */
    getCardByTerm(term: string): Promise<Card | null>;
    /**
     * Create a new card
     */
    createCard(input: CreateCardInput): Promise<Card>;
    /**
     * Update an existing card
     */
    updateCard(id: string, updates: UpdateCardInput): Promise<Card | null>;
    /**
     * Delete a card (soft delete)
     */
    deleteCard(id: string): Promise<boolean>;
    /**
     * Append a card to cards.jsonl
     */
    appendCard(card: Card): Promise<void>;
    /**
     * Read all review events
     */
    readAllEvents(): Promise<ReviewEvent[]>;
    /**
     * Get events for a specific card
     */
    getEventsForCard(cardId: string): Promise<ReviewEvent[]>;
    /**
     * Read the index file
     */
    readIndex(): Promise<CardIndex | null>;
    /**
     * Update the index file
     */
    updateIndex(): Promise<CardIndex>;
    /**
     * Read a JSONL file
     */
    private readJsonl;
    /**
     * Read a JSON file
     */
    private readJson;
    /**
     * Append a line to a file with locking
     */
    private appendLine;
    /**
     * Atomically write JSON to a file
     */
    private atomicWriteJson;
}
//# sourceMappingURL=storage.d.ts.map