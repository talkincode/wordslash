#!/usr/bin/env node
// WordSlash MCP Server - Main entry point
// Provides MCP tools for managing vocabulary cards via stdio

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Storage } from './storage.js';
import type { CreateCardInput, UpdateCardInput } from './types.js';

// Initialize storage
const storage = new Storage(process.env.WORDSLASH_STORAGE_PATH);

// Define available tools
const tools: Tool[] = [
  {
    name: 'list_cards',
    description: 'List all vocabulary cards. Returns active cards with their front (term, phonetic, example) and back (translation, explanation) content.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional search term to filter cards by term or translation',
        },
        tag: {
          type: 'string',
          description: 'Optional tag to filter cards',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of cards to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'get_card',
    description: 'Get a single vocabulary card by ID or term',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Card ID (UUID)',
        },
        term: {
          type: 'string',
          description: 'Card term (case-insensitive search)',
        },
      },
    },
  },
  {
    name: 'create_card',
    description: 'Create a new vocabulary card',
    inputSchema: {
      type: 'object',
      properties: {
        term: {
          type: 'string',
          description: 'The word, phrase, or sentence to learn (required)',
        },
        type: {
          type: 'string',
          enum: ['word', 'phrase', 'sentence'],
          description: 'Card type (auto-inferred from word count if not provided)',
        },
        phonetic: {
          type: 'string',
          description: 'Phonetic transcription (e.g., /ɪˈfem.ər.əl/)',
        },
        example: {
          type: 'string',
          description: 'Example sentence in English',
        },
        exampleCn: {
          type: 'string',
          description: 'Example sentence translation in Chinese',
        },
        translation: {
          type: 'string',
          description: 'Chinese translation of the term',
        },
        explanation: {
          type: 'string',
          description: 'English explanation/definition',
        },
        explanationCn: {
          type: 'string',
          description: 'Chinese explanation',
        },
        synonyms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of synonyms',
        },
        antonyms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of antonyms',
        },
        notes: {
          type: 'string',
          description: 'Personal notes',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['term'],
    },
  },
  {
    name: 'update_card',
    description: 'Update an existing vocabulary card',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Card ID to update (required)',
        },
        phonetic: { type: 'string' },
        example: { type: 'string' },
        exampleCn: { type: 'string' },
        translation: { type: 'string' },
        explanation: { type: 'string' },
        explanationCn: { type: 'string' },
        synonyms: { type: 'array', items: { type: 'string' } },
        antonyms: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_card',
    description: 'Delete a vocabulary card (soft delete)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Card ID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_cards_batch',
    description: 'Delete multiple vocabulary cards at once (soft delete). Supports deleting by IDs, search term, or tag.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of card IDs to delete',
        },
        search: {
          type: 'string',
          description: 'Delete all cards matching this search term',
        },
        tag: {
          type: 'string',
          description: 'Delete all cards with this tag',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion (safety check)',
        },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'list_events',
    description: 'List review events (learning history). Events are read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: {
          type: 'string',
          description: 'Filter events by card ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (default: 100)',
        },
      },
    },
  },
  {
    name: 'get_index',
    description: 'Get the current index status (card count, due count, new count)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rebuild_index',
    description: 'Rebuild the index from cards and events',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_storage_path',
    description: 'Get the current storage path for WordSlash data',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'wordslash-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_cards': {
        const { search, tag, limit = 50 } = (args || {}) as { search?: string; tag?: string; limit?: number };
        const cards = await storage.getCards();
        let result = Array.from(cards.values());

        // Apply filters
        if (search) {
          const searchLower = search.toLowerCase();
          result = result.filter(
            (c) =>
              c.front.term.toLowerCase().includes(searchLower) ||
              c.back?.translation?.toLowerCase().includes(searchLower)
          );
        }

        if (tag) {
          result = result.filter((c) => c.tags?.includes(tag));
        }

        // Apply limit and format output
        result = result.slice(0, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: result.length,
                  cards: result.map((c) => ({
                    id: c.id,
                    type: c.type,
                    term: c.front.term,
                    phonetic: c.front.phonetic,
                    translation: c.back?.translation,
                    tags: c.tags,
                    version: c.version,
                    createdAt: new Date(c.createdAt).toISOString(),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_card': {
        const { id, term } = (args || {}) as { id?: string; term?: string };

        if (!id && !term) {
          return {
            content: [{ type: 'text', text: 'Error: Either id or term is required' }],
            isError: true,
          };
        }

        const card = id ? await storage.getCard(id) : await storage.getCardByTerm(term!);

        if (!card) {
          return {
            content: [{ type: 'text', text: `Card not found: ${id || term}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(card, null, 2) }],
        };
      }

      case 'create_card': {
        const input = args as unknown as CreateCardInput;

        if (!input?.term) {
          return {
            content: [{ type: 'text', text: 'Error: term is required' }],
            isError: true,
          };
        }

        // Check for existing card with same term
        const existing = await storage.getCardByTerm(input.term);
        if (existing) {
          return {
            content: [
              {
                type: 'text',
                text: `Card with term "${input.term}" already exists (id: ${existing.id}). Use update_card to modify it.`,
              },
            ],
            isError: true,
          };
        }

        const card = await storage.createCard(input);

        return {
          content: [
            {
              type: 'text',
              text: `Card created successfully:\n${JSON.stringify(card, null, 2)}`,
            },
          ],
        };
      }

      case 'update_card': {
        const { id, ...updates } = (args || {}) as unknown as { id: string } & UpdateCardInput;

        if (!id) {
          return {
            content: [{ type: 'text', text: 'Error: id is required' }],
            isError: true,
          };
        }

        const card = await storage.updateCard(id, updates);

        if (!card) {
          return {
            content: [{ type: 'text', text: `Card not found: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Card updated successfully (version ${card.version}):\n${JSON.stringify(card, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_card': {
        const { id } = (args || {}) as { id: string };

        if (!id) {
          return {
            content: [{ type: 'text', text: 'Error: id is required' }],
            isError: true,
          };
        }

        const success = await storage.deleteCard(id);

        if (!success) {
          return {
            content: [{ type: 'text', text: `Card not found: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: `Card ${id} deleted successfully` }],
        };
      }

      case 'delete_cards_batch': {
        const { ids, search, tag, confirm } = (args || {}) as {
          ids?: string[];
          search?: string;
          tag?: string;
          confirm?: boolean;
        };

        if (!confirm) {
          return {
            content: [{ type: 'text', text: 'Error: confirm must be true to delete cards' }],
            isError: true,
          };
        }

        if (!ids && !search && !tag) {
          return {
            content: [{ type: 'text', text: 'Error: provide ids, search, or tag to specify cards to delete' }],
            isError: true,
          };
        }

        const cards = await storage.getCards();
        let toDelete: string[] = [];

        if (ids && ids.length > 0) {
          // Delete by IDs
          toDelete = ids.filter(id => cards.has(id));
        } else {
          // Find cards matching search or tag
          for (const [cardId, card] of cards) {
            let match = false;

            if (search) {
              const searchLower = search.toLowerCase();
              match = card.front.term.toLowerCase().includes(searchLower) ||
                      card.back?.translation?.toLowerCase().includes(searchLower) || false;
            }

            if (tag) {
              match = card.tags?.includes(tag) || false;
            }

            if (match) {
              toDelete.push(cardId);
            }
          }
        }

        if (toDelete.length === 0) {
          return {
            content: [{ type: 'text', text: 'No matching cards found to delete' }],
          };
        }

        // Delete all matching cards
        let deleted = 0;
        const errors: string[] = [];

        for (const cardId of toDelete) {
          try {
            const success = await storage.deleteCard(cardId);
            if (success) {
              deleted++;
            } else {
              errors.push(`Card ${cardId} not found`);
            }
          } catch (err) {
            errors.push(`Failed to delete ${cardId}: ${err}`);
          }
        }

        const result = {
          deleted,
          total: toDelete.length,
          errors: errors.length > 0 ? errors : undefined,
        };

        return {
          content: [
            {
              type: 'text',
              text: `Batch delete completed:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'list_events': {
        const { cardId, limit = 100 } = (args || {}) as { cardId?: string; limit?: number };

        let events = cardId
          ? await storage.getEventsForCard(cardId)
          : await storage.readAllEvents();

        // Sort by timestamp descending (most recent first)
        events = events.sort((a, b) => b.ts - a.ts).slice(0, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: events.length,
                  events: events.map((e) => ({
                    id: e.id,
                    cardId: e.cardId,
                    rating: e.rating,
                    mode: e.mode,
                    timestamp: new Date(e.ts).toISOString(),
                    durationMs: e.durationMs,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_index': {
        const index = await storage.readIndex();

        if (!index) {
          return {
            content: [{ type: 'text', text: 'Index not found. Use rebuild_index to create it.' }],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ...index,
                  updatedAt: new Date(index.updatedAt).toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'rebuild_index': {
        const index = await storage.updateIndex();

        return {
          content: [
            {
              type: 'text',
              text: `Index rebuilt successfully:\n${JSON.stringify(
                { ...index, updatedAt: new Date(index.updatedAt).toISOString() },
                null,
                2
              )}`,
            },
          ],
        };
      }

      case 'get_storage_path': {
        const storagePath = storage.getBasePath();
        const exists = await storage.exists();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ path: storagePath, exists }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WordSlash MCP Server started');
  console.error(`Storage path: ${storage.getBasePath()}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
