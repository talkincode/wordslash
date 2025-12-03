// Tests for bulk import functionality
import { describe, it, expect, beforeEach } from 'vitest';
import {
  inferCardType,
  validateBulkCardInput,
  validateBulkImportTemplate,
  convertToCreateCardInput,
  parseBulkImportJson,
  processBulkImport,
  buildTermIndex,
  normalizeTerm,
  generateSampleTemplate,
  generateEmptyTemplate,
} from '../../storage/bulkImport';
import { createCard, type BulkCardInput, type BulkImportTemplate, type Card } from '../../storage/schema';

describe('inferCardType', () => {
  it('should return "word" for single word', () => {
    expect(inferCardType('ephemeral')).toBe('word');
    expect(inferCardType('  hello  ')).toBe('word');
  });

  it('should return "phrase" for 2-4 words', () => {
    expect(inferCardType('break the ice')).toBe('phrase');
    expect(inferCardType('once upon a time')).toBe('phrase');
  });

  it('should return "sentence" for 5+ words', () => {
    expect(inferCardType('The quick brown fox jumps over')).toBe('sentence');
    expect(inferCardType('I have never seen anything like this before')).toBe('sentence');
  });
});

describe('validateBulkCardInput', () => {
  it('should return null for valid input', () => {
    const input: BulkCardInput = { term: 'hello' };
    expect(validateBulkCardInput(input, 0)).toBeNull();
  });

  it('should return null for input with all optional fields', () => {
    const input: BulkCardInput = {
      term: 'ephemeral',
      type: 'word',
      phonetic: '/ɪˈfem.ər.əl/',
      translation: '短暂的',
      explanation: 'lasting for a very short time',
      example: 'Fame is ephemeral.',
      synonyms: ['transient', 'fleeting'],
      antonyms: ['permanent'],
      notes: 'test note',
      tags: ['GRE'],
    };
    expect(validateBulkCardInput(input, 0)).toBeNull();
  });

  it('should return error for null input', () => {
    expect(validateBulkCardInput(null as unknown as BulkCardInput, 0)).toContain('null or undefined');
  });

  it('should return error for empty term', () => {
    expect(validateBulkCardInput({ term: '' }, 0)).toContain("'term' is required");
    expect(validateBulkCardInput({ term: '   ' }, 0)).toContain("'term' is required");
  });

  it('should return error for invalid type', () => {
    expect(validateBulkCardInput({ term: 'test', type: 'invalid' as never }, 0)).toContain("'type' must be");
  });

  it('should return error for non-array synonyms', () => {
    expect(validateBulkCardInput({ term: 'test', synonyms: 'not-array' as never }, 0)).toContain("'synonyms' must be an array");
  });

  it('should return error for non-array antonyms', () => {
    expect(validateBulkCardInput({ term: 'test', antonyms: 'not-array' as never }, 0)).toContain("'antonyms' must be an array");
  });

  it('should return error for non-array tags', () => {
    expect(validateBulkCardInput({ term: 'test', tags: 'not-array' as never }, 0)).toContain("'tags' must be an array");
  });
});

describe('validateBulkImportTemplate', () => {
  it('should return null for valid template', () => {
    const template = { version: 1, cards: [] };
    expect(validateBulkImportTemplate(template)).toBeNull();
  });

  it('should return error for non-object', () => {
    expect(validateBulkImportTemplate(null)).toContain('must be an object');
    expect(validateBulkImportTemplate('string')).toContain('must be an object');
  });

  it('should return error for missing version', () => {
    expect(validateBulkImportTemplate({ cards: [] })).toContain("'version' is required");
  });

  it('should return error for invalid version', () => {
    expect(validateBulkImportTemplate({ version: 0, cards: [] })).toContain("'version' is required");
    expect(validateBulkImportTemplate({ version: -1, cards: [] })).toContain("'version' is required");
  });

  it('should return error for missing cards', () => {
    expect(validateBulkImportTemplate({ version: 1 })).toContain("'cards' is required");
  });

  it('should return error for non-array cards', () => {
    expect(validateBulkImportTemplate({ version: 1, cards: {} })).toContain("'cards' is required");
  });
});

describe('convertToCreateCardInput', () => {
  it('should convert minimal input', () => {
    const input: BulkCardInput = { term: 'hello' };
    const result = convertToCreateCardInput(input);

    expect(result.type).toBe('word');
    expect(result.front.term).toBe('hello');
  });

  it('should use provided type', () => {
    const input: BulkCardInput = { term: 'hello', type: 'phrase' };
    const result = convertToCreateCardInput(input);

    expect(result.type).toBe('phrase');
  });

  it('should convert all fields', () => {
    const input: BulkCardInput = {
      term: '  ephemeral  ',
      type: 'word',
      phonetic: '  /ɪˈfem.ər.əl/  ',
      translation: '  短暂的  ',
      explanation: '  lasting for a very short time  ',
      example: '  Fame is ephemeral.  ',
      synonyms: ['  transient  ', '  fleeting  ', ''],
      antonyms: ['  permanent  ', ''],
      notes: '  test note  ',
      tags: ['  GRE  ', '  adjective  ', ''],
    };
    const result = convertToCreateCardInput(input);

    expect(result.front.term).toBe('ephemeral');
    expect(result.front.phonetic).toBe('/ɪˈfem.ər.əl/');
    expect(result.front.example).toBe('Fame is ephemeral.');
    expect(result.back?.translation).toBe('短暂的');
    expect(result.back?.explanation).toBe('lasting for a very short time');
    expect(result.back?.synonyms).toEqual(['transient', 'fleeting']);
    expect(result.back?.antonyms).toEqual(['permanent']);
    expect(result.back?.notes).toBe('test note');
    expect(result.tags).toEqual(['GRE', 'adjective']);
  });
});

