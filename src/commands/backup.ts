// Backup commands - Export and import full backups
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { JsonlStorage } from '../storage/storage';
import { logInfo, logError } from '../common/logger';

export interface BackupData {
  version: 1;
  exportedAt: number;
  cards: unknown[];
  events: unknown[];
}

/**
 * Export backup - shows save dialog and writes backup file
 */
export async function executeExportBackup(storage: JsonlStorage): Promise<void> {
  try {
    // Read all data
    const cards = await storage.readAllCards();
    const events = await storage.readAllEvents();

    if (cards.length === 0 && events.length === 0) {
      vscode.window.showWarningMessage('WordSlash: No data to export');
      return;
    }

    // Create backup object
    const backup: BackupData = {
      version: 1,
      exportedAt: Date.now(),
      cards,
      events,
    };

    // Generate default filename with date
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `wordslash-backup-${date}.json`;

    // Show save dialog
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFilename),
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*'],
      },
      saveLabel: 'Export Backup',
      title: 'Export WordSlash Backup',
    });

    if (!uri) {
      return; // User cancelled
    }

    // Write backup file
    const content = JSON.stringify(backup, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));

    logInfo(`Backup exported: ${cards.length} cards, ${events.length} events`);
    vscode.window.showInformationMessage(
      `WordSlash: Backup exported successfully! (${cards.length} cards, ${events.length} events)`
    );
  } catch (error) {
    logError('Failed to export backup', error);
    vscode.window.showErrorMessage(`WordSlash: Failed to export backup: ${error}`);
  }
}

/**
 * Import backup - shows open dialog and imports backup file
 */
export async function executeImportBackup(storage: JsonlStorage): Promise<void> {
  try {
    // Show open dialog
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*'],
      },
      openLabel: 'Import Backup',
      title: 'Import WordSlash Backup',
    });

    if (!uris || uris.length === 0) {
      return; // User cancelled
    }

    // Read backup file
    const content = await vscode.workspace.fs.readFile(uris[0]);
    const backup = JSON.parse(content.toString()) as BackupData;

    // Validate backup format
    if (!backup.version || !Array.isArray(backup.cards) || !Array.isArray(backup.events)) {
      vscode.window.showErrorMessage('WordSlash: Invalid backup file format');
      return;
    }

    // Confirm import (will merge with existing data)
    const existingCards = await storage.readAllCards();
    const existingEvents = await storage.readAllEvents();

    let message = `Import ${backup.cards.length} cards and ${backup.events.length} events?`;
    if (existingCards.length > 0 || existingEvents.length > 0) {
      message += `\n\nThis will merge with your existing ${existingCards.length} cards and ${existingEvents.length} events.`;
    }

    const confirm = await vscode.window.showWarningMessage(message, { modal: true }, 'Import');

    if (confirm !== 'Import') {
      return;
    }

    // Build existing ID sets for deduplication
    const existingCardIds = new Map<string, number>();
    for (const card of existingCards) {
      const existing = existingCardIds.get(card.id);
      if (!existing || card.version > existing) {
        existingCardIds.set(card.id, card.version);
      }
    }

    const existingEventIds = new Set<string>();
    for (const event of existingEvents) {
      existingEventIds.add(event.id);
    }

    // Import cards (only if newer version or new)
    let importedCards = 0;
    for (const card of backup.cards) {
      const typedCard = card as { id: string; version: number };
      const existingVersion = existingCardIds.get(typedCard.id);
      if (!existingVersion || typedCard.version > existingVersion) {
        await storage.appendCard(card as Parameters<typeof storage.appendCard>[0]);
        importedCards++;
      }
    }

    // Import events (skip duplicates by id)
    let importedEvents = 0;
    for (const event of backup.events) {
      const typedEvent = event as { id: string };
      if (!existingEventIds.has(typedEvent.id)) {
        await storage.appendEvent(event as Parameters<typeof storage.appendEvent>[0]);
        importedEvents++;
      }
    }

    logInfo(`Backup imported: ${importedCards} cards, ${importedEvents} events`);
    vscode.window.showInformationMessage(
      `WordSlash: Backup imported! (${importedCards} new cards, ${importedEvents} new events)`
    );
  } catch (error) {
    logError('Failed to import backup', error);
    vscode.window.showErrorMessage(`WordSlash: Failed to import backup: ${error}`);
  }
}
