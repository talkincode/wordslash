// Dashboard panel - Main dashboard with stats and knowledge graph
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { buildIndex } from '../storage/indexer';
import { calculateDashboardStats, generateKnowledgeGraph } from '../storage/stats';
import {
  isValidUiMessage,
  type ExtensionToUiMessage,
  type UiToExtensionMessage,
} from './protocol';
import { FlashcardPanel } from './panel';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: JsonlStorage;
  private _disposables: vscode.Disposable[] = [];

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
      case 'get_dashboard_stats':
        await this._sendDashboardStats();
        break;

      case 'get_knowledge_graph':
        await this._sendKnowledgeGraph(msg);
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
      height: 400px;
      position: relative;
      overflow: hidden;
      background: var(--vscode-editor-background);
      border-radius: 8px;
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
        </div>
        <div class="graph-container">
          <canvas id="graphCanvas" class="graph-canvas"></canvas>
        </div>
        <div class="graph-legend">
          <div class="legend-item"><div class="legend-dot card"></div> Vocabulary</div>
          <div class="legend-item"><div class="legend-dot synonym"></div> Synonym</div>
          <div class="legend-item"><div class="legend-dot antonym"></div> Antonym</div>
          <div class="legend-item"><div class="legend-dot tag"></div> Tag</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentStats = null;
    let currentGraph = null;
    let graphSimulation = null;
    
    // Send ready message
    vscode.postMessage({ type: 'ui_ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
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
      const nodes = graph.nodes.map((node, i) => ({
        ...node,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0,
        vy: 0,
      }));
      
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      
      // Color mapping
      const colors = {
        card: '#4fc3f7',
        synonym: '#81c784',
        antonym: '#e57373',
        tag: '#ffb74d',
      };
      
      // Edge colors
      const edgeColors = {
        synonym: 'rgba(129, 199, 132, 0.5)',
        antonym: 'rgba(229, 115, 115, 0.5)',
        tag: 'rgba(255, 183, 77, 0.5)',
        related: 'rgba(200, 200, 200, 0.5)',
      };
      
      // Simple force simulation
      function simulate() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Apply forces
        for (const node of nodes) {
          // Center gravity
          node.vx += (centerX - node.x) * 0.001;
          node.vy += (centerY - node.y) * 0.001;
          
          // Repulsion between nodes
          for (const other of nodes) {
            if (node.id === other.id) continue;
            
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < 150) {
              const force = (150 - dist) / dist * 0.5;
              node.vx += dx * force * 0.01;
              node.vy += dy * force * 0.01;
            }
          }
        }
        
        // Attraction along edges
        for (const edge of graph.edges) {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          
          if (!source || !target) continue;
          
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (dist - 80) * 0.01;
          source.vx += dx * force * 0.01;
          source.vy += dy * force * 0.01;
          target.vx -= dx * force * 0.01;
          target.vy -= dy * force * 0.01;
        }
        
        // Update positions
        for (const node of nodes) {
          node.vx *= 0.9; // Damping
          node.vy *= 0.9;
          
          node.x += node.vx;
          node.y += node.vy;
          
          // Keep in bounds
          node.x = Math.max(30, Math.min(canvas.width - 30, node.x));
          node.y = Math.max(30, Math.min(canvas.height - 30, node.y));
        }
      }
      
      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw edges
        for (const edge of graph.edges) {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          
          if (!source || !target) continue;
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = edgeColors[edge.type] || edgeColors.related;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        
        // Draw nodes
        for (const node of nodes) {
          const radius = node.type === 'card' ? 8 + (node.masteryLevel || 0) : 5;
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = colors[node.type] || colors.card;
          ctx.fill();
          
          // Draw label
          ctx.font = node.type === 'card' ? '11px sans-serif' : '9px sans-serif';
          ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--vscode-editor-foreground');
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y + radius + 12);
        }
      }
      
      // Run simulation
      let iterations = 0;
      function tick() {
        simulate();
        draw();
        iterations++;
        
        if (iterations < 200) {
          requestAnimationFrame(tick);
        }
      }
      
      tick();
    }
    
    function showError(message) {
      alert('Error: ' + message);
    }
  </script>
</body>
</html>`;
  }
}
