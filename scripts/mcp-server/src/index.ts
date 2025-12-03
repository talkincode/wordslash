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
import type { CreateCardInput, UpdateCardInput, KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, DashboardStats } from './types.js';

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
  {
    name: 'get_dashboard_stats',
    description: 'Get comprehensive dashboard statistics including card counts, review history, retention rate, and streak data',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'generate_knowledge_graph',
    description: 'Generate a knowledge graph of vocabulary cards showing relationships through synonyms, antonyms, and tags. Returns nodes and edges for visualization.',
    inputSchema: {
      type: 'object',
      properties: {
        maxNodes: {
          type: 'number',
          description: 'Maximum number of nodes to include (default: 100)',
        },
        includeOrphans: {
          type: 'boolean',
          description: 'Include cards without any connections (default: false)',
        },
        tag: {
          type: 'string',
          description: 'Filter graph to only include cards with this tag',
        },
      },
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

      case 'get_dashboard_stats': {
        const stats = await generateDashboardStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case 'generate_knowledge_graph': {
        const { maxNodes = 100, includeOrphans = false, tag } = (args || {}) as {
          maxNodes?: number;
          includeOrphans?: boolean;
          tag?: string;
        };

        const graph = await generateKnowledgeGraph(maxNodes, includeOrphans, tag);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(graph, null, 2),
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

/**
 * Generate dashboard statistics from cards and events
 */
async function generateDashboardStats(): Promise<DashboardStats> {
  const cards = await storage.getCards();
  const events = await storage.readAllEvents();
  const index = await storage.readIndex();
  
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  
  // Calculate card counts
  const activeCards = Array.from(cards.values());
  const totalCards = activeCards.length;
  
  // Card type distribution
  const cardsByType = { word: 0, phrase: 0, sentence: 0 };
  for (const card of activeCards) {
    cardsByType[card.type]++;
  }
  
  // Review statistics
  const totalReviews = events.length;
  const reviewsToday = events.filter(e => e.ts >= todayStart).length;
  
  // Ratings distribution
  const ratingsDistribution = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const event of events) {
    ratingsDistribution[event.rating]++;
  }
  
  // Retention rate (good + easy) / total
  const positiveRatings = ratingsDistribution.good + ratingsDistribution.easy;
  const retentionRate = totalReviews > 0 ? positiveRatings / totalReviews : 0;
  
  // Calculate streak (consecutive days with reviews)
  const currentStreak = calculateStreak(events);
  
  // Reviews per day (last 30 days)
  const reviewsPerDay = calculateReviewsPerDay(events, 30);
  
  // Count due, new, learned, mastered cards
  let dueCards = 0;
  let newCards = 0;
  let learnedCards = 0;
  let masteredCards = 0;
  let totalEaseFactor = 0;
  let easeFactorCount = 0;
  
  // Build SRS state from events
  const eventsByCard = new Map<string, typeof events>();
  for (const event of events) {
    const cardEvents = eventsByCard.get(event.cardId) || [];
    cardEvents.push(event);
    eventsByCard.set(event.cardId, cardEvents);
  }
  
  for (const card of activeCards) {
    const cardEvents = eventsByCard.get(card.id) || [];
    
    if (cardEvents.length === 0) {
      newCards++;
    } else {
      learnedCards++;
      
      // Compute simple SRS state
      const reps = cardEvents.length;
      const lastEvent = cardEvents[cardEvents.length - 1];
      
      // Estimate ease factor (simplified)
      let easeFactor = 2.5;
      for (const e of cardEvents) {
        const q = e.rating === 'again' ? 0 : e.rating === 'hard' ? 3 : e.rating === 'good' ? 4 : 5;
        easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      }
      
      totalEaseFactor += easeFactor;
      easeFactorCount++;
      
      // Estimate interval
      let interval = 1;
      for (let i = 0; i < cardEvents.length; i++) {
        const q = cardEvents[i].rating === 'again' ? 0 : cardEvents[i].rating === 'hard' ? 3 : cardEvents[i].rating === 'good' ? 4 : 5;
        if (q === 0) {
          interval = 1;
        } else if (i === 0) {
          interval = 1;
        } else if (i === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
      }
      
      // Check if mastered (interval >= 21 days)
      if (interval >= 21) {
        masteredCards++;
      }
      
      // Check if due
      const dueAt = lastEvent.ts + interval * 24 * 60 * 60 * 1000;
      if (dueAt <= now) {
        dueCards++;
      }
    }
  }
  
  const averageEaseFactor = easeFactorCount > 0 ? totalEaseFactor / easeFactorCount : 2.5;
  
  return {
    totalCards,
    dueCards,
    newCards,
    learnedCards,
    masteredCards,
    totalReviews,
    reviewsToday,
    currentStreak,
    averageEaseFactor: Math.round(averageEaseFactor * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
    cardsByType,
    ratingsDistribution,
    reviewsPerDay,
  };
}

/**
 * Calculate current streak (consecutive days with reviews)
 */
function calculateStreak(events: { ts: number }[]): number {
  if (events.length === 0) return 0;
  
  // Get unique review dates
  const reviewDates = new Set<string>();
  for (const event of events) {
    const date = new Date(event.ts).toISOString().split('T')[0];
    reviewDates.add(date);
  }
  
  const sortedDates = Array.from(reviewDates).sort().reverse();
  if (sortedDates.length === 0) return 0;
  
  // Check if today or yesterday has a review
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0; // Streak broken
  }
  
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (24 * 60 * 60 * 1000));
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate reviews per day for the last N days
 */
function calculateReviewsPerDay(events: { ts: number }[], days: number): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const countByDate = new Map<string, number>();
  
  for (const event of events) {
    const date = new Date(event.ts).toISOString().split('T')[0];
    countByDate.set(date, (countByDate.get(date) || 0) + 1);
  }
  
  // Generate last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    result.push({
      date,
      count: countByDate.get(date) || 0,
    });
  }
  
  return result;
}

