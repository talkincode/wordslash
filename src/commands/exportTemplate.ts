// Command: Export bulk import template
// Generates a sample or empty JSON template for users to fill in

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { generateSampleTemplate, generateEmptyTemplate } from '../storage/bulkImport';

type TemplateType = 'sample' | 'empty';

/**
 * Execute export template command
 * Asks user for template type and save location
 */
export async function executeExportTemplate(): Promise<boolean> {
  // Step 1: Ask user for template type
  const templateChoice = await vscode.window.showQuickPick(
    [
      {
        label: '$(file-code) Sample Template',
        description: 'Template with example cards to learn the format',
        value: 'sample' as TemplateType,
      },
      {
        label: '$(file) Empty Template',
        description: 'Minimal template to fill in your own cards',
        value: 'empty' as TemplateType,
      },
    ],
    {
      placeHolder: 'Select template type',
      title: 'WordSlash: Export Bulk Import Template',
    }
  );

  if (!templateChoice) {
    return false; // User cancelled
  }

  // Step 2: Generate template
  const template =
    templateChoice.value === 'sample' ? generateSampleTemplate() : generateEmptyTemplate();

  // Step 3: Show save dialog
  const defaultFilename =
    templateChoice.value === 'sample' ? 'wordslash-sample.json' : 'wordslash-cards.json';

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(getDefaultSaveDir(), defaultFilename)),
    filters: {
      'JSON Files': ['json'],
    },
    title: 'Save bulk import template',
  });

  if (!saveUri) {
    return false; // User cancelled
  }

  // Step 4: Write file
  try {
    const content = JSON.stringify(template, null, 2);
    await fs.writeFile(saveUri.fsPath, content, 'utf-8');

    // Open the file in editor
    const document = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      `WordSlash: Template saved to ${path.basename(saveUri.fsPath)}`
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`WordSlash: Failed to save template - ${errorMessage}`);
    return false;
  }
}

/**
 * Get default save directory (workspace folder or home)
 */
function getDefaultSaveDir(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  return process.env.HOME || process.env.USERPROFILE || '/';
}
