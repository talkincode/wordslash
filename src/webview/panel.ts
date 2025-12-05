// Webview panel - Webview creation + message router
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateNextState } from '../srs/sm2';
import { getNextCard } from '../srs/scheduler';
import { createReviewEvent, type Card, type ReviewRating, type CardIndex } from '../storage/schema';
import { isValidUiMessage, type ExtensionToUiMessage, type UiToExtensionMessage, type StudyMode } from './protocol';
import { logDebug, logError, logWarn } from '../common/logger';
import { MAX_RECENT_CARDS } from '../common/constants';
import { generateFlashcardHtml } from './panelHtml';
import {
  type SessionState,
  type RecentCardsState,
  createSessionState,
  resetSessionState,
  updateSessionAfterRating,
  calculateSessionStats,
  isNewCard,
  createRecentCardsState,
  addToRecentCards,
  clearRecentCards,
  getSchedulerOptionsFromMode,
  shouldShowSessionComplete,
  mergeTtsSettings,
} from './panelHandlers';

// GlobalState keys
const STUDY_MODE_KEY = 'wordslash.studyMode';

export class FlashcardPanel {
  public static currentPanel: FlashcardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _currentCard: Card | null = null;
  
  // Use extracted state managers
  private _recentCards: RecentCardsState;
  private _session: SessionState;
  
  // Study mode state
  private _studyMode: StudyMode = 'loop';
  
  // Cache index to avoid rebuilding on every card request
  private _cachedIndex: CardIndex | null = null;
  private _indexVersion: number = 0; // Increment on data changes

