// Storage module - Bulk import functionality
// PURE MODULE: No vscode imports allowed

import type {
  BulkCardInput,
  BulkImportResult,
  BulkImportTemplate,
  Card,
  CardType,
  CreateCardInput,
} from './schema';
import { createCard, updateCard } from './schema';

/**
 * Infer card type from term word count
 * - 1 word = 'word'
 * - 2-4 words = 'phrase'
 * - 5+ words = 'sentence'
 */
export function inferCardType(term: string): CardType {
  const wordCount = term.trim().split(/\s+/).length;
  if (wordCount === 1) {
    return 'word';
  } else if (wordCount <= 4) {
    return 'phrase';
  } else {
    return 'sentence';
  }
}

/**
 * Validate a single bulk card input
 * Returns error message if invalid, null if valid
 */
export function validateBulkCardInput(input: BulkCardInput, index: number): string | null {
  if (!input) {
    return `Card at index ${index}: input is null or undefined`;
  }

  if (typeof input.term !== 'string' || !input.term.trim()) {
    return `Card at index ${index}: 'term' is required and must be a non-empty string`;
  }

  if (input.type !== undefined && !['word', 'phrase', 'sentence'].includes(input.type)) {
    return `Card at index ${index}: 'type' must be 'word', 'phrase', or 'sentence'`;
  }

  if (input.synonyms !== undefined && !Array.isArray(input.synonyms)) {
    return `Card at index ${index}: 'synonyms' must be an array`;
  }

  if (input.antonyms !== undefined && !Array.isArray(input.antonyms)) {
    return `Card at index ${index}: 'antonyms' must be an array`;
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    return `Card at index ${index}: 'tags' must be an array`;
  }

  return null;
}

/**
 * Validate bulk import template structure
 * Returns error message if invalid, null if valid
 */
export function validateBulkImportTemplate(template: unknown): string | null {
  if (!template || typeof template !== 'object') {
    return 'Template must be an object';
  }

  const t = template as Record<string, unknown>;

  if (typeof t.version !== 'number' || t.version < 1) {
    return "'version' is required and must be a positive number";
  }

  if (!Array.isArray(t.cards)) {
    return "'cards' is required and must be an array";
  }

  return null;
}

/**
 * Convert BulkCardInput to CreateCardInput
 */
export function convertToCreateCardInput(input: BulkCardInput): CreateCardInput {
  const type = input.type ?? inferCardType(input.term);

  return {
    type,
    front: {
      term: input.term.trim(),
      phonetic: input.phonetic?.trim(),
      example: input.example?.trim(),
      exampleCn: input.exampleCn?.trim(),
    },
    back: {
      translation: input.translation?.trim(),
      explanation: input.explanation?.trim(),
      explanationCn: input.explanationCn?.trim(),
      synonyms: input.synonyms?.map((s) => s.trim()).filter(Boolean),
      antonyms: input.antonyms?.map((a) => a.trim()).filter(Boolean),
      notes: input.notes?.trim(),
    },
    tags: input.tags?.map((t) => t.trim()).filter(Boolean),
  };
}

/**
 * Parse and validate a bulk import JSON string
 * Returns validated template or throws error
 */
export function parseBulkImportJson(jsonString: string): BulkImportTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const templateError = validateBulkImportTemplate(parsed);
  if (templateError) {
    throw new Error(templateError);
  }

  return parsed as BulkImportTemplate;
}

/**
 * Build a term index from existing cards for duplicate detection
 * Returns a map of normalized term -> latest card
 */
export function buildTermIndex(existingCards: Card[]): Map<string, Card> {
  const termIndex = new Map<string, Card>();

  // Sort by version to ensure we keep the latest
  const sortedCards = [...existingCards].sort((a, b) => a.version - b.version);

  for (const card of sortedCards) {
    if (card.deleted) {
      termIndex.delete(normalizeTerm(card.front.term));
    } else {
      termIndex.set(normalizeTerm(card.front.term), card);
    }
  }

  return termIndex;
}

/**
 * Normalize a term for comparison (lowercase, trim whitespace)
 */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim();
}

/**
 * Process bulk import and return cards to be written
 * Returns new cards and updated cards separately
 */
