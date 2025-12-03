// LLM module - Generator interface (stub only in v1)
// PURE MODULE: No vscode imports allowed

import type { Card } from '../storage/schema';

/**
 * Interface for generating card back content
 * v1: Stub implementation only, returns null
 */
export interface BackContentGenerator {
  generate(card: Card): Promise<Partial<Card['back']> | null>;
}

/**
 * Stub generator - returns null, no real LLM calls in v1
 */
export class StubGenerator implements BackContentGenerator {
  async generate(_card: Card): Promise<null> {
    return null;
  }
}