  private constructor(
    panel: vscode.WebviewPanel, 
    extensionUri: vscode.Uri, 
    storage: JsonlStorage,
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._storage = storage;
    this._context = context;
    
    // Initialize state managers
    this._recentCards = createRecentCardsState(MAX_RECENT_CARDS);
    this._session = createSessionState();
    
    // Load saved study mode from globalState
    this._studyMode = context.globalState.get<StudyMode>(STUDY_MODE_KEY, 'loop');

    // Set the webview content
    this._panel.webview.html = generateFlashcardHtml();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, storage: JsonlStorage, context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (FlashcardPanel.currentPanel) {
      FlashcardPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'wordslashFlashcards',
      'WordSlash Flashcards',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    FlashcardPanel.currentPanel = new FlashcardPanel(panel, extensionUri, storage, context);
  }

  public dispose() {
    FlashcardPanel.currentPanel = undefined;

    // Clear cache
    this._cachedIndex = null;
    this._currentCard = null;
    this._recentCards = clearRecentCards(this._recentCards);
    
    // Reset session stats
    this._session = resetSessionState(this._session);

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private async _handleMessage(message: unknown) {
    if (!isValidUiMessage(message)) {
      logWarn('Invalid message received from webview');
      return;
    }

    const msg = message as UiToExtensionMessage;

    switch (msg.type) {
      case 'ui_ready':
        // Send TTS settings first, then study mode, then next card
        await this._sendTtsSettings();
        await this._sendStudyMode();
        await this._sendNextCard();
        break;

      case 'get_next_card':
      case 'next':
        await this._sendNextCard();
        break;

      case 'rate_card':
        await this._handleRateCard(msg.cardId, msg.rating);
        break;

      case 'reveal_back':
        // Just acknowledge - UI handles the flip
        break;

      case 'get_tts_settings':
        await this._sendTtsSettings();
        break;

      case 'open_settings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'wordslash.tts');
        break;

      case 'get_study_mode':
        await this._sendStudyMode();
        break;

      case 'set_study_mode':
        await this._handleSetStudyMode(msg.mode);
        break;

      case 'refresh': {
        logDebug('Refresh requested');
        // Clear cache and reload from storage
        this._cachedIndex = null;
        this._recentCards = clearRecentCards(this._recentCards);
        const currentCardId = this._currentCard?.id;
        this._currentCard = null;
        
        // Try to reload the same card if it still exists, otherwise get next
        if (currentCardId) {
          logDebug('Reloading current card', currentCardId);
          const index = await this._getOrBuildIndex();
          
          // Get the latest version of the card from the index
          const reloadedCard = index.cards.get(currentCardId);
          
          if (reloadedCard) {
            logDebug('Card found, reloading', reloadedCard.front.term);
            this._currentCard = reloadedCard;
            const srs = index.srsStates.get(reloadedCard.id);
            this._postMessage({ type: 'card', card: reloadedCard, srs });
          } else {
            logDebug('Card not found or deleted, getting next');
            // Card was deleted, get next one
            await this._sendNextCard();
          }
        } else {
          logDebug('No current card, getting next');
          await this._sendNextCard();
        }
        break;
      }
    }
  }

  private async _sendTtsSettings() {
    const config = vscode.workspace.getConfiguration('wordslash.tts');
    const settings = mergeTtsSettings({
      engine: config.get('engine', 'youdao'),
      rate: config.get('rate', 1.0),
      autoPlay: config.get('autoPlay', true),
      azureKey: config.get('azureKey', ''),
      azureRegion: config.get('azureRegion', 'eastus'),
      openaiKey: config.get('openaiKey', ''),
    });
    this._postMessage({
      type: 'tts_settings',
      settings,
    });
  }

  private async _sendStudyMode() {
    this._postMessage({
      type: 'study_mode',
      mode: this._studyMode,
    });
  }

  private async _handleSetStudyMode(mode: StudyMode) {
    this._studyMode = mode;
    // Save to globalState for persistence within session
    await this._context.globalState.update(STUDY_MODE_KEY, mode);
    logDebug('Study mode changed to', mode);
    
    // Reset session stats when mode changes
    this._session = resetSessionState(this._session);
    
    // Send confirmation back to UI
    await this._sendStudyMode();
    
    // Get next card with new mode settings
    await this._sendNextCard();
  }

  /**
   * Get cached index or rebuild if necessary
   */
  private async _getOrBuildIndex(): Promise<CardIndex> {
    if (this._cachedIndex) {
      logDebug('Using cached index');
      return this._cachedIndex;
    }

    logDebug('Building new index');
    const cards = await this._storage.readAllCards();
    const events = await this._storage.readAllEvents();
    const index = buildIndex(cards, events);
    this._cachedIndex = index;
    return index;
  }

  /**
   * Invalidate the cached index (call after data changes)
   */
  private _invalidateCache() {
    this._cachedIndex = null;
    this._indexVersion++;
    logDebug('Cache invalidated', this._indexVersion);
  }

  private async _sendNextCard() {
    try {
      const index = await this._getOrBuildIndex();
      const now = Date.now();

      logDebug('Cards loaded', index.cards.size);
      logDebug('Events processed');
      logDebug('Recent cards', this._recentCards.cardIds.length);
      logDebug('Study mode', this._studyMode);

      // Get scheduler options from study mode using extracted function
      const { loopMode, dueOnly } = getSchedulerOptionsFromMode(this._studyMode);

      // Use getNextCard with forgetting curve optimization
      // Pass recent cards to avoid immediate repetition
      const card = getNextCard(index, now, {
        loopMode,
        dueOnly,
        excludeCardId: this._currentCard?.id,
        recentCardIds: this._recentCards.cardIds,
      });

      logDebug('Next card selected', card?.id ?? 'none');

      // Track current card as recently seen
      if (this._currentCard) {
        this._recentCards = addToRecentCards(this._recentCards, this._currentCard.id);
      }

      this._currentCard = card;

      if (card) {
        const srs = index.srsStates.get(card.id);
        this._postMessage({ type: 'card', card, srs });
      } else {
        // Check if we should show session complete using extracted function
        if (shouldShowSessionComplete(this._studyMode, false, this._session.reviewCount)) {
          const stats = calculateSessionStats(this._session);
          this._postMessage({ type: 'session_complete', stats });
        } else {
          this._postMessage({
            type: 'empty',
            message: "📭 No cards yet! Select text and use 'Add to WordSlash' to create cards.",
          });
        }
      }
    } catch (error) {
      logError('Error loading next card', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
    }
  }

  private async _handleRateCard(cardId: string, rating: ReviewRating) {
    try {
      // Check if this was a new card (first review)
      const index = await this._getOrBuildIndex();
      const currentSrs = index.srsStates.get(cardId);
      const wasNewCard = isNewCard(currentSrs);
      
      // Update session statistics using extracted function
      this._session = updateSessionAfterRating(this._session, rating, wasNewCard);

      // Create and save review event
      const event = createReviewEvent({
        cardId,
        rating,
        mode: 'flashcard',
      });
      await this._storage.appendEvent(event);

      // Invalidate cache after data change
      this._invalidateCache();

      // Rebuild index and SRS state
      const newIndex = await this._getOrBuildIndex();

      // Get current SRS state and calculate next
      const newSrs = newIndex.srsStates.get(cardId);
      if (newSrs) {
        // Note: nextSrs calculation validates the SRS algorithm but index is already rebuilt
        calculateNextState(newSrs, rating, Date.now());
        // Save updated index
        await this._storage.atomicWriteJson('index.json', {
          version: 1,
          srsStates: Object.fromEntries(newIndex.srsStates),
          updatedAt: Date.now(),
        });
      }

      // Send next card
      await this._sendNextCard();
    } catch (error) {
      logError('Error handling card rating', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
    }
  }

  private _postMessage(message: ExtensionToUiMessage) {
    this._panel.webview.postMessage(message);
  }
}
