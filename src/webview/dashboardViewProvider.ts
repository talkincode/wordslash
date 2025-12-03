// Dashboard View Provider - Sidebar webview for quick access
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateDashboardStats } from '../storage/stats';
import { FlashcardPanel } from './panel';
import { DashboardPanel } from './dashboard';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'wordslash.dashboardView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storage: JsonlStorage
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
        case 'refresh':
          await this._sendStats();
          break;
        case 'startLearning':
          FlashcardPanel.createOrShow(this._extensionUri, this._storage);
          break;
        case 'openDashboard':
          DashboardPanel.createOrShow(this._extensionUri, this._storage);
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'wordslash');
          break;
      }
    });

    // Refresh when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendStats();
      }
    });
  }

  private async _sendStats() {
    if (!this._view) return;

    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      this._view.webview.postMessage({ type: 'stats', stats });
    } catch (error) {
      console.error('[WordSlash] Error loading stats:', error);
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>WordSlash</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      padding: 12px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-sideBar-border);
    }
    
    .header h2 {
      font-size: 1.3em;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 4px;
    }
    
    .header .tagline {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .stat-card {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 1.8em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      line-height: 1.2;
    }
    
    .stat-label {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    
    .stat-card.highlight {
      border-color: var(--vscode-textLink-foreground);
      background: linear-gradient(135deg, var(--vscode-input-background) 0%, rgba(0,122,204,0.15) 100%);
    }
    
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .btn:hover {
      opacity: 0.9;
    }
    
    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-icon {
      font-size: 1.1em;
    }
    
    .streak {
      text-align: center;
      margin: 12px 0;
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 6px;
    }
    
    .streak-value {
      font-size: 1.5em;
    }
    
    .streak-label {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    
    .quick-links {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-sideBar-border);
      display: flex;
      justify-content: center;
      gap: 16px;
    }
    
    .quick-link {
      font-size: 0.85em;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      cursor: pointer;
    }
    
    .quick-link:hover {
      text-decoration: underline;
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>📚 WordSlash</h2>
    <div class="tagline">Vocabulary Learning</div>
  </div>
  
  <div id="loading" class="loading">Loading...</div>
  
  <div id="content" style="display: none;">
    <div class="stats-grid">
      <div class="stat-card highlight">
        <div class="stat-value" id="dueCards">0</div>
        <div class="stat-label">Due Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="newCards">0</div>
        <div class="stat-label">New</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="totalCards">0</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="masteredCards">0</div>
        <div class="stat-label">Mastered</div>
      </div>
    </div>
    
    <div class="streak">
      <span class="streak-value">🔥 <span id="streak">0</span></span>
      <div class="streak-label">Day Streak</div>
    </div>
    
    <div class="actions">
      <button class="btn btn-primary" onclick="startLearning()">
        <span class="btn-icon">🎴</span> Start Learning
      </button>
      <button class="btn btn-secondary" onclick="openDashboard()">
        <span class="btn-icon">📊</span> Full Dashboard
      </button>
    </div>
    
    <div class="quick-links">
      <a class="quick-link" onclick="openSettings()">⚙️ Settings</a>
      <a class="quick-link" onclick="refresh()">🔄 Refresh</a>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    // Send ready message
    vscode.postMessage({ type: 'ready' });
    
    // Listen for messages
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.type === 'stats') {
        showStats(message.stats);
      }
    });
    
    function showStats(stats) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      
      document.getElementById('dueCards').textContent = stats.dueCards;
      document.getElementById('newCards').textContent = stats.newCards;
      document.getElementById('totalCards').textContent = stats.totalCards;
      document.getElementById('masteredCards').textContent = stats.masteredCards;
      document.getElementById('streak').textContent = stats.currentStreak;
    }
    
    function startLearning() {
      vscode.postMessage({ type: 'startLearning' });
    }
    
    function openDashboard() {
      vscode.postMessage({ type: 'openDashboard' });
    }
    
    function openSettings() {
      vscode.postMessage({ type: 'openSettings' });
    }
    
    function refresh() {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('content').style.display = 'none';
      vscode.postMessage({ type: 'refresh' });
    }
  </script>
</body>
</html>`;
  }
}
