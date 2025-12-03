// Command: Bulk import cards from JSON file
// Uses VS Code withProgress API for progress display

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import type { JsonlStorage } from '../storage/storage';
import { parseBulkImportJson, processBulkImport } from '../storage/bulkImport';
import { buildIndex } from '../storage/indexer';
import type { BulkImportResult } from '../storage/schema';

/**
 * Execute bulk import command
 * Opens file picker, parses JSON, imports cards with progress
 */
export async function executeImportBulk(storage: JsonlStorage): Promise<BulkImportResult | null> {
  // Step 1: Show file picker
  const fileUris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'JSON Files': ['json'],
    },
    title: 'Select bulk import JSON file',
  });

  if (!fileUris || fileUris.length === 0) {
    return null; // User cancelled
  }

  const filePath = fileUris[0].fsPath;

  // Step 2: Execute import with progress
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'WordSlash: Importing cards...',
      cancellable: false,
    },
    async (progress) => {
      try {
        // Read file
        progress.report({ message: 'Reading file...', increment: 10 });
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Parse JSON
        progress.report({ message: 'Parsing JSON...', increment: 10 });
        const template = parseBulkImportJson(fileContent);

        // Read existing cards
        progress.report({ message: 'Loading existing cards...', increment: 10 });
        const existingCards = await storage.readAllCards();

        // Process import
        progress.report({ message: 'Processing cards...', increment: 20 });
        const { newCards, updatedCards, result } = processBulkImport(template, existingCards);

        // Write new cards
        const totalCards = newCards.length + updatedCards.length;
        let written = 0;

        for (const card of newCards) {
          await storage.appendCard(card);
          written++;
          progress.report({
            message: `Writing cards (${written}/${totalCards})...`,
            increment: 40 / Math.max(totalCards, 1),
          });
        }

        // Write updated cards
        for (const card of updatedCards) {
          await storage.appendCard(card);
          written++;
          progress.report({
            message: `Writing cards (${written}/${totalCards})...`,
            increment: 40 / Math.max(totalCards, 1),
          });
        }

        // Rebuild index
        progress.report({ message: 'Rebuilding index...', increment: 10 });
        const allCards = await storage.readAllCards();
        const allEvents = await storage.readAllEvents();
        const index = buildIndex(allCards, allEvents);

        // Save index
        await storage.atomicWriteJson('index.json', {
          version: 1,
          cardCount: index.cards.size,
          dueCount: index.dueCards.length,
          newCount: index.newCards.length,
          updatedAt: Date.now(),
        });

        // Show result message
        showImportResult(result);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`WordSlash: Import failed - ${errorMessage}`);
        return {
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [errorMessage],
        };
      }
    }
  );
}

/**
 * Show import result in VS Code notification
 */
function showImportResult(result: BulkImportResult): void {
  const parts: string[] = [];

  if (result.imported > 0) {
    parts.push(`${result.imported} imported`);
  }
  if (result.updated > 0) {
    parts.push(`${result.updated} updated`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }

  const message = parts.length > 0 ? parts.join(', ') : 'No cards processed';

  if (result.errors.length > 0) {
    vscode.window.showWarningMessage(
      `WordSlash: Import completed with issues - ${message}`,
      'Show Details'
    ).then((selection) => {
      if (selection === 'Show Details') {
        showImportErrors(result.errors);
      }
    });
  } else if (result.imported > 0 || result.updated > 0) {
    vscode.window.showInformationMessage(`WordSlash: Import successful - ${message}`);
  } else {
    vscode.window.showInformationMessage('WordSlash: No cards to import');
  }
}

/**
 * Show import errors in output channel
 */
function showImportErrors(errors: string[]): void {
  const outputChannel = vscode.window.createOutputChannel('WordSlash Import');
  outputChannel.clear();
  outputChannel.appendLine('=== Import Errors ===');
  outputChannel.appendLine('');
  for (const error of errors) {
    outputChannel.appendLine(`• ${error}`);
  }
  outputChannel.show();
}
