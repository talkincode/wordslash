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
  private static _context: vscode.ExtensionContext | undefined;

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

  public static createOrShow(extensionUri: vscode.Uri, storage: JsonlStorage, context?: vscode.ExtensionContext) {
    // Store context for later use
    if (context) {
      DashboardPanel._context = context;
    }
    
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
        if (DashboardPanel._context) {
          FlashcardPanel.createOrShow(this._extensionUri, this._storage, DashboardPanel._context);
        }
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src blob: https://dict.youdao.com https://translate.google.com; connect-src https://*.tts.speech.microsoft.com;">
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
    
    /* ========== Animation Styles ========== */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .stat-card {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      animation: fadeInUp 0.5s ease-out forwards;
      opacity: 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    
    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.15s; }
    .stat-card:nth-child(3) { animation-delay: 0.2s; }
    .stat-card:nth-child(4) { animation-delay: 0.25s; }
    .stat-card:nth-child(5) { animation-delay: 0.3s; }
    .stat-card:nth-child(6) { animation-delay: 0.35s; }
    .stat-card:nth-child(7) { animation-delay: 0.4s; }
    .stat-card:nth-child(8) { animation-delay: 0.45s; }
    
    .section {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 20px;
      animation: fadeInUp 0.6s ease-out forwards;
      opacity: 0;
    }
    
    .sections .section:nth-child(1) { animation-delay: 0.5s; }
    .sections .section:nth-child(2) { animation-delay: 0.6s; }
    .sections .section:nth-child(3) { animation-delay: 0.7s; }
    .sections .section:nth-child(4) { animation-delay: 0.8s; }
    .sections .section:nth-child(5) { animation-delay: 0.9s; }
    
    /* ========== Heatmap Calendar Styles ========== */
    .heatmap-container {
      overflow-x: auto;
      padding: 8px 0;
    }
    
    .heatmap-grid {
      display: grid;
      grid-template-rows: repeat(7, 12px);
      grid-auto-flow: column;
      gap: 3px;
      width: fit-content;
    }
    
    .heatmap-cell {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    
    .heatmap-cell:hover {
      transform: scale(1.3);
      outline: 2px solid var(--vscode-focusBorder);
    }
    
    .heatmap-cell.level-0 { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-input-border); }
    .heatmap-cell.level-1 { background-color: rgba(0, 122, 204, 0.2); }
    .heatmap-cell.level-2 { background-color: rgba(0, 122, 204, 0.4); }
    .heatmap-cell.level-3 { background-color: rgba(0, 122, 204, 0.6); }
    .heatmap-cell.level-4 { background-color: rgba(0, 122, 204, 0.8); }
    .heatmap-cell.level-5 { background-color: rgba(0, 122, 204, 1); }
    
    .heatmap-legend {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    
    .heatmap-months {
      display: flex;
      margin-bottom: 4px;
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
    }
    
    .heatmap-month {
      text-align: left;
    }
    
    .heatmap-tooltip {
      position: absolute;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85em;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      white-space: nowrap;
    }
    
    /* ========== Donut Chart Styles ========== */
    .donut-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
    }
    
    .donut-chart {
      position: relative;
      width: 140px;
      height: 140px;
    }
    
    .donut-chart svg {
      transform: rotate(-90deg);
    }
    
    .donut-segment {
      fill: none;
      stroke-width: 20;
      stroke-linecap: butt;
      transition: stroke-dashoffset 1s ease-out, opacity 0.2s;
    }
    
    .donut-segment:hover {
      opacity: 0.8;
    }
    
    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    
    .donut-center-value {
      font-size: 1.8em;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
    }
    
    .donut-center-label {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
    }
    
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .donut-legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9em;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .donut-legend-item:hover {
      opacity: 0.7;
    }
    
    .donut-legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }
    
    .donut-legend-dot.new { background: #64b5f6; }
    .donut-legend-dot.learning { background: #ffb74d; }
    .donut-legend-dot.mastered { background: #81c784; }
    
    /* ========== Sparkline Styles ========== */
    .sparkline-container {
      position: relative;
      height: 60px;
      margin-top: 12px;
    }
    
    .sparkline-svg {
      width: 100%;
      height: 100%;
    }
    
    .sparkline-path {
      fill: none;
      stroke: var(--vscode-textLink-foreground);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    .sparkline-area {
      fill: url(#sparklineGradient);
      opacity: 0.3;
    }
    
    .sparkline-dot {
      fill: var(--vscode-textLink-foreground);
      transition: r 0.2s ease;
    }
    
    .sparkline-dot:hover {
      r: 5;
    }
    
    /* ========== Enhanced Bar Chart Styles ========== */
    .bar-chart-enhanced {
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      height: 100%;
      gap: 1px;
      position: relative;
    }
    
    .bar-enhanced {
      flex: 0 0 auto;
      width: 8px;
      background: linear-gradient(180deg, var(--vscode-textLink-foreground) 0%, rgba(0,122,204,0.6) 100%);
      border-radius: 2px 2px 0 0;
      min-height: 2px;
      transition: all 0.3s ease;
      position: relative;
      cursor: pointer;
    }
    
    .bar-enhanced:hover {
      background: linear-gradient(180deg, #4fc3f7 0%, var(--vscode-textLink-foreground) 100%);
      transform: scaleY(1.05);
    }
    
    .bar-enhanced::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 10;
    }
    
    .bar-enhanced:hover::after {
      opacity: 1;
    }
    
    .chart-avg-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 2px dashed rgba(255, 183, 77, 0.6);
      z-index: 5;
    }
    
    .chart-avg-label {
      position: absolute;
      right: 4px;
      font-size: 0.7em;
      color: #ffb74d;
      transform: translateY(-100%);
    }
    
    /* ========== Rating Pills Enhanced ========== */
    .rating-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 20px;
      background: var(--vscode-editor-background);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .rating-pill:hover {
      transform: scale(1.05);
    }
    
    .rating-pill-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .rating-pill-dot.again { background: #d32f2f; }
    .rating-pill-dot.hard { background: #f57c00; }
    .rating-pill-dot.good { background: #388e3c; }
    .rating-pill-dot.easy { background: #1976d2; }
    
    .rating-pill-label {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    
    .rating-pill-value {
      font-weight: 600;
      font-size: 1.1em;
    }
    
    /* ========== Progress Ring ========== */
    .progress-ring-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 16px;
    }
    
    .progress-ring {
      width: 80px;
      height: 80px;
    }
    
    .progress-ring-circle-bg {
      fill: none;
      stroke: var(--vscode-editor-background);
      stroke-width: 8;
    }
    
    .progress-ring-circle {
      fill: none;
      stroke: var(--vscode-textLink-foreground);
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s ease-out;
      transform: rotate(-90deg);
      transform-origin: center;
    }
    
    .progress-ring-text {
      font-size: 1.2em;
      font-weight: 600;
      fill: var(--vscode-textLink-foreground);
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
      <!-- Heatmap Calendar -->
      <div class="section" style="grid-column: 1 / -1;">
        <div class="section-title">🔥 Activity Heatmap (90 Days)</div>
        <div class="heatmap-months" id="heatmap-months"></div>
        <div class="heatmap-container">
          <div class="heatmap-grid" id="heatmap-grid"></div>
        </div>
        <div class="heatmap-legend">
          <span>Less</span>
          <div class="heatmap-cell level-0" style="cursor:default"></div>
          <div class="heatmap-cell level-1" style="cursor:default"></div>
          <div class="heatmap-cell level-2" style="cursor:default"></div>
          <div class="heatmap-cell level-3" style="cursor:default"></div>
          <div class="heatmap-cell level-4" style="cursor:default"></div>
          <div class="heatmap-cell level-5" style="cursor:default"></div>
          <span>More</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">📊 Review History (30 Days)</div>
        <div class="chart-container">
          <div class="bar-chart-enhanced" id="reviews-chart"></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">🎯 Rating Distribution</div>
        <div class="ratings-chart" id="ratings-chart"></div>
      </div>
      
      <div class="section">
        <div class="section-title">📝 Card Distribution</div>
        <div class="donut-container" id="donut-chart"></div>
      </div>
      
      <div class="section">
        <div class="section-title">📈 Learning Progress</div>
        <div id="progress-info"></div>
        <div class="sparkline-container" id="retention-sparkline"></div>
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
          <div class="legend-item"><div class="legend-dot tag"></div> Tag</div>
          <div class="legend-item" style="margin-left: 16px;">
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: hsl(0, 70%, 55%);"></span>
              <span style="margin: 0 2px;">→</span>
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: hsl(120, 70%, 55%);"></span>
            </span>
            <span style="margin-left: 4px;">Hard → Easy (EF)</span>
          </div>
          <div class="legend-item" style="margin-left: 16px;">
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-textLink-foreground);"></span>
              <span style="margin: 0 2px;">→</span>
              <span style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: var(--vscode-textLink-foreground);"></span>
            </span>
            <span style="margin-left: 4px;">Reviews</span>
          </div>
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
      
      // Render stat cards with animated counters
      const statsGrid = document.getElementById('stats-grid');
      statsGrid.innerHTML = \`
        <div class="stat-card highlight">
          <div class="stat-value" data-count="\${stats.dueCards}">0</div>
          <div class="stat-label">Due Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.totalCards}">0</div>
          <div class="stat-label">Total Cards</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.newCards}">0</div>
          <div class="stat-label">New Cards</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.learnedCards}">0</div>
          <div class="stat-label">Learned</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.masteredCards}">0</div>
          <div class="stat-label">Mastered</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.currentStreak}">0</div>
          <div class="stat-label">Day Streak 🔥</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${Math.round(stats.retentionRate * 100)}" data-suffix="%">0%</div>
          <div class="stat-label">Retention</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-count="\${stats.reviewsToday}">0</div>
          <div class="stat-label">Reviews Today</div>
        </div>
      \`;
      
      // Animate counters after a short delay
      setTimeout(() => animateCounters(), 200);
      
      // Render heatmap calendar
      renderHeatmapCalendar(stats.reviewsPerDay);
      
      // Render enhanced reviews chart (last 30 days)
      renderReviewsChartEnhanced(stats.reviewsPerDay.slice(-30));
      
      // Render ratings distribution
      renderRatingsChart(stats.ratingsDistribution);
      
      // Render donut chart for card distribution
      renderDonutChart(stats);
      
      // Render progress info with sparkline
      renderProgressInfo(stats);
    }
    
    // Animate number counters
    function animateCounters() {
      const counters = document.querySelectorAll('.stat-value[data-count]');
      counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = 1000;
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function for smooth animation
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          const current = Math.round(target * easeOutQuart);
          
          counter.textContent = current + suffix;
          
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          }
        }
        
        requestAnimationFrame(updateCounter);
      });
    }
    
    // Render heatmap calendar (90 days)
    function renderHeatmapCalendar(reviewsPerDay) {
      const container = document.getElementById('heatmap-grid');
      const monthsContainer = document.getElementById('heatmap-months');
      
      // Calculate max for color scaling
      const maxCount = Math.max(...reviewsPerDay.map(d => d.count), 1);
      
      // Build heatmap cells
      let html = '';
      const months = new Map();
      
      reviewsPerDay.forEach((day, index) => {
        const date = new Date(day.date);
        const dayOfWeek = date.getDay();
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        
        // Track months for labels
        if (!months.has(monthKey)) {
          months.set(monthKey, index);
        }
        
        // Calculate color level (0-5)
        let level = 0;
        if (day.count > 0) {
          const ratio = day.count / maxCount;
          if (ratio <= 0.2) level = 1;
          else if (ratio <= 0.4) level = 2;
          else if (ratio <= 0.6) level = 3;
          else if (ratio <= 0.8) level = 4;
          else level = 5;
        }
        
        const tooltip = \`\${day.date}: \${day.count} review\${day.count !== 1 ? 's' : ''}\`;
        html += \`<div class="heatmap-cell level-\${level}" data-date="\${day.date}" data-count="\${day.count}" title="\${tooltip}"></div>\`;
      });
      
      container.innerHTML = html;
      
      // Render month labels
      const weeksTotal = Math.ceil(reviewsPerDay.length / 7);
      const cellWidth = 15; // 12px cell + 3px gap
      let monthsHtml = '';
      let lastMonth = '';
      
      for (let week = 0; week < weeksTotal; week++) {
        const dayIndex = week * 7;
        if (dayIndex < reviewsPerDay.length) {
          const date = new Date(reviewsPerDay[dayIndex].date);
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          if (month !== lastMonth) {
            monthsHtml += \`<span class="heatmap-month" style="width: \${cellWidth * 4}px;">\${month}</span>\`;
            lastMonth = month;
          }
        }
      }
      
      monthsContainer.innerHTML = monthsHtml;
    }
    
    // Enhanced reviews chart with tooltips and average line
    function renderReviewsChartEnhanced(reviewsPerDay) {
      const container = document.getElementById('reviews-chart');
      const maxCount = Math.max(...reviewsPerDay.map(d => d.count), 1);
      const avgCount = reviewsPerDay.reduce((sum, d) => sum + d.count, 0) / reviewsPerDay.length;
      const avgHeight = (avgCount / maxCount) * 100;
      
      let barsHtml = reviewsPerDay.map((day, index) => {
        const height = (day.count / maxCount) * 100;
        const shortDate = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tooltip = \`\${shortDate}: \${day.count}\`;
        return \`<div class="bar-enhanced" style="height: \${Math.max(height, 2)}%; animation-delay: \${index * 15}ms;" data-tooltip="\${tooltip}"></div>\`;
      }).join('');
      
      // Add average line
      barsHtml += \`<div class="chart-avg-line" style="bottom: \${avgHeight}%;"><span class="chart-avg-label">avg \${Math.round(avgCount)}</span></div>\`;
      
      container.innerHTML = barsHtml;
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
      const total = ratings.again + ratings.hard + ratings.good + ratings.easy || 1;
      
      // SVG donut chart calculations
      const radius = 50;
      const circumference = 2 * Math.PI * radius;
      
      const items = [
        { key: 'again', label: 'Again', color: '#d32f2f', count: ratings.again },
        { key: 'hard', label: 'Hard', color: '#f57c00', count: ratings.hard },
        { key: 'good', label: 'Good', color: '#388e3c', count: ratings.good },
        { key: 'easy', label: 'Easy', color: '#1976d2', count: ratings.easy },
      ];
      
      // Calculate segments
      let offset = 0;
      const segments = items.map((item, index) => {
        const percent = item.count / total;
        const dash = circumference * percent;
        const currentOffset = circumference - offset;
        offset += dash;
        return {
          ...item,
          percent,
          dash,
          offset: currentOffset,
          delay: 0.6 + index * 0.1
        };
      });
      
      // Retention rate (good + easy)
      const retentionPercent = Math.round(((ratings.good + ratings.easy) / total) * 100);
      
      container.innerHTML = \`
        <div class="donut-container">
          <div class="donut-chart">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <!-- Background circle -->
              <circle cx="70" cy="70" r="\${radius}" fill="none" stroke="var(--vscode-editor-background)" stroke-width="20"/>
              
              \${segments.map(seg => \`
                <circle class="donut-segment" cx="70" cy="70" r="\${radius}" 
                        stroke="\${seg.color}" 
                        stroke-dasharray="\${seg.dash} \${circumference - seg.dash}"
                        stroke-dashoffset="\${seg.offset}"
                        style="animation: scaleIn 0.8s ease-out \${seg.delay}s forwards; opacity: 0;"/>
              \`).join('')}
            </svg>
            <div class="donut-center">
              <div class="donut-center-value">\${retentionPercent}%</div>
              <div class="donut-center-label">Retention</div>
            </div>
          </div>
          <div class="donut-legend">
            \${items.map(item => {
              const percent = Math.round((item.count / total) * 100);
              return \`
                <div class="donut-legend-item">
                  <div class="donut-legend-dot" style="background: \${item.color};"></div>
                  <span>\${item.label}: \${item.count} (\${percent}%)</span>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }
    
    // Render donut chart for card distribution
    function renderDonutChart(stats) {
      const container = document.getElementById('donut-chart');
      const total = stats.totalCards || 1;
      const newCards = stats.newCards;
      const learning = stats.learnedCards - stats.masteredCards;
      const mastered = stats.masteredCards;
      
      // SVG calculations
      const radius = 50;
      const circumference = 2 * Math.PI * radius;
      
      const newPercent = newCards / total;
      const learningPercent = learning / total;
      const masteredPercent = mastered / total;
      
      const newDash = circumference * newPercent;
      const learningDash = circumference * learningPercent;
      const masteredDash = circumference * masteredPercent;
      
      let offset = 0;
      const newOffset = circumference - offset;
      offset += newDash;
      const learningOffset = circumference - offset;
      offset += learningDash;
      const masteredOffset = circumference - offset;
      
      container.innerHTML = \`
        <div class="donut-chart">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <!-- Background circle -->
            <circle cx="70" cy="70" r="\${radius}" fill="none" stroke="var(--vscode-editor-background)" stroke-width="20"/>
            
            <!-- New cards segment -->
            <circle class="donut-segment" cx="70" cy="70" r="\${radius}" 
                    stroke="#64b5f6" 
                    stroke-dasharray="\${newDash} \${circumference - newDash}"
                    stroke-dashoffset="\${newOffset}"
                    style="animation: scaleIn 0.8s ease-out 0.7s forwards; opacity: 0;"/>
            
            <!-- Learning segment -->
            <circle class="donut-segment" cx="70" cy="70" r="\${radius}" 
                    stroke="#ffb74d" 
                    stroke-dasharray="\${learningDash} \${circumference - learningDash}"
                    stroke-dashoffset="\${learningOffset}"
                    style="animation: scaleIn 0.8s ease-out 0.8s forwards; opacity: 0;"/>
            
            <!-- Mastered segment -->
            <circle class="donut-segment" cx="70" cy="70" r="\${radius}" 
                    stroke="#81c784" 
                    stroke-dasharray="\${masteredDash} \${circumference - masteredDash}"
                    stroke-dashoffset="\${masteredOffset}"
                    style="animation: scaleIn 0.8s ease-out 0.9s forwards; opacity: 0;"/>
          </svg>
          <div class="donut-center">
            <div class="donut-center-value">\${total}</div>
            <div class="donut-center-label">Total</div>
          </div>
        </div>
        <div class="donut-legend">
          <div class="donut-legend-item">
            <div class="donut-legend-dot new"></div>
            <span>New: \${newCards}</span>
          </div>
          <div class="donut-legend-item">
            <div class="donut-legend-dot learning"></div>
            <span>Learning: \${learning}</span>
          </div>
          <div class="donut-legend-item">
            <div class="donut-legend-dot mastered"></div>
            <span>Mastered: \${mastered}</span>
          </div>
        </div>
      \`;
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
      const sparklineContainer = document.getElementById('retention-sparkline');
      
      const masteryPercent = stats.totalCards > 0 
        ? Math.round((stats.masteredCards / stats.totalCards) * 100) 
        : 0;
      
      // Progress ring circumference
      const radius = 32;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (masteryPercent / 100) * circumference;
      
      container.innerHTML = \`
        <div class="progress-ring-container">
          <svg class="progress-ring" viewBox="0 0 80 80">
            <circle class="progress-ring-circle-bg" cx="40" cy="40" r="\${radius}"/>
            <circle class="progress-ring-circle" cx="40" cy="40" r="\${radius}"
                    stroke-dasharray="\${circumference}"
                    stroke-dashoffset="\${circumference}"
                    style="animation: none;">
              <animate attributeName="stroke-dashoffset" 
                       from="\${circumference}" 
                       to="\${strokeDashoffset}" 
                       dur="1.5s" 
                       fill="freeze"
                       begin="0.8s"/>
            </circle>
            <text class="progress-ring-text" x="40" y="44" text-anchor="middle">\${masteryPercent}%</text>
          </svg>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Overall Mastery</div>
            <div style="font-size: 0.85em; color: var(--vscode-descriptionForeground);">
              \${stats.masteredCards} of \${stats.totalCards} cards mastered
            </div>
          </div>
        </div>
        <div style="font-size: 0.9em; color: var(--vscode-descriptionForeground); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <p>📊 Total reviews: \${stats.totalReviews}</p>
          <p>📈 Average ease: \${stats.averageEaseFactor.toFixed(2)}</p>
        </div>
        <div style="margin-top: 12px; font-size: 0.9em;">
          <span style="color: var(--vscode-descriptionForeground);">📉 Retention Trend (30 days)</span>
        </div>
      \`;
      
      // Render sparkline
      renderRetentionSparkline(stats.retentionHistory || [], sparklineContainer);
    }
    
    // Render retention rate sparkline
    function renderRetentionSparkline(history, container) {
      if (!history || history.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground); padding: 16px;">No data yet</div>';
        return;
      }
      
      const width = container.clientWidth || 300;
      const height = 60;
      const padding = 4;
      
      const points = history.map((d, i) => ({
        x: padding + (i / (history.length - 1)) * (width - padding * 2),
        y: height - padding - (d.rate * (height - padding * 2))
      }));
      
      // Create SVG path
      const pathD = points.map((p, i) => 
        (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)
      ).join(' ');
      
      // Create area path (closed shape)
      const areaD = pathD + \` L\${points[points.length - 1].x.toFixed(1)},\${height - padding} L\${points[0].x.toFixed(1)},\${height - padding} Z\`;
      
      // Current and average values
      const currentRate = history[history.length - 1]?.rate || 0;
      const avgRate = history.reduce((sum, d) => sum + d.rate, 0) / history.length;
      
      container.innerHTML = \`
        <svg class="sparkline-svg" viewBox="0 0 \${width} \${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--vscode-textLink-foreground)" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="var(--vscode-textLink-foreground)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="sparkline-area" d="\${areaD}"/>
          <path class="sparkline-path" d="\${pathD}"/>
          \${points.map((p, i) => \`<circle class="sparkline-dot" cx="\${p.x.toFixed(1)}" cy="\${p.y.toFixed(1)}" r="2"><title>\${history[i].date}: \${Math.round(history[i].rate * 100)}%</title></circle>\`).join('')}
        </svg>
        <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 4px;">
          <span>Current: <strong style="color: var(--vscode-textLink-foreground);">\${Math.round(currentRate * 100)}%</strong></span>
          <span>Avg: <strong>\${Math.round(avgRate * 100)}%</strong></span>
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
      
      // Get color based on ease factor (ef)
      // ef ranges from 1.3 (hard) to 2.5+ (easy)
      // Hard cards (low ef): red/orange
      // Easy cards (high ef): green/blue
      function getCardColorByEf(ef) {
        if (ef === undefined || ef === null) ef = 2.5; // Default for new cards
        
        // Clamp ef to reasonable range
        const clampedEf = Math.max(1.3, Math.min(3.0, ef));
        
        // Map ef to hue: 1.3 -> 0 (red), 2.5 -> 120 (green), 3.0 -> 200 (cyan)
        // Using HSL for smooth color transitions
        let hue;
        if (clampedEf <= 2.5) {
          // 1.3-2.5: red to green (0-120)
          hue = ((clampedEf - 1.3) / (2.5 - 1.3)) * 120;
        } else {
          // 2.5-3.0: green to cyan (120-200)
          hue = 120 + ((clampedEf - 2.5) / (3.0 - 2.5)) * 80;
        }
        
        return \`hsl(\${Math.round(hue)}, 70%, 55%)\`;
      }
      
      // Get node radius based on reps (review count)
      // reps: 0 = new, higher = more reviews
      function getCardRadiusByReps(reps) {
        if (reps === undefined || reps === null) reps = 0;
        // Base radius 8, max radius 20
        // Logarithmic scale to prevent huge nodes
        return 8 + Math.min(12, Math.log2(reps + 1) * 3);
      }
      
      // Color mapping for tags only
      const tagColor = '#ffb74d';
      
      // Edge colors (only tag edges now)
      const edgeColors = {
        tag: 'rgba(255, 183, 77, 0.6)',
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
          const radius = n.type === 'card' ? getCardRadiusByReps(n.reps) : 8;
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
            const radius = n.type === 'card' ? getCardRadiusByReps(n.reps) : 8;
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
        
        // Format ease factor for display
        const efDisplay = node.ef !== undefined ? node.ef.toFixed(2) : 'N/A';
        const repsDisplay = node.reps !== undefined ? node.reps : 0;
        
        tooltip.innerHTML = \`
          <div class="tooltip-title">\${node.label}</div>
          <div class="tooltip-type">\${typeLabels[node.type] || node.type}</div>
          \${node.type === 'card' ? \`
            <div class="tooltip-type">Reviews: \${repsDisplay}</div>
            <div class="tooltip-type">Ease Factor: \${efDisplay}</div>
            <div class="tooltip-type">Mastery: \${node.masteryLevel !== undefined ? node.masteryLevel : 0}</div>
          \` : ''}
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
          ctx.strokeStyle = edgeColors[edge.type] || edgeColors.tag;
          ctx.lineWidth = 1.5 / graphScale;
          ctx.stroke();
        }
        
        // Draw nodes
        for (const node of graphNodes) {
          // Card nodes: size based on reps, color based on ef
          // Tag nodes: fixed size and color
          const radius = node.type === 'card' 
            ? getCardRadiusByReps(node.reps) 
            : 6;
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
          
          // Card color based on ef (ease factor)
          // Tag color is fixed orange
          ctx.fillStyle = node.type === 'card' 
            ? getCardColorByEf(node.ef) 
            : tagColor;
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
      // Update current card for audio playback
      currentCard = card;
      console.log('[WordSlash Dashboard] showCardDetails - currentCard set to:', currentCard?.front?.term);
      
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
      console.log('[WordSlash Dashboard] Audio button enabled:', !playBtn.disabled);
      
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
        
        // Format interval for display
        const formatInterval = (days) => {
          if (!Number.isFinite(days) || days < 0 || days > 10000) {
            return 'Invalid';
          }
          if (days < 1) return '<1d';
          if (days < 30) return Math.round(days) + 'd';
          if (days < 365) return Math.round(days / 30) + 'mo';
          return (days / 365).toFixed(1) + 'y';
        };
        
        // Format due date
        const formatDueDate = (timestamp) => {
          if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > Date.now() + 365 * 100 * 24 * 60 * 60 * 1000) {
            return 'Invalid Date';
          }
          return new Date(timestamp).toLocaleDateString();
        };
        
        bodyHTML += \`
          <div class="modal-section">
            <div class="modal-section-title">Learning Progress</div>
            <div class="modal-srs-info">
              <div class="modal-srs-item">
                <div class="modal-srs-label">Interval</div>
                <div class="modal-srs-value">\${formatInterval(srs.intervalDays)}</div>
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
              Due: \${formatDueDate(srs.dueAt)}
              \${lastReview ? ' · Last review: ' + new Date(lastReview).toLocaleDateString() : ''}
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
      console.log('[WordSlash Dashboard] playAudio called, currentCard:', currentCard);
      if (!currentCard || !currentCard.front.term) {
        console.error('[WordSlash Dashboard] Cannot play audio: currentCard is', currentCard);
        return;
      }
      
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
        
        // Azure TTS implementation
        if (engine === 'azure') {
          const azureKey = ttsSettings.azureKey;
          const azureRegion = ttsSettings.azureRegion || 'eastus';
          
          if (!azureKey) {
            console.log('[WordSlash Dashboard] Azure key not configured, falling back to browser TTS');
            speakWithTTS(text);
            setTimeout(() => { playBtn.disabled = false; }, 500);
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
              playBtn.disabled = false;
            };
            
            audioPlayer.onerror = () => {
              if (audioUrl) URL.revokeObjectURL(audioUrl);
              console.log('[WordSlash Dashboard] Azure audio playback failed');
              playBtn.disabled = false;
            };
            
            await audioPlayer.play();
            console.log('[WordSlash Dashboard] Playing Azure TTS for:', text);
            return;
          } catch (error) {
            // NotAllowedError means autoplay was blocked - this is expected, don't fallback
            if (error.name === 'NotAllowedError') {
              console.log('[WordSlash Dashboard] Azure TTS autoplay blocked (user gesture required)');
              if (audioUrl) URL.revokeObjectURL(audioUrl);
              playBtn.disabled = false;
              return;
            }
            console.error('[WordSlash Dashboard] Azure TTS error:', error);
            speakWithTTS(text);
            setTimeout(() => { playBtn.disabled = false; }, 500);
            return;
          }
        }
        
        // OpenAI TTS - TODO: implement when needed
        if (engine === 'openai') {
          console.log('[WordSlash Dashboard] OpenAI TTS not yet implemented, using browser TTS');
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
