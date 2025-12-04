import * as vscode from 'vscode';
import { JsonlStorage } from './storage/storage';
import { executeAddCard } from './commands/addCard';
import { executeImportBulk } from './commands/importBulk';
import { executeExportTemplate } from './commands/exportTemplate';
import { FlashcardPanel } from './webview/panel';
import { DashboardPanel } from './webview/dashboard';
import { DashboardViewProvider } from './webview/dashboardViewProvider';
import { generateSampleCards } from './commands/devSampleData';
import { initLogger, logInfo } from './common/logger';

let storage: JsonlStorage | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Initialize logger
  const outputChannel = vscode.window.createOutputChannel('WordSlash');
  initLogger(outputChannel);
  logInfo('WordSlash extension activated');

  // Initialize storage using globalStorageUri
  const storagePath = context.globalStorageUri.fsPath;
  storage = new JsonlStorage(storagePath);

  // Register sidebar view provider
  const dashboardViewProvider = new DashboardViewProvider(context.extensionUri, storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DashboardViewProvider.viewType, dashboardViewProvider)
  );

  // Register commands
  const openFlashcardsCommand = vscode.commands.registerCommand('wordslash.openFlashcards', () => {
    if (storage) {
      FlashcardPanel.createOrShow(context.extensionUri, storage);
    }
  });

  // Dashboard command
  const openDashboardCommand = vscode.commands.registerCommand('wordslash.openDashboard', () => {
    if (storage) {
      DashboardPanel.createOrShow(context.extensionUri, storage);
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

  // Bulk import command
  const importBulkCommand = vscode.commands.registerCommand('wordslash.importBulk', async () => {
    if (storage) {
      await executeImportBulk(storage);
    }
  });

  // Export template command
  const exportTemplateCommand = vscode.commands.registerCommand(
    'wordslash.exportTemplate',
    async () => {
      await executeExportTemplate();
    }
  );

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

  // Open settings command
  const openSettingsCommand = vscode.commands.registerCommand('wordslash.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'wordslash');
  });

  context.subscriptions.push(
    openFlashcardsCommand,
    openDashboardCommand,
    addCardCommand,
    exportBackupCommand,
    importBackupCommand,
    importBulkCommand,
    exportTemplateCommand,
    devGenerateSampleCommand,
    openSettingsCommand
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
