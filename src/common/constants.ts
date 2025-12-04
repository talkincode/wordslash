// Common constants - Configuration values
// PURE MODULE: No vscode imports allowed

/**
 * Time constants
 */
export const DAY_MS = 86400000; // 24 * 60 * 60 * 1000

/**
 * SRS constants
 */
export const MATURE_INTERVAL_DAYS = 21;
export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

/**
 * Scheduler constants
 */
export const MAX_RECENT_CARDS = 5;
export const DEFAULT_NEW_CARDS_PER_DAY = 20;
export const DEFAULT_MAX_NODES = 100;

/**
 * Indexer constants
 */
export const INDEXER_VERSION = 1;

/**
 * File names
 */
export const CARDS_FILE = 'cards.jsonl';
export const EVENTS_FILE = 'events.jsonl';
export const INDEX_FILE = 'index.json';
