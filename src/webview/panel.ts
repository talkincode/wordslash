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
      const index = buildIndex(cards, events);

      const now = Date.now();

      // Priority: due cards first, then new cards
      const dueCards = getDueCards(index, now);
      const newCards = getNewCards(index);

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
      padding: 20px;
    }
    
    .card {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 32px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    
    .term {
      font-size: 2em;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-textLink-foreground);
    }
    
    .example {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      margin-bottom: 24px;
      padding: 12px;
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
    }
    
    .back-content {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--vscode-input-border);
    }
    
    .translation {
      font-size: 1.4em;
      margin-bottom: 12px;
    }
    
    .explanation {
      font-size: 0.95em;
      color: var(--vscode-descriptionForeground);
    }
    
    .buttons {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
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
      padding: 12px 32px;
      font-size: 16px;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
    }
    
    .empty-state h2 {
      margin-bottom: 16px;
    }
    
    .hidden {
      display: none;
    }
    
    .context-info {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="card" id="card-view">
      <div class="term" id="term"></div>
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
    }
    
    function showEmpty(message) {
      document.getElementById('card-view').classList.add('hidden');
      document.getElementById('empty-view').classList.remove('hidden');
      document.getElementById('empty-message').textContent = message;
    }
    
    function showError(message) {
      alert('Error: ' + message);
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
