// Webview panel - Webview creation + message router
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateNextState } from '../srs/sm2';
import { getNextCard } from '../srs/scheduler';
import { createReviewEvent, type Card, type ReviewRating } from '../storage/schema';
import { isValidUiMessage, type ExtensionToUiMessage, type UiToExtensionMessage } from './protocol';

export class FlashcardPanel {
  public static currentPanel: FlashcardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private _disposables: vscode.Disposable[] = [];
  private _currentCard: Card | null = null;
  private _recentCardIds: string[] = []; // Track recently reviewed cards
  private static readonly MAX_RECENT_CARDS = 5; // Keep last 5 cards in memory

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
      console.warn('Invalid message received:', message);
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

      case 'refresh':
        // Clear recent cards cache and reload
        this._recentCardIds = [];
        this._currentCard = null;
        await this._sendNextCard();
        break;
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
    if (this._recentCardIds.length > FlashcardPanel.MAX_RECENT_CARDS) {
      this._recentCardIds = this._recentCardIds.slice(0, FlashcardPanel.MAX_RECENT_CARDS);
    }
  }

  private async _sendNextCard() {
    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();

      console.log('[WordSlash] Cards loaded:', cards.length);
      console.log('[WordSlash] Events loaded:', events.length);
      console.log('[WordSlash] Recent cards:', this._recentCardIds);

      const index = buildIndex(cards, events);
      const now = Date.now();

      // Use getNextCard with forgetting curve optimization
      // Pass recent cards to avoid immediate repetition
      const card = getNextCard(index, now, {
        loopMode: true,
        excludeCardId: this._currentCard?.id,
        recentCardIds: this._recentCardIds,
      });

      console.log('[WordSlash] Next card:', card?.id ?? 'none');

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
      console.error('[WordSlash] Error:', error);
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

      // Update index and SRS state
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);

      // Get current SRS state and calculate next
      const currentSrs = index.srsStates.get(cardId);
      if (currentSrs) {
        const nextSrs = calculateNextState(currentSrs, rating, Date.now());
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src https://dict.youdao.com https://translate.google.com;">
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
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .term {
      font-size: 3.2em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      letter-spacing: 0.02em;
      font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
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
    
    .phonetic {
      font-size: 1.3em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
      font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;
    }
    
    .morphemes {
      font-size: 1.1em;
      color: var(--vscode-textLink-foreground);
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
      font-weight: 600;
    }
    
    .example-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 12px;
      padding: 20px 24px;
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 8px;
    }
    
    .example {
      font-size: 1.6em;
      line-height: 1.7;
      color: var(--vscode-editor-foreground);
      font-style: italic;
    }
    
    .example-cn {
      font-size: 1.4em;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
      padding: 10px 24px;
    }
    
    .back-content {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 2px solid var(--vscode-input-border);
    }
    
    .back-content .morphemes {
      font-size: 1em;
      margin-bottom: 12px;
    }
    
    .translation {
      font-size: 2.2em;
      margin-bottom: 16px;
      font-weight: 600;
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
        <button class="btn-speak" onclick="speakTerm()" title="Pronounce term">🔊</button>
      </div>
      <div class="phonetic" id="phonetic"></div>
      <div class="morphemes" id="morphemes"></div>
      <div class="example-container" id="example-container">
        <div class="example" id="example"></div>
        <button class="btn-speak btn-speak-small" onclick="speakExample()" title="Pronounce example">🔊</button>
      </div>
      
      <div id="front-buttons" class="buttons">
        <button class="btn-reveal" onclick="revealBack()">Show Answer</button>
      </div>
      
      <div id="back-content" class="back-content hidden">
        <div class="morphemes" id="morphemes-back"></div>
        <div class="translation" id="translation"></div>
        <div class="example-cn" id="example-cn"></div>
        <div class="explanation" id="explanation"></div>
        <div class="explanation-cn" id="explanation-cn"></div>
        <div class="synonyms" id="synonyms"></div>
        <div class="antonyms" id="antonyms"></div>
      </div>
      
      <div id="back-buttons" class="buttons hidden">
        <button class="btn-again" onclick="rate('again')">Again</button>
        <button class="btn-hard" onclick="rate('hard')">Hard</button>
        <button class="btn-good" onclick="rate('good')">Good</button>
        <button class="btn-easy" onclick="rate('easy')">Easy</button>
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
      
      switch (message.type) {
        case 'tts_settings':
          ttsSettings = message.settings;
          console.log('[WordSlash] TTS settings:', ttsSettings);
          break;
        case 'card':
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
      document.getElementById('phonetic').textContent = card.front.phonetic || '';
      document.getElementById('phonetic').classList.toggle('hidden', !card.front.phonetic);
      
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
      
      // Show morphemes on back
      const morphemesBackEl = document.getElementById('morphemes-back');
      if (card.front.morphemes && card.front.morphemes.length > 0) {
        morphemesBackEl.innerHTML = card.front.morphemes
          .map(m => '<span class="morpheme">' + m + '</span>')
          .join('<span class="separator">+</span>');
        morphemesBackEl.classList.remove('hidden');
      } else {
        morphemesBackEl.classList.add('hidden');
      }
      
      document.getElementById('translation').textContent = back.translation || '(no translation)';
      
      // Example Chinese goes to back
      document.getElementById('example-cn').textContent = card.front.exampleCn || '';
      document.getElementById('example-cn').classList.toggle('hidden', !card.front.exampleCn);
      
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
      document.getElementById('back-buttons').classList.add('hidden');
      
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
      
      // For premium engines (azure, openai) - TODO: implement
      if (engine === 'azure' || engine === 'openai') {
        console.log('[WordSlash] Premium TTS not yet implemented, using browser TTS');
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
      document.getElementById('back-buttons').classList.remove('hidden');
      
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