describe('parseBulkImportJson', () => {
  it('should parse valid JSON', () => {
    const json = JSON.stringify({ version: 1, cards: [{ term: 'hello' }] });
    const result = parseBulkImportJson(json);

    expect(result.version).toBe(1);
    expect(result.cards).toHaveLength(1);
  });

  it('should throw for invalid JSON', () => {
    expect(() => parseBulkImportJson('not json')).toThrow('Invalid JSON format');
  });

  it('should throw for invalid template', () => {
    expect(() => parseBulkImportJson('{}')).toThrow("'version' is required");
  });
});

describe('normalizeTerm', () => {
  it('should lowercase and trim', () => {
    expect(normalizeTerm('  Hello World  ')).toBe('hello world');
    expect(normalizeTerm('EPHEMERAL')).toBe('ephemeral');
  });
});

describe('buildTermIndex', () => {
  it('should return empty map for no cards', () => {
    expect(buildTermIndex([]).size).toBe(0);
  });

  it('should index cards by normalized term', () => {
    const cards: Card[] = [
      createCard({ type: 'word', front: { term: 'Hello' } }),
      createCard({ type: 'word', front: { term: 'World' } }),
    ];
    const index = buildTermIndex(cards);

    expect(index.size).toBe(2);
    expect(index.get('hello')).toBeDefined();
    expect(index.get('world')).toBeDefined();
  });

  it('should keep latest version for duplicate terms', () => {
    const card1 = createCard({ type: 'word', front: { term: 'hello' } });
    const card2 = { ...card1, version: 2, back: { translation: 'updated' } };
    const cards = [card1, card2];

    const index = buildTermIndex(cards);
    expect(index.size).toBe(1);
    expect(index.get('hello')?.version).toBe(2);
  });

  it('should exclude deleted cards', () => {
    const card1 = createCard({ type: 'word', front: { term: 'hello' } });
    const card2: Card = { ...card1, version: 2, deleted: true };
    const cards = [card1, card2];

    const index = buildTermIndex(cards);
    expect(index.size).toBe(0);
  });
});

describe('processBulkImport', () => {
  let existingCards: Card[];

  beforeEach(() => {
    existingCards = [
      createCard({ type: 'word', front: { term: 'existing' }, back: { translation: 'old' } }),
    ];
  });

  it('should import new cards', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [{ term: 'newword', translation: '新词' }],
    };

    const { newCards, updatedCards, result } = processBulkImport(template, []);

    expect(newCards).toHaveLength(1);
    expect(updatedCards).toHaveLength(0);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('should update existing cards (overwrite strategy)', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [{ term: 'existing', translation: 'new translation' }],
    };

    const { newCards, updatedCards, result } = processBulkImport(template, existingCards);

    expect(newCards).toHaveLength(0);
    expect(updatedCards).toHaveLength(1);
    expect(updatedCards[0].back?.translation).toBe('new translation');
    expect(updatedCards[0].version).toBe(2);
    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('should handle case-insensitive term matching', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [{ term: 'EXISTING', translation: 'updated' }],
    };

    const { newCards, updatedCards, result } = processBulkImport(template, existingCards);

    expect(newCards).toHaveLength(0);
    expect(updatedCards).toHaveLength(1);
    expect(result.updated).toBe(1);
  });

  it('should skip invalid cards and record errors', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [
        { term: '' }, // invalid: empty term
        { term: 'valid' },
        { term: 'another', type: 'invalid' as never }, // invalid type
      ],
    };

    const { newCards, updatedCards, result } = processBulkImport(template, []);

    expect(newCards).toHaveLength(1);
    expect(newCards[0].front.term).toBe('valid');
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it('should handle mixed import and update', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [
        { term: 'existing', translation: 'updated' },
        { term: 'newcard', translation: '新卡片' },
      ],
    };

    const { newCards, updatedCards, result } = processBulkImport(template, existingCards);

    expect(newCards).toHaveLength(1);
    expect(updatedCards).toHaveLength(1);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('should update front fields if provided', () => {
    const template: BulkImportTemplate = {
      version: 1,
      cards: [
        { term: 'existing', phonetic: '/new/', example: 'new example' },
      ],
    };

    const { updatedCards } = processBulkImport(template, existingCards);

    expect(updatedCards[0].front.phonetic).toBe('/new/');
    expect(updatedCards[0].front.example).toBe('new example');
  });
});

describe('generateSampleTemplate', () => {
  it('should generate valid template', () => {
    const template = generateSampleTemplate();

    expect(template.version).toBe(1);
    expect(template.cards.length).toBeGreaterThan(0);
    expect(template.cards[0].term).toBeTruthy();
  });

  it('should include example cards with various fields', () => {
    const template = generateSampleTemplate();
    const firstCard = template.cards[0];

    expect(firstCard.term).toBeDefined();
    expect(firstCard.translation).toBeDefined();
    expect(firstCard.tags).toBeDefined();
  });
});

describe('generateEmptyTemplate', () => {
  it('should generate valid template structure', () => {
    const template = generateEmptyTemplate();

    expect(template.version).toBe(1);
    expect(template.cards).toHaveLength(1);
    expect(template.cards[0].term).toBe('');
  });
});
