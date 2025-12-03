// Dashboard panel - Main dashboard with stats and knowledge graph
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateDashboardStats, generateKnowledgeGraph } from '../storage/stats';
import { isValidUiMessage, type ExtensionToUiMessage, type UiToExtensionMessage } from './protocol';
import { FlashcardPanel } from './panel';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private _disposables: vscode.Disposable[] = [];

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
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'wordslashDashboard',
      'WordSlash Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, storage);
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;

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
        await this._sendTtsSettings();
        await this._sendDashboardStats();
        break;

      case 'get_dashboard_stats':
        await this._sendDashboardStats();
        break;

      case 'get_knowledge_graph':
        await this._sendKnowledgeGraph(msg);
        break;

      case 'get_card_details':
        await this._sendCardDetails(msg);
        break;

      case 'get_tts_settings':
        await this._sendTtsSettings();
        break;

      case 'start_flashcard_study':
        // Open flashcard panel
        FlashcardPanel.createOrShow(this._extensionUri, this._storage);
        break;

      case 'open_settings':
        // Open WordSlash settings
        vscode.commands.executeCommand('workbench.action.openSettings', 'wordslash');
        break;
    }
  }

  private async _sendDashboardStats() {
    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);
      const stats = calculateDashboardStats(index, events);
      this._postMessage({ type: 'dashboard_stats', stats });
    } catch (error) {
      console.error('[WordSlash] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
    }
  }

  private async _sendKnowledgeGraph(msg: UiToExtensionMessage & { type: 'get_knowledge_graph' }) {
    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);

      const graph = generateKnowledgeGraph(index, {
        maxNodes: msg.maxNodes,
        includeOrphans: msg.includeOrphans,
        filterTag: msg.filterTag,
      });

      this._postMessage({ type: 'knowledge_graph', graph });
    } catch (error) {
      console.error('[WordSlash] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
    }
  }

  private async _sendCardDetails(msg: UiToExtensionMessage & { type: 'get_card_details' }) {
    try {
      const cards = await this._storage.readAllCards();
      const events = await this._storage.readAllEvents();
      const index = buildIndex(cards, events);
      
      const card = index.cards.get(msg.cardId);
      if (!card) {
        this._postMessage({ type: 'error', message: 'Card not found' });
        return;
      }
      
      const srs = index.srsStates.get(msg.cardId);
      this._postMessage({ type: 'card_details', card, srs });
    } catch (error) {
      console.error('[WordSlash] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._postMessage({ type: 'error', message });
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
      }
    });
  }

  private _postMessage(message: ExtensionToUiMessage) {
    this._panel.webview.postMessage(message);
  }  private _getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>WordSlash Dashboard</title>
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
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-input-border);
    }
    
    .header h1 {
      font-size: 2em;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
    }
    
    .btn-study {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: opacity 0.2s;
    }
    
    .btn-study:hover {
      opacity: 0.9;
    }
    
    .btn-settings {
      background-color: transparent;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-input-border);
      padding: 12px 16px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    
    .btn-settings:hover {
      border-color: var(--vscode-textLink-foreground);
      color: var(--vscode-textLink-foreground);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    
    .stat-card {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 2.5em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      line-height: 1.2;
    }
    
    .stat-label {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    
    .stat-card.highlight {
      border-color: var(--vscode-textLink-foreground);
      background: linear-gradient(135deg, var(--vscode-input-background) 0%, rgba(0,122,204,0.1) 100%);
    }
    
    .sections {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    
    @media (max-width: 900px) {
      .sections {
        grid-template-columns: 1fr;
      }
    }
    
    .section {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 20px;
    }
    
    .section-title {
      font-size: 1.2em;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-textLink-foreground);
    }
    
    /* Chart styles */
    .chart-container {
      height: 200px;
      position: relative;
    }
    
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 100%;
      gap: 2px;
    }
    
    .bar {
      flex: 1;
      background-color: var(--vscode-textLink-foreground);
      border-radius: 2px 2px 0 0;
      min-height: 2px;
      transition: height 0.3s ease;
    }
    
    .bar:hover {
      opacity: 0.8;
    }
    
    /* Ratings distribution */
    .ratings-chart {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    
    .rating-item {
      text-align: center;
      flex: 1;
    }
    
    .rating-bar {
      height: 120px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
    }
    
    .rating-fill {
      width: 40px;
      border-radius: 4px 4px 0 0;
      transition: height 0.3s ease;
    }
    
    .rating-fill.again { background-color: #d32f2f; }
    .rating-fill.hard { background-color: #f57c00; }
    .rating-fill.good { background-color: #388e3c; }
    .rating-fill.easy { background-color: #1976d2; }
    
    .rating-label {
      font-size: 0.85em;
      margin-top: 8px;
      color: var(--vscode-descriptionForeground);
    }
    
    .rating-value {
      font-size: 1.1em;
      font-weight: 600;
    }
    
    /* Card types chart */
    .type-chart {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .type-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .type-label {
      width: 80px;
      font-size: 0.9em;
    }
    
    .type-bar-container {
      flex: 1;
      height: 24px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .type-bar-fill {
      height: 100%;
      background-color: var(--vscode-textLink-foreground);
      transition: width 0.3s ease;
    }
    
    .type-count {
      width: 50px;
      text-align: right;
      font-weight: 600;
    }
    
    /* Knowledge Graph */
    .graph-section {
      grid-column: 1 / -1;
    }
    
    .graph-container {
      height: 450px;
      position: relative;
      overflow: hidden;
      background: var(--vscode-editor-background);
      border-radius: 8px;
      cursor: grab;
    }
    
    .graph-container:active {
      cursor: grabbing;
    }
    
    .graph-canvas {
      width: 100%;
      height: 100%;
    }
    
    .graph-controls {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .graph-controls label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9em;
    }
    
    .graph-controls input[type="checkbox"] {
      accent-color: var(--vscode-textLink-foreground);
    }
    
    .graph-controls .zoom-controls {
      display: flex;
      gap: 4px;
      margin-left: auto;
    }
    
    .graph-controls .zoom-btn {
      width: 28px;
      height: 28px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .graph-controls .zoom-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .graph-tooltip {
      position: absolute;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 0.9em;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 250px;
    }
    
    .graph-tooltip .tooltip-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-textLink-foreground);
    }
    
    .graph-tooltip .tooltip-type {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    
    .graph-legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85em;
    }
    
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .legend-dot.card { background-color: #4fc3f7; }
    .legend-dot.synonym { background-color: #81c784; }
    .legend-dot.antonym { background-color: #e57373; }
    .legend-dot.tag { background-color: #ffb74d; }
    
    /* Card Details Modal */
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
    
    .modal.show {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-content {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      max-width: 700px;
      width: 90%;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: modalSlideIn 0.2s ease-out;
    }
    
    @keyframes modalSlideIn {
      from {
        transform: translateY(-50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--vscode-input-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-shrink: 0;
    }
    
    .modal-title-section {
      flex: 1;
    }
    
    .modal-term {
      font-size: 1.6em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    }
    
    .play-audio-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }
    
    .play-audio-btn:hover {
      opacity: 0.8;
    }
    
    .play-audio-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .modal-phonetic {
      font-size: 1.1em;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    
    .modal-close {
      background: transparent;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--vscode-descriptionForeground);
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    
    .modal-close:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    
    .modal-section {
      margin-bottom: 20px;
    }
    
    .modal-section:last-child {
      margin-bottom: 0;
    }
    
    .modal-section-title {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .modal-section-content {
      font-size: 1em;
      line-height: 1.5;
    }
    
    .modal-example {
      padding: 10px 12px;
      background: var(--vscode-input-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      border-radius: 4px;
      font-style: italic;
      margin-bottom: 6px;
    }
    
    .modal-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .modal-tag {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.9em;
    }
    
    .modal-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .modal-list-item {
      background: var(--vscode-input-background);
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--vscode-input-border);
    }
    
    .modal-srs-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    
    .modal-srs-item {
      text-align: center;
    }
    
    .modal-srs-label {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    
    .modal-srs-value {
      font-size: 1.3em;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state h2 {
      font-size: 3em;
      margin-bottom: 16px;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📚 WordSlash</h1>
    <div class="header-actions">
      <button class="btn-settings" onclick="openSettings()">
        <span>⚙️</span> Settings
      </button>
      <button class="btn-study" onclick="startStudy()">
        <span>🎴</span> Start Learning
      </button>
    </div>
  </div>
  
  <div id="loading" class="loading">Loading dashboard...</div>
  
  <div id="content" style="display: none;">
    <div class="stats-grid" id="stats-grid"></div>
    
    <div class="sections">
      <div class="section">
        <div class="section-title">📊 Review History (30 Days)</div>
        <div class="chart-container">
          <div class="bar-chart" id="reviews-chart"></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">🎯 Rating Distribution</div>
        <div class="ratings-chart" id="ratings-chart"></div>
      </div>
      
      <div class="section">
        <div class="section-title">📝 Card Types</div>
        <div class="type-chart" id="types-chart"></div>
      </div>
      
      <div class="section">
        <div class="section-title">📈 Learning Progress</div>
        <div id="progress-info"></div>
      </div>
      
      <div class="section graph-section">
        <div class="section-title">🕸️ Knowledge Graph</div>
        <div class="graph-controls">
          <label>
            <input type="checkbox" id="includeOrphans" onchange="refreshGraph()">
            Include unconnected cards
          </label>
          <label>
            Max nodes:
            <select id="maxNodes" onchange="refreshGraph()">
              <option value="50">50</option>
              <option value="100" selected>100</option>
              <option value="200">200</option>
            </select>
          </label>
          <div class="zoom-controls">
            <button class="zoom-btn" onclick="zoomGraph(0.8)" title="Zoom Out">−</button>
            <button class="zoom-btn" onclick="zoomGraph(1.25)" title="Zoom In">+</button>
            <button class="zoom-btn" onclick="resetGraphView()" title="Reset View">⟲</button>
          </div>
        </div>
        <div class="graph-container" id="graphContainer">
          <canvas id="graphCanvas" class="graph-canvas"></canvas>
          <div id="graphTooltip" class="graph-tooltip" style="display: none;"></div>
        </div>
        <div class="graph-legend">
          <div class="legend-item"><div class="legend-dot card"></div> Vocabulary</div>
          <div class="legend-item"><div class="legend-dot synonym"></div> Synonym</div>
          <div class="legend-item"><div class="legend-dot antonym"></div> Antonym</div>
          <div class="legend-item"><div class="legend-dot tag"></div> Tag</div>
          <span style="margin-left: auto; font-size: 0.85em; color: var(--vscode-descriptionForeground);">
            🖱️ Drag to pan · Scroll to zoom · Double-click node for details
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Card Details Modal -->
  <div id="cardModal" class="modal" onclick="closeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title-section">
          <div class="modal-term">
            <span id="modalTerm"></span>
            <button id="playAudioBtn" class="play-audio-btn" onclick="playAudio()" title="Play pronunciation">
              🔊
            </button>
          </div>
          <div class="modal-phonetic" id="modalPhonetic"></div>
        </div>
        <button class="modal-close" onclick="closeCardModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalBody">
        <!-- Content will be dynamically populated -->
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentStats = null;
    let currentGraph = null;
    let currentCard = null;
    let graphNodes = [];
    let graphEdges = [];
    let graphScale = 1;
    let graphOffsetX = 0;
    let graphOffsetY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let selectedNode = null;
    let draggingNode = null;
    let lastClickTime = 0;
    let lastClickedNode = null;
    
    // TTS settings
    let ttsSettings = {
      engine: 'youdao',
      rate: 1.0,
      autoPlay: true
    };
    
    // Audio player for online TTS
    let audioPlayer = null;
    
    // Send ready message
    vscode.postMessage({ type: 'ui_ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'tts_settings':
          ttsSettings = message.settings;
          console.log('[WordSlash Dashboard] TTS settings:', ttsSettings);
          break;
        case 'dashboard_stats':
          currentStats = message.stats;
          renderDashboard(message.stats);
          // Request knowledge graph after stats
          refreshGraph();
          break;
        case 'knowledge_graph':
          currentGraph = message.graph;
          renderKnowledgeGraph(message.graph);
          break;
        case 'card_details':
          currentCard = message.card;
          showCardDetails(message.card, message.srs);
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });
    
    function startStudy() {
      vscode.postMessage({ type: 'start_flashcard_study' });
    }
    
    function openSettings() {
      vscode.postMessage({ type: 'open_settings' });
    }
    
    function refreshGraph() {
      const maxNodes = parseInt(document.getElementById('maxNodes').value);
      const includeOrphans = document.getElementById('includeOrphans').checked;
      
      vscode.postMessage({
        type: 'get_knowledge_graph',
        maxNodes,
        includeOrphans
      });
    }
    
    function renderDashboard(stats) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      
      // Render stat cards
      const statsGrid = document.getElementById('stats-grid');
      statsGrid.innerHTML = \`
        <div class="stat-card highlight">
          <div class="stat-value">\${stats.dueCards}</div>
          <div class="stat-label">Due Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.totalCards}</div>
          <div class="stat-label">Total Cards</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.newCards}</div>
          <div class="stat-label">New Cards</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.learnedCards}</div>
          <div class="stat-label">Learned</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.masteredCards}</div>
          <div class="stat-label">Mastered</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.currentStreak}</div>
          <div class="stat-label">Day Streak 🔥</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${Math.round(stats.retentionRate * 100)}%</div>
          <div class="stat-label">Retention</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${stats.reviewsToday}</div>
          <div class="stat-label">Reviews Today</div>
        </div>
      \`;
      
      // Render reviews chart
      renderReviewsChart(stats.reviewsPerDay);
      
      // Render ratings distribution
      renderRatingsChart(stats.ratingsDistribution);
      
      // Render card types
      renderTypesChart(stats.cardsByType, stats.totalCards);
      
      // Render progress info
      renderProgressInfo(stats);
    }
    
    function renderReviewsChart(reviewsPerDay) {
      const container = document.getElementById('reviews-chart');
      const maxCount = Math.max(...reviewsPerDay.map(d => d.count), 1);
      
      container.innerHTML = reviewsPerDay.map(day => {
        const height = (day.count / maxCount) * 100;
        return \`<div class="bar" style="height: \${Math.max(height, 2)}%" title="\${day.date}: \${day.count} reviews"></div>\`;
      }).join('');
    }
    
    function renderRatingsChart(ratings) {
      const container = document.getElementById('ratings-chart');
      const total = ratings.again + ratings.hard + ratings.good + ratings.easy;
      const maxCount = Math.max(ratings.again, ratings.hard, ratings.good, ratings.easy, 1);
      
      const items = [
        { key: 'again', label: 'Again', color: 'again' },
        { key: 'hard', label: 'Hard', color: 'hard' },
        { key: 'good', label: 'Good', color: 'good' },
        { key: 'easy', label: 'Easy', color: 'easy' },
      ];
      
      container.innerHTML = items.map(item => {
        const count = ratings[item.key];
        const height = (count / maxCount) * 100;
        return \`
          <div class="rating-item">
            <div class="rating-bar">
              <div class="rating-fill \${item.color}" style="height: \${Math.max(height, 4)}%"></div>
            </div>
            <div class="rating-label">\${item.label}</div>
            <div class="rating-value">\${count}</div>
          </div>
        \`;
      }).join('');
    }
    
    function renderTypesChart(cardsByType, total) {
      const container = document.getElementById('types-chart');
      const types = [
        { key: 'word', label: 'Words' },
        { key: 'phrase', label: 'Phrases' },
        { key: 'sentence', label: 'Sentences' },
      ];
      
      container.innerHTML = types.map(type => {
        const count = cardsByType[type.key];
        const percent = total > 0 ? (count / total) * 100 : 0;
        return \`
          <div class="type-row">
            <div class="type-label">\${type.label}</div>
            <div class="type-bar-container">
              <div class="type-bar-fill" style="width: \${percent}%"></div>
            </div>
            <div class="type-count">\${count}</div>
          </div>
        \`;
      }).join('');
    }
    
    function renderProgressInfo(stats) {
      const container = document.getElementById('progress-info');
      
      const masteryPercent = stats.totalCards > 0 
        ? Math.round((stats.masteredCards / stats.totalCards) * 100) 
        : 0;
      
      container.innerHTML = \`
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Overall Mastery</span>
            <span>\${masteryPercent}%</span>
          </div>
          <div class="type-bar-container">
            <div class="type-bar-fill" style="width: \${masteryPercent}%"></div>
          </div>
        </div>
        <div style="font-size: 0.9em; color: var(--vscode-descriptionForeground);">
          <p>📊 Total reviews: \${stats.totalReviews}</p>
          <p>📈 Average ease: \${stats.averageEaseFactor.toFixed(2)}</p>
          <p>🎯 Retention rate: \${Math.round(stats.retentionRate * 100)}%</p>
        </div>
      \`;
    }
    
    // Simple force-directed graph visualization
    function renderKnowledgeGraph(graph) {
      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      if (graph.nodes.length === 0) {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--vscode-descriptionForeground');
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No connections found. Add synonyms, antonyms, or tags to your cards.', canvas.width / 2, canvas.height / 2);
        return;
      }
      
      // Initialize node positions randomly
      graphNodes = graph.nodes.map((node, i) => ({
        ...node,
        x: canvas.width / 2 + (Math.random() - 0.5) * 300,
        y: canvas.height / 2 + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
      }));
      
      graphEdges = graph.edges;
      const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
      
      // Color mapping
      const colors = {
        card: '#4fc3f7',
        synonym: '#81c784',
        antonym: '#e57373',
        tag: '#ffb74d',
      };
      
      // Edge colors
      const edgeColors = {
        synonym: 'rgba(129, 199, 132, 0.6)',
        antonym: 'rgba(229, 115, 115, 0.6)',
        tag: 'rgba(255, 183, 77, 0.6)',
        related: 'rgba(200, 200, 200, 0.5)',
      };
      
      // Setup mouse events for interaction
      const container = document.getElementById('graphContainer');
      const tooltip = document.getElementById('graphTooltip');
      
      canvas.onmousedown = function(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - graphOffsetX) / graphScale;
        const mouseY = (e.clientY - rect.top - graphOffsetY) / graphScale;
        
        // Check if clicking on a node
        const clickedNode = graphNodes.find(n => {
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          const radius = n.type === 'card' ? 12 : 8;
          return dx * dx + dy * dy < radius * radius;
        });
        
        if (clickedNode) {
          // Detect double-click
          const now = Date.now();
          if (lastClickedNode === clickedNode && now - lastClickTime < 300) {
            // Double-click detected
            if (clickedNode.type === 'card') {
              requestCardDetails(clickedNode.id);
            }
            lastClickTime = 0;
            lastClickedNode = null;
          } else {
            // Single click - prepare for potential double-click
            lastClickTime = now;
            lastClickedNode = clickedNode;
            
            draggingNode = clickedNode;
            selectedNode = clickedNode;
            showTooltip(e, clickedNode);
          }
        } else {
          isDragging = true;
          dragStartX = e.clientX - graphOffsetX;
          dragStartY = e.clientY - graphOffsetY;
          hideTooltip();
          lastClickTime = 0;
          lastClickedNode = null;
        }
      };
      
      canvas.onmousemove = function(e) {
        const rect = canvas.getBoundingClientRect();
        
        if (draggingNode) {
          draggingNode.x = (e.clientX - rect.left - graphOffsetX) / graphScale;
          draggingNode.y = (e.clientY - rect.top - graphOffsetY) / graphScale;
          draggingNode.vx = 0;
          draggingNode.vy = 0;
          
          // Restart simulation when dragging node
          if (!isSimulationRunning) {
            iterations = 0;
            tick();
          } else {
            draw();
          }
          
          showTooltip(e, draggingNode);
        } else if (isDragging) {
          graphOffsetX = e.clientX - dragStartX;
          graphOffsetY = e.clientY - dragStartY;
          draw();
        } else {
          // Hover detection
          const mouseX = (e.clientX - rect.left - graphOffsetX) / graphScale;
          const mouseY = (e.clientY - rect.top - graphOffsetY) / graphScale;
          
          const hoveredNode = graphNodes.find(n => {
            const dx = n.x - mouseX;
            const dy = n.y - mouseY;
            const radius = n.type === 'card' ? 12 : 8;
            return dx * dx + dy * dy < radius * radius;
          });
          
          if (hoveredNode) {
            canvas.style.cursor = 'pointer';
            showTooltip(e, hoveredNode);
          } else {
            canvas.style.cursor = 'grab';
            hideTooltip();
          }
        }
      };
      
      canvas.onmouseup = function() {
        isDragging = false;
        if (draggingNode) {
          // Restart simulation after releasing dragged node
          draggingNode = null;
          iterations = 0;
          if (!isSimulationRunning) {
            tick();
          }
        }
      };
      
      canvas.onmouseleave = function() {
        isDragging = false;
        if (draggingNode) {
          draggingNode = null;
          // Restart simulation after releasing dragged node
          iterations = 0;
          if (!isSimulationRunning) {
            tick();
          }
        }
        hideTooltip();
      };
      
      // Zoom with mouse wheel
      canvas.onwheel = function(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.min(3, Math.max(0.3, graphScale * zoomFactor));
        
        // Zoom towards mouse position
        graphOffsetX = mouseX - (mouseX - graphOffsetX) * (newScale / graphScale);
        graphOffsetY = mouseY - (mouseY - graphOffsetY) * (newScale / graphScale);
        graphScale = newScale;
        
        draw();
      };
      
      function showTooltip(e, node) {
        const typeLabels = {
          card: 'Vocabulary',
          synonym: 'Synonym',
          antonym: 'Antonym',
          tag: 'Tag'
        };
        
        tooltip.innerHTML = \`
          <div class="tooltip-title">\${node.label}</div>
          <div class="tooltip-type">\${typeLabels[node.type] || node.type}</div>
          \${node.type === 'card' && node.masteryLevel !== undefined ? 
            '<div class="tooltip-type">Mastery: ' + node.masteryLevel + '</div>' : ''}
        \`;
        
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - container.getBoundingClientRect().left + 15) + 'px';
        tooltip.style.top = (e.clientY - container.getBoundingClientRect().top + 15) + 'px';
      }
      
      function hideTooltip() {
        tooltip.style.display = 'none';
      }
      
      // Simple force simulation
      function simulate() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Apply forces
        for (const node of graphNodes) {
          if (node === draggingNode) continue;
          
          // Center gravity
          node.vx += (centerX - node.x) * 0.0005;
          node.vy += (centerY - node.y) * 0.0005;
          
          // Repulsion between nodes
          for (const other of graphNodes) {
            if (node.id === other.id) continue;
            
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < 120) {
              const force = (120 - dist) / dist * 0.8;
              node.vx += dx * force * 0.02;
              node.vy += dy * force * 0.02;
            }
          }
        }
        
        // Attraction along edges
        for (const edge of graphEdges) {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          
          if (!source || !target) continue;
          if (source === draggingNode || target === draggingNode) continue;
          
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (dist - 60) * 0.005;
          source.vx += dx * force * 0.02;
          source.vy += dy * force * 0.02;
          target.vx -= dx * force * 0.02;
          target.vy -= dy * force * 0.02;
        }
        
        // Update positions
        for (const node of graphNodes) {
          if (node === draggingNode) continue;
          
          node.vx *= 0.85; // Damping
          node.vy *= 0.85;
          
          node.x += node.vx;
          node.y += node.vy;
        }
      }
      
      function draw() {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply transform
        ctx.translate(graphOffsetX, graphOffsetY);
        ctx.scale(graphScale, graphScale);
        
        // Draw edges
        for (const edge of graphEdges) {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          
          if (!source || !target) continue;
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = edgeColors[edge.type] || edgeColors.related;
          ctx.lineWidth = 1.5 / graphScale;
          ctx.stroke();
        }
        
        // Draw nodes
        for (const node of graphNodes) {
          const radius = node.type === 'card' ? 10 + (node.masteryLevel || 0) * 0.5 : 6;
          const isSelected = node === selectedNode;
          
          // Glow for selected
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
          }
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = colors[node.type] || colors.card;
          ctx.fill();
          
          // Border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1 / graphScale;
          ctx.stroke();
          
          // Draw label
          const fontSize = node.type === 'card' ? 11 : 9;
          ctx.font = (fontSize / graphScale > 6 ? fontSize : 6 * graphScale) + 'px sans-serif';
          ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--vscode-editor-foreground');
          ctx.textAlign = 'center';
          
          // Only show labels if zoom is sufficient
          if (graphScale > 0.5) {
            ctx.fillText(node.label, node.x, node.y + radius + 12);
          }
        }
        
        ctx.restore();
      }
      
      // Run simulation
      let iterations = 0;
      let isSimulationRunning = false;
      
      function tick() {
        isSimulationRunning = true;
        simulate();
        draw();
        iterations++;
        
        if (iterations < 300) {
          requestAnimationFrame(tick);
        } else {
          isSimulationRunning = false;
        }
      }
      
      tick();
      
      // Expose zoom functions
      window.zoomGraph = function(factor) {
        const newScale = Math.min(3, Math.max(0.3, graphScale * factor));
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        graphOffsetX = centerX - (centerX - graphOffsetX) * (newScale / graphScale);
        graphOffsetY = centerY - (centerY - graphOffsetY) * (newScale / graphScale);
        graphScale = newScale;
        draw();
      };
      
      window.resetGraphView = function() {
        graphScale = 1;
        graphOffsetX = 0;
        graphOffsetY = 0;
        draw();
      };
    }
    
    // Request card details from extension
    function requestCardDetails(cardId) {
      vscode.postMessage({ type: 'get_card_details', cardId });
    }
    
    // Show card details in modal
    function showCardDetails(card, srs) {
      const modal = document.getElementById('cardModal');
      const term = document.getElementById('modalTerm');
      const phonetic = document.getElementById('modalPhonetic');
      const body = document.getElementById('modalBody');
      const playBtn = document.getElementById('playAudioBtn');
      
      // Set term and phonetic
      term.textContent = card.front.term;
      phonetic.textContent = card.front.phonetic || '';
      phonetic.style.display = card.front.phonetic ? 'block' : 'none';
      
      // Enable/disable audio button
      playBtn.disabled = !card.front.term;
      
      // Build modal body
      let bodyHTML = '';
      
      // Morphemes (word segmentation)
      if (card.front.morphemes && card.front.morphemes.length > 0) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Morphemes (词素切分)</div>
            <div class="modal-list">
              \${card.front.morphemes.map(m => \`<span class="modal-list-item">\${escapeHtml(m)}</span>\`).join(' + ')}
            </div>
          </div>
        \`;
      }
      
      // Translation
      if (card.back?.translation) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Translation</div>
            <div class="modal-section-content">\${escapeHtml(card.back.translation)}</div>
          </div>
        \`;
      }
      
      // Explanation (English)
      if (card.back?.explanation) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Explanation</div>
            <div class="modal-section-content">\${escapeHtml(card.back.explanation)}</div>
          </div>
        \`;
      }
      
      // Explanation (Chinese)
      if (card.back?.explanationCn) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">释义（中文）</div>
            <div class="modal-section-content">\${escapeHtml(card.back.explanationCn)}</div>
          </div>
        \`;
      }
      
      // Example sentence
      if (card.front.example) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Example</div>
            <div class="modal-example">\${escapeHtml(card.front.example)}</div>
        \`;
        if (card.front.exampleCn) {
          bodyHTML += \`<div style="color: var(--vscode-descriptionForeground); margin-top: 4px;">\${escapeHtml(card.front.exampleCn)}</div>\`;
        }
        bodyHTML += '</div>';
      }
      
      // Synonyms
      if (card.back?.synonyms && card.back.synonyms.length > 0) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Synonyms</div>
            <div class="modal-list">
              \${card.back.synonyms.map(s => \`<span class="modal-list-item">\${escapeHtml(s)}</span>\`).join('')}
            </div>
          </div>
        \`;
      }
      
      // Antonyms
      if (card.back?.antonyms && card.back.antonyms.length > 0) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Antonyms</div>
            <div class="modal-list">
              \${card.back.antonyms.map(a => \`<span class="modal-list-item">\${escapeHtml(a)}</span>\`).join('')}
            </div>
          </div>
        \`;
      }
      
      // Notes
      if (card.back?.notes) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Notes</div>
            <div class="modal-section-content">\${escapeHtml(card.back.notes)}</div>
          </div>
        \`;
      }
      
      // Tags
      if (card.tags && card.tags.length > 0) {
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Tags</div>
            <div class="modal-tags">
              \${card.tags.map(t => \`<span class="modal-tag">\${escapeHtml(t)}</span>\`).join('')}
            </div>
          </div>
        \`;
      }
      
      // SRS Info
      if (srs) {
        const dueDate = new Date(srs.dueAt);
        const lastReview = srs.lastReviewAt ? new Date(srs.lastReviewAt) : null;
        
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Learning Progress</div>
            <div class="modal-srs-info">
              <div class="modal-srs-item">
                <div class="modal-srs-label">Interval</div>
                <div class="modal-srs-value">\${srs.intervalDays}d</div>
              </div>
              <div class="modal-srs-item">
                <div class="modal-srs-label">Ease Factor</div>
                <div class="modal-srs-value">\${srs.easeFactor.toFixed(2)}</div>
              </div>
              <div class="modal-srs-item">
                <div class="modal-srs-label">Reviews</div>
                <div class="modal-srs-value">\${srs.reps}</div>
              </div>
              <div class="modal-srs-item">
                <div class="modal-srs-label">Lapses</div>
                <div class="modal-srs-value">\${srs.lapses}</div>
              </div>
            </div>
            <div style="margin-top: 12px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
              Due: \${dueDate.toLocaleDateString()}
              \${lastReview ? ' · Last review: ' + lastReview.toLocaleDateString() : ''}
            </div>
          </div>
        \`;
      }
      
      body.innerHTML = bodyHTML;
      modal.classList.add('show');
    }
    
    // Close modal
    function closeCardModal() {
      const modal = document.getElementById('cardModal');
      modal.classList.remove('show');
    }
    
    function closeModal(event) {
      if (event.target.id === 'cardModal') {
        closeCardModal();
      }
    }
    
    // Cache the best English voice for browser TTS
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
      console.log('[WordSlash Dashboard] Selected voice:', englishVoice?.name);
    };
    
    // Try to get voice immediately (some browsers have it ready)
    englishVoice = findBestEnglishVoice();
    
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
    
    // Play audio using configured TTS engine
    async function playAudio() {
      if (!currentCard || !currentCard.front.term) return;
      
      const playBtn = document.getElementById('playAudioBtn');
      playBtn.disabled = true;
      
      const text = currentCard.front.term;
      const engine = ttsSettings.engine;
      
      console.log('[WordSlash Dashboard] Speaking with engine:', engine, 'text:', text);
      
      try {
        // For browser engine, use Web Speech API directly
        if (engine === 'browser') {
          speakWithTTS(text);
          setTimeout(() => { playBtn.disabled = false; }, 500);
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
            
            audioPlayer.onended = () => {
              playBtn.disabled = false;
            };
            
            audioPlayer.onerror = () => {
              console.log('[WordSlash Dashboard]', engine, 'audio failed, falling back to browser TTS');
              speakWithTTS(text);
              playBtn.disabled = false;
            };
            
            await audioPlayer.play();
            console.log('[WordSlash Dashboard] Playing', engine, 'audio for:', text);
            return;
          } catch (error) {
            console.log('[WordSlash Dashboard]', engine, 'audio failed, falling back to browser TTS:', error.message);
            speakWithTTS(text);
            setTimeout(() => { playBtn.disabled = false; }, 500);
          }
          return;
        }
        
        // For premium engines (azure, openai) - TODO: implement
        if (engine === 'azure' || engine === 'openai') {
          console.log('[WordSlash Dashboard] Premium TTS not yet implemented, using browser TTS');
          speakWithTTS(text);
          setTimeout(() => { playBtn.disabled = false; }, 500);
          return;
        }
        
        // Default fallback
        speakWithTTS(text);
        setTimeout(() => { playBtn.disabled = false; }, 500);
      } catch (error) {
        console.error('[WordSlash Dashboard] Failed to play audio:', error);
        playBtn.disabled = false;
      }
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCardModal();
      }
    });
    
    function showError(message) {
      alert('Error: ' + message);
    }
  </script>
</body>
</html>`;
  }
}
