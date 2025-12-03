// Command: Add card from editor selection
// This module contains VS Code API calls

import * as vscode from 'vscode';
import { createCard, type CardFront, type CardContext } from '../storage/schema';
import { JsonlStorage } from '../storage/storage';

/**
 * Options for extracting term from editor
 */
export interface ExtractOptions {
  storeFilePath: boolean;
}

/**
 * Result of extracting term from editor
 */
export interface ExtractResult {
  term: string;
  example?: string;
  context?: CardContext;
}

/**
 * Extract term and context from the active editor
 */
export function getTermFromEditor(
  editor: vscode.TextEditor,
  options: ExtractOptions = { storeFilePath: false }
): ExtractResult | null {
  const selection = editor.selection;
  const document = editor.document;

  // Get selected text or word at cursor
  let term: string;
  if (!selection.isEmpty) {
    term = document.getText(selection).trim();
  } else {
    // Get word at cursor position
    const wordRange = document.getWordRangeAtPosition(selection.active);
    if (!wordRange) {
      return null;
    }
    term = document.getText(wordRange).trim();
  }

  if (!term) {
    return null;
  }

  // Get the line text as example
  const line = document.lineAt(selection.active.line);
  const example = line.text.trim();

  // Build context
  const context: CardContext = {
    langId: document.languageId,
    lineText: example,
  };

  if (options.storeFilePath) {
    context.filePath = document.uri.fsPath;
  }

  return {
    term,
    example: example !== term ? example : undefined,
    context,
  };
}

/**
 * Infer card type from term
 */
function inferCardType(term: string): 'word' | 'phrase' | 'sentence' {
  const wordCount = term.split(/\s+/).length;
  if (wordCount === 1) {
    return 'word';
  } else if (wordCount <= 5) {
    return 'phrase';
  } else {
    return 'sentence';
  }
}

/**
 * Execute the add card command
 */
export async function executeAddCard(
  storage: JsonlStorage,
  editor?: vscode.TextEditor
): Promise<boolean> {
  const activeEditor = editor || vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showWarningMessage('WordSlash: No active editor.');
    return false;
  }

  // Get privacy setting
  const config = vscode.workspace.getConfiguration('wordslash');
  const storeFilePath = config.get<boolean>('privacy.storeFilePath', false);

  // Extract term from editor
  const result = getTermFromEditor(activeEditor, { storeFilePath });

  if (!result) {
    vscode.window.showWarningMessage('WordSlash: Please select some text or place cursor on a word.');
    return false;
  }

  // Create card
  const front: CardFront = {
    term: result.term,
    example: result.example,
    context: result.context,
  };

  const cardType = inferCardType(result.term);
  const card = createCard({ type: cardType, front });

  // Save to storage
  try {
    await storage.appendCard(card);
    vscode.window.showInformationMessage(`WordSlash: Added "${result.term}" to flashcards.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`WordSlash: Failed to save card - ${message}`);
    return false;
  }
}
