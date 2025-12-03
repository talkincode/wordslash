// Webview panel - Webview creation + message router
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex, getDueCards, getNewCards } from '../storage/indexer';
import { calculateNextState } from '../srs/sm2';
import { createReviewEvent, type Card, type ReviewRating } from '../storage/schema';
import {
  isValidUiMessage,
  type ExtensionToUiMessage,
  type UiToExtensionMessage,
} from './protocol';

export class FlashcardPanel {
  public static currentPanel: FlashcardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private _disposables: vscode.Disposable[] = [];
  private _currentCard: Card | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    storage: JsonlStorage
  ) {
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
    }
  }

  private async _sendNextCard() {
    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      
      console.log('[WordSlash] Cards loaded:', cards.length);
      console.log('[WordSlash] Events loaded:', events.length);
      
      const index = buildIndex(cards, events);

      const now = Date.now();

      // Priority: due cards first, then new cards
      const dueCards = getDueCards(index, now);
      const newCards = getNewCards(index);
      
      console.log('[WordSlash] Due cards:', dueCards.length);
      console.log('[WordSlash] New cards:', newCards.length);

      let card: Card | null = null;
      let srs = undefined;

      if (dueCards.length > 0) {
        card = dueCards[0];
        srs = index.srsStates.get(card.id);
      } else if (newCards.length > 0) {
        card = newCards[0];
        srs = index.srsStates.get(card.id);
      }

      this._currentCard = card;

      if (card) {
        this._postMessage({ type: 'card', card, srs });
      } else {
        this._postMessage({
          type: 'empty',
          message: "🎉 All done for today! You've reviewed all due cards.",
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
      padding: 60px;
    }
    
    .card {
      background-color: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 16px;
      padding: 64px 72px;
      max-width: 900px;
      width: 100%;
      text-align: center;
    }
    
    .term-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 12px;
    }
    
    .term {
      font-size: 4.5em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      letter-spacing: 0.02em;
    }
    
    .btn-speak {
      background: transparent;
      border: 2px solid var(--vscode-textLink-foreground);
      color: var(--vscode-textLink-foreground);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
    }
    
    .btn-speak:hover {
      background: var(--vscode-textLink-foreground);
      color: var(--vscode-editor-background);
    }
    
    .phonetic {
      font-size: 1.8em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 32px;
      font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;
    }
    
    .example {
      font-size: 1.8em;
      line-height: 1.7;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      margin-bottom: 40px;
      padding: 24px 28px;
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 8px;
    }
    
    .back-content {
      margin-top: 40px;
      padding-top: 40px;
      border-top: 2px solid var(--vscode-input-border);
    }
    
    .translation {
      font-size: 2.8em;
      margin-bottom: 24px;
      font-weight: 600;
    }
    
    .explanation {
      font-size: 1.6em;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
    }
    
    .buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 48px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 18px 40px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 22px;
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
      padding: 20px 60px;
      font-size: 24px;
    }
    
    .empty-state {
      text-align: center;
      padding: 80px;
    }
    
    .empty-state h2 {
      font-size: 5em;
      margin-bottom: 32px;
    }
    
    .empty-state p {
      font-size: 2em;
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
  <div id="app">
    <div class="card" id="card-view">
      <div class="term-container">
        <div class="term" id="term"></div>
        <button class="btn-speak" onclick="speak()" title="Pronounce">🔊</button>
      </div>
      <div class="phonetic" id="phonetic"></div>
      <div class="example" id="example"></div>
      
      <div id="front-buttons" class="buttons">
        <button class="btn-reveal" onclick="revealBack()">Show Answer</button>
      </div>
      
      <div id="back-content" class="back-content hidden">
        <div class="translation" id="translation"></div>
        <div class="explanation" id="explanation"></div>
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
    
    // Send ready message
    vscode.postMessage({ type: 'ui_ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
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
      document.getElementById('example').textContent = card.front.example || '';
      document.getElementById('example').classList.toggle('hidden', !card.front.example);
      
      // Prepare back
      const back = card.back || {};
      document.getElementById('translation').textContent = back.translation || '(no translation)';
      document.getElementById('explanation').textContent = back.explanation || '';
      document.getElementById('explanation').classList.toggle('hidden', !back.explanation);
      
      // Reset to front view
      document.getElementById('front-buttons').classList.remove('hidden');
      document.getElementById('back-content').classList.add('hidden');
      document.getElementById('back-buttons').classList.add('hidden');
      
      // Auto-pronounce when card appears
      speak();
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
    
    function speak() {
      if (!currentCard) return;
      
      const term = currentCard.front.term;
      const utterance = new SpeechSynthesisUtterance(term);
      
      // Use the best voice we found
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.lang = 'en-US';
      utterance.rate = 0.85;   // Slightly slower for clarity
      utterance.pitch = 1.0;   // Normal pitch
      
      speechSynthesis.cancel(); // Stop any ongoing speech
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
  </script>
</body>
</html>`;
  }
}
