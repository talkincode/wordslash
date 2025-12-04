// Dashboard View Provider - Sidebar webview for quick access
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateDashboardStats } from '../storage/stats';
import { FlashcardPanel } from './panel';
import { DashboardPanel } from './dashboard';
import { logDebug, logError } from '../common/logger';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'wordslash.dashboardView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storage: JsonlStorage,
    private readonly _context: vscode.ExtensionContext
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
      logDebug('Received message from dashboard view', message.type);
      switch (message.type) {
        case 'ready':
          logDebug('Dashboard webview ready, sending stats');
          await this._sendStats();
          break;
        case 'refresh':
          await this._sendStats();
          break;
        case 'startLearning':
          FlashcardPanel.createOrShow(this._extensionUri, this._storage, this._context);
          break;
        case 'openDashboard':
          DashboardPanel.createOrShow(this._extensionUri, this._storage);
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'wordslash');
          break;
        case 'exportBackup':
          vscode.commands.executeCommand('wordslash.exportBackup');
          break;
        case 'importBackup':
          vscode.commands.executeCommand('wordslash.importBackup');
          break;
        case 'importCards':
          vscode.commands.executeCommand('wordslash.importBulk');
          break;
        case 'exportTemplate':
          vscode.commands.executeCommand('wordslash.exportTemplate');
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
    if (!this._view) {
      logDebug('No dashboard view available');
      return;
    }

    try {
      logDebug('Loading dashboard stats');
      const cards = await this._storage.readAllCards();
      logDebug('Cards loaded', cards.length);
      
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);

      // Send stats including retention rate for gauge
      this._view.webview.postMessage({ 
        type: 'stats', 
        stats: {
          ...stats,
          retentionRate: stats.retentionRate || 0
        }
      });
    } catch (error) {
      logError('Error loading dashboard stats', error);
      // Send empty stats on error so UI doesn't hang
      this._view.webview.postMessage({ 
        type: 'stats', 
        stats: {
          dueCards: 0,
          newCards: 0,
          totalCards: 0,
          masteredCards: 0,
          currentStreak: 0,
          totalReviews: 0,
        }
      });
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src blob: https://dict.youdao.com https://translate.google.com; connect-src https://*.tts.speech.microsoft.com;">
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
    
    .retention-gauge-container {
      margin: 12px 0;
      padding: 16px;
      background: var(--vscode-input-background);
      border-radius: 8px;
      text-align: center;
    }
    
    .retention-gauge-title {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    .gauge-wrapper {
      position: relative;
      width: 160px;
      height: 100px;
      margin: 0 auto 8px;
    }
    
    .gauge-svg {
      width: 100%;
      height: 100%;
    }
    
    .gauge-background {
      fill: none;
      stroke: var(--vscode-input-border);
      stroke-width: 12;
      stroke-linecap: round;
    }
    
    .gauge-fill {
      fill: none;
      stroke-width: 12;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s ease-out, stroke 0.3s ease;
    }
    
    .gauge-needle {
      transition: transform 1s ease-out;
      transform-origin: 80px 80px;
    }
    
    .gauge-center {
      fill: var(--vscode-editor-background);
      stroke: var(--vscode-input-border);
      stroke-width: 2;
    }
    
    .gauge-value {
      font-size: 1.8em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      margin: 4px 0;
    }
    
    .gauge-label {
      font-size: 0.75em;
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
    
    .backup-links {
      margin-top: 8px;
      display: flex;
      justify-content: center;
      gap: 16px;
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
    
    <div class="retention-gauge-container">
      <div class="retention-gauge-title">Retention Rate</div>
      <div class="gauge-wrapper">
        <svg class="gauge-svg" viewBox="0 0 160 100">
          <!-- Background arc -->
          <path id="gauge-bg" class="gauge-background" 
                d="M 20 80 A 60 60 0 0 1 140 80" />
          <!-- Colored arc (will be updated based on retention rate) -->
          <path id="gauge-fill" class="gauge-fill"
                d="M 20 80 A 60 60 0 0 1 140 80"
                stroke-dasharray="188.5"
                stroke-dashoffset="188.5" />
          <!-- Needle -->
          <g id="gauge-needle" class="gauge-needle">
            <line x1="80" y1="80" x2="80" y2="30" 
                  stroke="var(--vscode-editor-foreground)" 
                  stroke-width="2.5" 
                  stroke-linecap="round" />
          </g>
          <!-- Center dot -->
          <circle class="gauge-center" cx="80" cy="80" r="6" />
        </svg>
      </div>
      <div class="gauge-value" id="retentionRate">0%</div>
      <div class="gauge-label">Good/Easy Reviews</div>
    </div>
    
    <div class="actions">
      <button class="btn btn-primary" onclick="startLearning()">
        <span class="btn-icon">🎴</span> Start Learning
      </button>
      <button class="btn btn-secondary" onclick="openDashboard()">
        <span class="btn-icon">📊</span> Full Dashboard
      </button>
      <button class="btn btn-secondary" onclick="importCards()">
        <span class="btn-icon">📋</span> Import Cards
      </button>
    </div>
    
    <div class="quick-links">
      <a class="quick-link" onclick="openSettings()">⚙️ Settings</a>
      <a class="quick-link" onclick="refresh()">🔄 Refresh</a>
    </div>
    
    <div class="backup-links">
      <a class="quick-link" onclick="exportBackup()">📤 Export Backup</a>
      <a class="quick-link" onclick="importBackup()">📥 Import Backup</a>
      <a class="quick-link" onclick="exportTemplate()">📄 Export Template</a>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    // Add timeout fallback in case stats never arrive
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading && loading.style.display !== 'none') {
        // Timeout - show empty state
        showStats({
          dueCards: 0,
          newCards: 0,
          totalCards: 0,
          masteredCards: 0,
          currentStreak: 0
        });
      }
    }, 3000);
    
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
      
      document.getElementById('dueCards').textContent = stats.dueCards || 0;
      document.getElementById('newCards').textContent = stats.newCards || 0;
      document.getElementById('totalCards').textContent = stats.totalCards || 0;
      document.getElementById('masteredCards').textContent = stats.masteredCards || 0;
      document.getElementById('streak').textContent = stats.currentStreak || 0;
      
      // Update retention rate gauge
      updateRetentionGauge(stats.retentionRate || 0);
    }
    
    function updateRetentionGauge(rate) {
      // Rate is 0-1, convert to percentage
      const percentage = Math.round(rate * 100);
      document.getElementById('retentionRate').textContent = percentage + '%';
      
      // Calculate arc fill (arc length is ~188.5)
      const arcLength = 188.5;
      const fillOffset = arcLength * (1 - rate);
      const fillArc = document.getElementById('gauge-fill');
      fillArc.style.strokeDashoffset = fillOffset;
      
      // Color based on retention rate
      let color;
      if (rate >= 0.9) {
        color = '#4caf50'; // Green - Excellent
      } else if (rate >= 0.8) {
        color = '#8bc34a'; // Light Green - Good
      } else if (rate >= 0.7) {
        color = '#ffc107'; // Yellow - Fair
      } else if (rate >= 0.6) {
        color = '#ff9800'; // Orange - Needs Improvement
      } else {
        color = '#f44336'; // Red - Poor
      }
      fillArc.style.stroke = color;
      
      // Update needle rotation (0% = -90deg, 100% = 90deg)
      const needleAngle = -90 + (rate * 180);
      const needle = document.getElementById('gauge-needle');
      needle.style.transform = 'rotate(' + needleAngle + 'deg)';
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
    
    function exportBackup() {
      vscode.postMessage({ type: 'exportBackup' });
    }
    
    function importBackup() {
      vscode.postMessage({ type: 'importBackup' });
    }
    
    function importCards() {
      vscode.postMessage({ type: 'importCards' });
    }
    
    function exportTemplate() {
      vscode.postMessage({ type: 'exportTemplate' });
    }
  </script>
</body>
</html>`;
  }
}