/**
 * Generate knowledge graph from vocabulary cards
 */
async function generateKnowledgeGraph(
  maxNodes: number,
  includeOrphans: boolean,
  tag?: string
): Promise<KnowledgeGraph> {
  const cards = await storage.getCards();
  const events = await storage.readAllEvents();
  
  // Build SRS state for mastery level
  const eventsByCard = new Map<string, { ts: number; rating: string }[]>();
  for (const event of events) {
    const cardEvents = eventsByCard.get(event.cardId) || [];
    cardEvents.push(event);
    eventsByCard.set(event.cardId, cardEvents);
  }
  
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const nodeIds = new Set<string>();
  
  // Helper to calculate mastery level
  const getMasteryLevel = (cardId: string): number => {
    const cardEvents = eventsByCard.get(cardId) || [];
    if (cardEvents.length === 0) return 0;
    
    // Calculate based on reps and ease factor
    const reps = cardEvents.length;
    if (reps >= 10) return 5;
    if (reps >= 7) return 4;
    if (reps >= 4) return 3;
    if (reps >= 2) return 2;
    return 1;
  };
  
  // Filter cards by tag if specified
  let filteredCards = Array.from(cards.values());
  if (tag) {
    filteredCards = filteredCards.filter(c => c.tags?.includes(tag));
  }
  
  // Track connections for orphan filtering
  const connectionCount = new Map<string, number>();
  
  // First pass: count connections
  for (const card of filteredCards) {
    let connections = 0;
    
    if (card.back?.synonyms?.length) connections += card.back.synonyms.length;
    if (card.back?.antonyms?.length) connections += card.back.antonyms.length;
    if (card.tags?.length) connections += card.tags.length;
    
    connectionCount.set(card.id, connections);
  }
  
  // Sort cards by connections (most connected first) for better graph
  filteredCards.sort((a, b) => {
    return (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0);
  });
  
  // Limit cards
  if (!includeOrphans) {
    filteredCards = filteredCards.filter(c => (connectionCount.get(c.id) || 0) > 0);
  }
  filteredCards = filteredCards.slice(0, maxNodes);
  
  // Add card nodes
  for (const card of filteredCards) {
    const masteryLevel = getMasteryLevel(card.id);
    
    nodes.push({
      id: card.id,
      label: card.front.term,
      type: 'card',
      masteryLevel,
      weight: 1 + (connectionCount.get(card.id) || 0) * 0.2,
    });
    nodeIds.add(card.id);
  }
  
  // Helper to generate consistent ID for related terms
  const getRelatedTermId = (term: string, type: 'synonym' | 'antonym' | 'tag'): string => {
    return `${type}:${term.toLowerCase()}`;
  };
  
  // Add relationships
  for (const card of filteredCards) {
    // Synonyms
    if (card.back?.synonyms) {
      for (const synonym of card.back.synonyms) {
        const synonymId = getRelatedTermId(synonym, 'synonym');
        
        // Check if synonym matches another card
        const matchingCard = filteredCards.find(
          c => c.id !== card.id && c.front.term.toLowerCase() === synonym.toLowerCase()
        );
        
        if (matchingCard) {
          // Direct card-to-card connection
          edges.push({
            source: card.id,
            target: matchingCard.id,
            type: 'synonym',
            weight: 2,
          });
        } else if (!nodeIds.has(synonymId)) {
          // Add synonym as separate node
          nodes.push({
            id: synonymId,
            label: synonym,
            type: 'synonym',
            weight: 0.5,
          });
          nodeIds.add(synonymId);
          
          edges.push({
            source: card.id,
            target: synonymId,
            type: 'synonym',
            weight: 1,
          });
        } else {
          edges.push({
            source: card.id,
            target: synonymId,
            type: 'synonym',
            weight: 1,
          });
        }
      }
    }
    
    // Antonyms
    if (card.back?.antonyms) {
      for (const antonym of card.back.antonyms) {
        const antonymId = getRelatedTermId(antonym, 'antonym');
        
        // Check if antonym matches another card
        const matchingCard = filteredCards.find(
          c => c.id !== card.id && c.front.term.toLowerCase() === antonym.toLowerCase()
        );
        
        if (matchingCard) {
          edges.push({
            source: card.id,
            target: matchingCard.id,
            type: 'antonym',
            weight: 2,
          });
        } else if (!nodeIds.has(antonymId)) {
          nodes.push({
            id: antonymId,
            label: antonym,
            type: 'antonym',
            weight: 0.5,
          });
          nodeIds.add(antonymId);
          
          edges.push({
            source: card.id,
            target: antonymId,
            type: 'antonym',
            weight: 1,
          });
        } else {
          edges.push({
            source: card.id,
            target: antonymId,
            type: 'antonym',
            weight: 1,
          });
        }
      }
    }
    
    // Tags (connect cards with same tags)
    if (card.tags) {
      for (const cardTag of card.tags) {
        const tagId = getRelatedTermId(cardTag, 'tag');
        
        if (!nodeIds.has(tagId)) {
          nodes.push({
            id: tagId,
            label: `#${cardTag}`,
            type: 'tag',
            weight: 0.8,
          });
          nodeIds.add(tagId);
        }
        
        edges.push({
          source: card.id,
          target: tagId,
          type: 'tag',
          weight: 0.5,
        });
      }
    }
  }
  
  return {
    nodes,
    edges,
    meta: {
      totalCards: filteredCards.length,
      totalConnections: edges.length,
      generatedAt: Date.now(),
    },
  };
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
