import * as vscode from 'vscode';
import { JsonlStorage } from './storage/storage';
import { executeAddCard } from './commands/addCard';
import { FlashcardPanel } from './webview/panel';
import { generateSampleCards } from './commands/devSampleData';

let storage: JsonlStorage | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('WordSlash extension is now active!');

  // Initialize storage using globalStorageUri
  const storagePath = context.globalStorageUri.fsPath;
  storage = new JsonlStorage(storagePath);

  // Register commands
  const openFlashcardsCommand = vscode.commands.registerCommand('wordslash.openFlashcards', () => {
    if (storage) {
      FlashcardPanel.createOrShow(context.extensionUri, storage);
    }
  });

  const addCardCommand = vscode.commands.registerCommand(
    'wordslash.addCardFromSelection',
    async () => {
      if (storage) {
        await executeAddCard(storage);
      }
    }
  );

  const exportBackupCommand = vscode.commands.registerCommand('wordslash.exportBackup', () => {
    vscode.window.showInformationMessage('WordSlash: Export backup coming soon!');
  });

  const importBackupCommand = vscode.commands.registerCommand('wordslash.importBackup', () => {
    vscode.window.showInformationMessage('WordSlash: Import backup coming soon!');
  });

  // Dev command: generate sample data
  const devGenerateSampleCommand = vscode.commands.registerCommand(
    'wordslash.dev.generateSampleData',
    async () => {
      if (storage) {
        const count = await generateSampleCards(storage);
        vscode.window.showInformationMessage(`WordSlash: Generated ${count} sample cards!`);
      }
    }
  );

  context.subscriptions.push(
    openFlashcardsCommand,
    addCardCommand,
    exportBackupCommand,
    importBackupCommand,
    devGenerateSampleCommand
  );
}

export function deactivate() {
  storage = undefined;
}

/**
 * Get the storage instance (for testing)
 */
export function getStorage(): JsonlStorage | undefined {
  return storage;
}
