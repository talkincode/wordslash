// Webview panel - Webview creation + message router
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateNextState } from '../srs/sm2';
import { getNextCard } from '../srs/scheduler';
import { createReviewEvent, type Card, type ReviewRating, type CardIndex } from '../storage/schema';
import { isValidUiMessage, type ExtensionToUiMessage, type UiToExtensionMessage } from './protocol';
import { logDebug, logError, logWarn } from '../common/logger';
import { MAX_RECENT_CARDS } from '../common/constants';

export class FlashcardPanel {
  public static currentPanel: FlashcardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private _disposables: vscode.Disposable[] = [];
  private _currentCard: Card | null = null;
  private _recentCardIds: string[] = []; // Track recently reviewed cards
  
  // Cache index to avoid rebuilding on every card request
  private _cachedIndex: CardIndex | null = null;
  private _indexVersion: number = 0; // Increment on data changes

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, storage: JsonlStorage) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._storage = storage;

    // Set the webview content
    this._panel.webview.html = this._getWebviewContent();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, storage: JsonlStorage) {
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

    FlashcardPanel.currentPanel = new FlashcardPanel(panel, extensionUri, storage);
  }

  public dispose() {
    FlashcardPanel.currentPanel = undefined;

    // Clear cache
    this._cachedIndex = null;
    this._currentCard = null;
    this._recentCardIds = [];

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
        // Send TTS settings first, then next card
        await this._sendTtsSettings();
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

      case 'refresh': {
        logDebug('Refresh requested');
        // Clear cache and reload from storage
        this._cachedIndex = null;
        this._recentCardIds = [];
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
    this._postMessage({
      type: 'tts_settings',
      settings: {
        engine: config.get('engine', 'youdao'),
        rate: config.get('rate', 1.0),
        autoPlay: config.get('autoPlay', true),
        azureKey: config.get('azureKey', ''),
        azureRegion: config.get('azureRegion', 'eastus'),
        openaiKey: config.get('openaiKey', ''),
      },
    });
  }

  private _addToRecentCards(cardId: string) {
    // Remove if already in list
    this._recentCardIds = this._recentCardIds.filter((id) => id !== cardId);
    // Add to front
    this._recentCardIds.unshift(cardId);
    // Keep only last N cards
    if (this._recentCardIds.length > MAX_RECENT_CARDS) {
      this._recentCardIds = this._recentCardIds.slice(0, MAX_RECENT_CARDS);
    }
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
      logDebug('Recent cards', this._recentCardIds.length);

      // Use getNextCard with forgetting curve optimization
      // Pass recent cards to avoid immediate repetition
      const card = getNextCard(index, now, {
        loopMode: true,
        excludeCardId: this._currentCard?.id,
        recentCardIds: this._recentCardIds,
      });

      logDebug('Next card selected', card?.id ?? 'none');

      // Track current card as recently seen
      if (this._currentCard) {
        this._addToRecentCards(this._currentCard.id);
      }

      this._currentCard = card;

      if (card) {
        const srs = index.srsStates.get(card.id);
        this._postMessage({ type: 'card', card, srs });
      } else {
        this._postMessage({
          type: 'empty',
          message: "📭 No cards yet! Select text and use 'Add to WordSlash' to create cards.",
        });
      }
    } catch (error) {
      logError('Error loading next card', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
    }
  }

  private async _handleRateCard(cardId: string, rating: ReviewRating) {
    try {
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
      const index = await this._getOrBuildIndex();

      // Get current SRS state and calculate next
      const currentSrs = index.srsStates.get(cardId);
      if (currentSrs) {
        // Note: nextSrs calculation validates the SRS algorithm but index is already rebuilt
        calculateNextState(currentSrs, rating, Date.now());
        // Save updated index
        await this._storage.atomicWriteJson('index.json', {
          version: 1,
          srsStates: Object.fromEntries(index.srsStates),
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

  private _getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src blob: https://dict.youdao.com https://translate.google.com; connect-src https://*.tts.speech.microsoft.com;">
  <title>WordSlash Flashcards</title>
  <style>
    :root {
      --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', sans-serif);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    
    .card {
      background-color: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 40px 60px;
      max-width: 1000px;
      width: 100%;
      text-align: center;
    }
    
    .term-container {
      margin-bottom: 16px;
    }
    
    .term {
      font-size: 2.5em;
      font-weight: 500;
      color: var(--vscode-textLink-foreground);
      letter-spacing: 0.04em;
      font-family: var(--vscode-editor-font-family), Monaco, 'SF Mono',  'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    }
    
    .btn-speak {
      background: transparent;
      border: 3px solid var(--vscode-textLink-foreground);
      color: var(--vscode-textLink-foreground);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
      flex-shrink: 0;
    }
    
    .btn-speak:hover {
      background: rgba(0, 122, 204, 0.15);
      transform: scale(1.08);
    }
    
    .btn-speak-small {
      width: 36px;
      height: 36px;
      font-size: 16px;
      border-width: 2px;
    }
    
    .phonetic-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .phonetic {
      font-size: 1.3em;
      color: var(--vscode-descriptionForeground);
      font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;
    }
    
    .morphemes {
      font-size: 2.1em;
      color: #00d4ff;
      font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      margin-top: 8px;
      margin-bottom: 16px;
      letter-spacing: 0.05em;
    }
    
    .morphemes .separator {
      color: var(--vscode-descriptionForeground);
      margin: 0 6px;
      font-weight: normal;
    }
    
    .morphemes .morpheme {
      font-weight: 500;
    }
    
    .example-container {
      margin-top: 9px;
      margin-bottom: 12px;
      padding: 20px 24px;
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 8px;
    }
    
    .example-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    
    .example {
      font-size: 1.6em;
      line-height: 1.7;
      color: var(--vscode-editor-foreground);
      font-style: italic;
    }
    
    .example-cn {
      font-size: 1.1em;
      line-height: 1.5;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      text-align: center;
      opacity: 0.9;
    }
    
    .back-content {
      margin-top: 24px;
    }
    
    .translation {
      font-size: 1.8em;
      margin-bottom: 7px;
      ont-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-weight: 500;
    }
    
    .explanation {
      font-size: 1.3em;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }
    
    .explanation-cn {
      font-size: 1.2em;
      line-height: 1.5;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      margin-bottom: 16px;
    }
    
    .synonyms, .antonyms {
      font-size: 0.95em;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
    
    .synonyms span, .antonyms span {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 4px;
      margin: 2px 4px;
      font-size: 0.9em;
    }
    
    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 10px 24px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    
    button:hover {
      opacity: 0.85;
    }
    
    .btn-again {
      background-color: #d32f2f;
      color: white;
    }
    
    .btn-hard {
      background-color: #f57c00;
      color: white;
    }
    
    .btn-good {
      background-color: #388e3c;
      color: white;
    }
    
    .btn-easy {
      background-color: #1976d2;
      color: white;
    }
    
    .btn-reveal {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 12px 36px;
      font-size: 15px;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
    }
    
    .empty-state h2 {
      font-size: 3em;
      margin-bottom: 16px;
    }
    
    .empty-state p {
      font-size: 1.2em;
    }
    
    .toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
    }
    
    .btn-toolbar {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .btn-toolbar:hover {
      opacity: 0.8;
    }
    
    .hidden {
      display: none;
    }
    
    .context-info {
      font-size: 1.2em;
      color: var(--vscode-descriptionForeground);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-toolbar" onclick="refresh()" title="Refresh data">🔄 Refresh</button>
    <button class="btn-toolbar" onclick="openSettings()" title="Settings">⚙️</button>
  </div>
  
  <div id="app">
    <div class="card" id="card-view">
      <div class="term-container">
        <div class="term" id="term"></div>
      </div>
      <div class="phonetic-container" id="phonetic-container">
        <div class="phonetic" id="phonetic"></div>
        <button class="btn-speak btn-speak-small" onclick="speakTerm()" title="Pronounce term">🔊</button>
      </div>
      <div class="morphemes" id="morphemes"></div>
      
      <div id="front-buttons" class="buttons">
        <button class="btn-reveal" onclick="revealBack()">Show Answer</button>
      </div>
      
      <div id="back-content" class="back-content hidden">
        <div class="translation" id="translation"></div>
        <div id="back-buttons" class="buttons">
          <button class="btn-again" onclick="rate('again')">Again</button>
          <button class="btn-hard" onclick="rate('hard')">Hard</button>
          <button class="btn-good" onclick="rate('good')">Good</button>
          <button class="btn-easy" onclick="rate('easy')">Easy</button>
        </div>
      </div>
      
      <div class="example-container" id="example-container">
        <div class="example-header">
          <div class="example" id="example"></div>
          <button class="btn-speak btn-speak-small" onclick="speakExample()" title="Pronounce term">🔊</button>
        </div>
        <div class="example-cn" id="example-cn"></div>
      </div>
      
      <div class="back-content-extra hidden">
        <div class="explanation" id="explanation"></div>
        <div class="explanation-cn" id="explanation-cn"></div>
        <div class="synonyms" id="synonyms"></div>
        <div class="antonyms" id="antonyms"></div>
      </div>
    </div>
    
    <div id="empty-view" class="empty-state hidden">
      <h2>🎉</h2>
      <p id="empty-message">All done for today!</p>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentCard = null;
    
    // TTS settings
    let ttsSettings = {
      engine: 'youdao',
      rate: 1.0,
      autoPlay: true
    };
    
    // Send ready message
    vscode.postMessage({ type: 'ui_ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('[WordSlash UI] Received message:', message.type);
      
      switch (message.type) {
        case 'tts_settings':
          ttsSettings = message.settings;
          console.log('[WordSlash] TTS settings:', ttsSettings);
          break;
        case 'card':
          console.log('[WordSlash UI] Displaying card:', message.card.front.term);
          showCard(message.card, message.srs);
          break;
        case 'empty':
          showEmpty(message.message);
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });
    
    function showCard(card, srs) {
      currentCard = card;
      
      document.getElementById('card-view').classList.remove('hidden');
      document.getElementById('empty-view').classList.add('hidden');
      
      // Show front
      document.getElementById('term').textContent = card.front.term;
      
      // Show phonetic with container
      const phoneticContainer = document.getElementById('phonetic-container');
      const phoneticEl = document.getElementById('phonetic');
      if (card.front.phonetic) {
        phoneticEl.textContent = card.front.phonetic;
        phoneticContainer.classList.remove('hidden');
      } else {
        phoneticContainer.classList.add('hidden');
      }
      
      // Show morphemes on front
      const morphemesEl = document.getElementById('morphemes');
      if (card.front.morphemes && card.front.morphemes.length > 0) {
        morphemesEl.innerHTML = card.front.morphemes
          .map(m => '<span class="morpheme">' + m + '</span>')
          .join('<span class="separator">+</span>');
        morphemesEl.classList.remove('hidden');
      } else {
        morphemesEl.classList.add('hidden');
      }
      
      // Handle example with speak button
      const exampleContainer = document.getElementById('example-container');
      const exampleEl = document.getElementById('example');
      if (card.front.example) {
        exampleEl.textContent = card.front.example;
        exampleContainer.classList.remove('hidden');
      } else {
        exampleContainer.classList.add('hidden');
      }
      
      // Prepare back (including example Chinese translation)
      const back = card.back || {};
      
      // Example Chinese - prepare but keep hidden until back is revealed
      const exampleCnEl = document.getElementById('example-cn');
      exampleCnEl.textContent = card.front.exampleCn || '';
      // Will be shown when back-content is revealed
      
      document.getElementById('translation').textContent = back.translation || '(no translation)';
      
      document.getElementById('explanation').textContent = back.explanation || '';
      document.getElementById('explanation').classList.toggle('hidden', !back.explanation);
      document.getElementById('explanation-cn').textContent = back.explanationCn || '';
      document.getElementById('explanation-cn').classList.toggle('hidden', !back.explanationCn);
      
      // Show synonyms
      const synonymsEl = document.getElementById('synonyms');
      if (back.synonyms && back.synonyms.length > 0) {
        synonymsEl.innerHTML = '同义词: ' + back.synonyms.map(s => '<span>' + s + '</span>').join('');
        synonymsEl.classList.remove('hidden');
      } else {
        synonymsEl.classList.add('hidden');
      }
      
      // Show antonyms
      const antonymsEl = document.getElementById('antonyms');
      if (back.antonyms && back.antonyms.length > 0) {
        antonymsEl.innerHTML = '反义词: ' + back.antonyms.map(s => '<span>' + s + '</span>').join('');
        antonymsEl.classList.remove('hidden');
      } else {
        antonymsEl.classList.add('hidden');
      }
      
      // Reset to front view
      document.getElementById('front-buttons').classList.remove('hidden');
      document.getElementById('back-content').classList.add('hidden');
      document.querySelector('.back-content-extra').classList.add('hidden');
      
      // Hide example Chinese translation on front
      exampleCnEl.classList.add('hidden');
      
      // Auto-pronounce when card appears (if enabled)
      if (ttsSettings.autoPlay) {
        speak();
      }
    }
    
    function showEmpty(message) {
      document.getElementById('card-view').classList.add('hidden');
      document.getElementById('empty-view').classList.remove('hidden');
      document.getElementById('empty-message').textContent = message;
    }
    
    function showError(message) {
      alert('Error: ' + message);
    }
    
    // Cache the best English voice
    let englishVoice = null;
    
    function findBestEnglishVoice() {
      const voices = speechSynthesis.getVoices();
      
      // Priority list of preferred voices (macOS has good ones)
      const preferredVoices = [
        'Samantha',      // macOS - natural US English
        'Alex',          // macOS - natural US English  
        'Daniel',        // macOS - British English
        'Karen',         // macOS - Australian English
        'Google US English',
        'Google UK English Female',
        'Microsoft Zira',
        'Microsoft David',
      ];
      
      // Try to find a preferred voice
      for (const name of preferredVoices) {
        const voice = voices.find(v => v.name.includes(name));
        if (voice) return voice;
      }
      
      // Fallback: find any en-US or en-GB voice
      const enVoice = voices.find(v => 
        v.lang.startsWith('en-') && !v.name.includes('Compact')
      );
      if (enVoice) return enVoice;
      
      // Last resort: any English voice
      return voices.find(v => v.lang.startsWith('en'));
    }
    
    // Initialize voice when available
    speechSynthesis.onvoiceschanged = () => {
      englishVoice = findBestEnglishVoice();
      console.log('[WordSlash] Selected voice:', englishVoice?.name);
    };
    
    // Try to get voice immediately (some browsers have it ready)
    englishVoice = findBestEnglishVoice();
    
    // Audio element for dictionary pronunciations
    let audioPlayer = null;
    
    /**
     * Get pronunciation audio URL based on engine setting
     */
    function getAudioUrl(word, engine) {
      const cleanWord = word.trim().toLowerCase();
      
      switch (engine) {
        case 'youdao':
          // Youdao dictionary - high quality human recordings
          return \`https://dict.youdao.com/dictvoice?audio=\${encodeURIComponent(cleanWord)}&type=2\`;
        
        case 'google':
          // Google Translate TTS
          return \`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=\${encodeURIComponent(cleanWord)}\`;
        
        default:
          return null; // Use browser TTS
      }
    }
    
    /**
     * Play pronunciation based on TTS settings
     */
    async function speakText(text) {
      if (!text) return;
      
      const engine = ttsSettings.engine;
      
      console.log('[WordSlash] Speaking with engine:', engine, 'text:', text);
      
      // For browser engine, use Web Speech API directly
      if (engine === 'browser') {
        speakWithTTS(text);
        return;
      }
      
      // For online engines (youdao, google)
      if (engine === 'youdao' || engine === 'google') {
        try {
          const audioUrl = getAudioUrl(text, engine);
          
          if (!audioPlayer) {
            audioPlayer = new Audio();
          }
          
          audioPlayer.src = audioUrl;
          audioPlayer.playbackRate = ttsSettings.rate;
          
          await audioPlayer.play();
          console.log('[WordSlash] Playing', engine, 'audio for:', text);
          return;
        } catch (error) {
          console.log('[WordSlash]', engine, 'audio failed, falling back to browser TTS:', error.message);
          speakWithTTS(text);
        }
        return;
      }
      
      // Azure TTS implementation
      if (engine === 'azure') {
        const azureKey = ttsSettings.azureKey;
        const azureRegion = ttsSettings.azureRegion || 'eastus';
        
        if (!azureKey) {
          console.log('[WordSlash] Azure key not configured, falling back to browser TTS');
          speakWithTTS(text);
          return;
        }
        
        let audioUrl = null;
        try {
          // Azure SSML rate: -50% to +100%, where 0% is normal speed
          // Convert our rate (0.5-2.0) to Azure format: rate 0.85 -> "-15%", rate 1.0 -> "0%"
          const rateValue = ttsSettings.rate || 0.85;
          const azureRate = Math.round((rateValue - 1.0) * 100);
          const rateStr = azureRate >= 0 ? \`+\${azureRate}%\` : \`\${azureRate}%\`;
          
          const ssml = \`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
            <voice name="en-US-JennyNeural">
              <prosody rate="\${rateStr}">
                \${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </prosody>
            </voice>
          </speak>\`;
          
          const response = await fetch(\`https://\${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1\`, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': azureKey,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
            },
            body: ssml
          });
          
          if (!response.ok) {
            throw new Error(\`Azure TTS failed: \${response.status} \${response.statusText}\`);
          }
          
          const audioBlob = await response.blob();
          audioUrl = URL.createObjectURL(audioBlob);
          
          if (!audioPlayer) {
            audioPlayer = new Audio();
          }
          
          audioPlayer.src = audioUrl;
          audioPlayer.playbackRate = 1.0; // Rate already applied via SSML prosody
          
          audioPlayer.onended = () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
          };
          
          await audioPlayer.play();
          console.log('[WordSlash] Playing Azure TTS for:', text);
          return;
        } catch (error) {
          // NotAllowedError means autoplay was blocked - this is expected, don't fallback
          if (error.name === 'NotAllowedError') {
            console.log('[WordSlash] Azure TTS autoplay blocked (user gesture required)');
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            return;
          }
          console.error('[WordSlash] Azure TTS error:', error);
          speakWithTTS(text);
          return;
        }
      }
      
      // OpenAI TTS - TODO: implement when needed
      if (engine === 'openai') {
        console.log('[WordSlash] OpenAI TTS not yet implemented, using browser TTS');
        speakWithTTS(text);
        return;
      }
      
      // Default fallback
      speakWithTTS(text);
    }
    
    function speak() {
      if (!currentCard) return;
      speakText(currentCard.front.term);
    }
    
    function speakTerm() {
      if (!currentCard) return;
      speakText(currentCard.front.term);
    }
    
    function speakExample() {
      if (!currentCard || !currentCard.front.example) return;
      speakText(currentCard.front.example);
    }
    
    /**
     * Use Web Speech API (browser built-in)
     */
    function speakWithTTS(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.lang = 'en-US';
      utterance.rate = ttsSettings.rate || 0.85;
      utterance.pitch = 1.0;
      
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
    
    function revealBack() {
      if (!currentCard) return;
      
      document.getElementById('front-buttons').classList.add('hidden');
      document.getElementById('back-content').classList.remove('hidden');
      document.querySelector('.back-content-extra').classList.remove('hidden');
      
      // Show example Chinese translation when revealing back
      const exampleCnEl = document.getElementById('example-cn');
      if (currentCard.front.exampleCn) {
        exampleCnEl.classList.remove('hidden');
      }
      
      // Auto-pronounce when revealing back (if enabled)
      if (ttsSettings.autoPlay) {
        speak();
      }
      
      vscode.postMessage({ type: 'reveal_back', cardId: currentCard.id });
    }
    
    function rate(rating) {
      if (!currentCard) return;
      
      vscode.postMessage({
        type: 'rate_card',
        cardId: currentCard.id,
        rating: rating,
        mode: 'flashcard'
      });
    }
    
    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }
    
    function openSettings() {
      vscode.postMessage({ type: 'open_settings' });
    }
  </script>
</body>
</html>`;
  }
}