export function processBulkImport(
  template: BulkImportTemplate,
  existingCards: Card[]
): {
  newCards: Card[];
  updatedCards: Card[];
  result: BulkImportResult;
} {
  const termIndex = buildTermIndex(existingCards);
  const newCards: Card[] = [];
  const updatedCards: Card[] = [];
  const result: BulkImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < template.cards.length; i++) {
    const input = template.cards[i];

    // Validate input
    const validationError = validateBulkCardInput(input, i);
    if (validationError) {
      result.errors.push(validationError);
      result.skipped++;
      continue;
    }

    const normalizedTerm = normalizeTerm(input.term);
    const existingCard = termIndex.get(normalizedTerm);

    if (existingCard) {
      // Update existing card (overwrite strategy)
      const updatedCard = updateCard(existingCard, {
        back: {
          translation: input.translation?.trim(),
          explanation: input.explanation?.trim(),
          explanationCn: input.explanationCn?.trim(),
          synonyms: input.synonyms?.map((s) => s.trim()).filter(Boolean),
          antonyms: input.antonyms?.map((a) => a.trim()).filter(Boolean),
          notes: input.notes?.trim(),
        },
        tags: input.tags?.map((t) => t.trim()).filter(Boolean),
      });

      // Also update front fields if provided
      if (input.phonetic || input.example || input.exampleCn) {
        updatedCard.front = {
          ...updatedCard.front,
          phonetic: input.phonetic?.trim() ?? updatedCard.front.phonetic,
          example: input.example?.trim() ?? updatedCard.front.example,
          exampleCn: input.exampleCn?.trim() ?? updatedCard.front.exampleCn,
        };
      }

      updatedCards.push(updatedCard);
      termIndex.set(normalizedTerm, updatedCard);
      result.updated++;
    } else {
      // Create new card
      const createInput = convertToCreateCardInput(input);
      const newCard = createCard(createInput);

      newCards.push(newCard);
      termIndex.set(normalizedTerm, newCard);
      result.imported++;
    }
  }

  return { newCards, updatedCards, result };
}

/**
 * Generate a sample bulk import template with example cards
 */
export function generateSampleTemplate(): BulkImportTemplate {
  return {
    version: 1,
    cards: [
      {
        term: 'ephemeral',
        type: 'word',
        phonetic: '/ɪˈfem.ər.əl/',
        translation: '短暂的，转瞬即逝的',
        explanation: 'lasting for a very short time',
        explanationCn: '持续时间非常短暂的',
        example: 'Fame in the internet age is often ephemeral.',
        exampleCn: '在互联网时代，名声往往是短暂的。',
        synonyms: ['transient', 'fleeting', 'momentary'],
        antonyms: ['permanent', 'lasting', 'enduring'],
        tags: ['GRE', 'adjective'],
        notes: '常用于描述网络现象或自然界短暂存在的事物',
      },
      {
        term: 'serendipity',
        type: 'word',
        phonetic: '/ˌser.ənˈdɪp.ə.ti/',
        translation: '意外发现；机缘巧合',
        explanation: 'the fact of finding interesting or valuable things by chance',
        explanationCn: '偶然发现有趣或有价值事物的情况',
        example: 'It was pure serendipity that we met at the coffee shop.',
        exampleCn: '我们在咖啡店相遇纯属机缘巧合。',
        synonyms: ['luck', 'fortune', 'chance'],
        tags: ['vocabulary'],
      },
      {
        term: 'break the ice',
        type: 'phrase',
        translation: '打破僵局；缓和气氛',
        explanation: 'to make people feel more relaxed in a social situation',
        explanationCn: '在社交场合让人们感到更放松',
        example: 'I tried to break the ice by telling a joke.',
        exampleCn: '我试着讲个笑话来打破僵局。',
        tags: ['idiom', 'social'],
      },
    ],
  };
}

/**
 * Generate an empty template for users to fill in
 */
export function generateEmptyTemplate(): BulkImportTemplate {
  return {
    version: 1,
    cards: [
      {
        term: '',
        // type: 'word', // Optional: auto-inferred from word count
        // phonetic: '',
        // translation: '',
        // explanation: '',
        // example: '',
        // synonyms: [],
        // antonyms: [],
        // notes: '',
        // tags: [],
      },
    ],
  };
}
