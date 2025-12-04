// Common utilities - Logger
// This module provides a centralized logging system

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initialize the logger with an output channel
 */
export function initLogger(channel: vscode.OutputChannel) {
  outputChannel = channel;
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Current log level (configurable)
 */
let currentLogLevel = LogLevel.INFO;

/**
 * Set the log level
 */
export function setLogLevel(level: LogLevel) {
  currentLogLevel = level;
}

/**
 * Log a debug message
 */
export function logDebug(message: string, ...args: unknown[]) {
  if (currentLogLevel <= LogLevel.DEBUG) {
    log('DEBUG', message, ...args);
  }
}

/**
 * Log an info message
 */
export function logInfo(message: string, ...args: unknown[]) {
  if (currentLogLevel <= LogLevel.INFO) {
    log('INFO', message, ...args);
  }
}

/**
 * Log a warning message
 */
export function logWarn(message: string, ...args: unknown[]) {
  if (currentLogLevel <= LogLevel.WARN) {
    log('WARN', message, ...args);
  }
}

/**
 * Log an error message
 */
export function logError(message: string, error?: Error | unknown) {
  if (currentLogLevel <= LogLevel.ERROR) {
    if (error instanceof Error) {
      log('ERROR', `${message}: ${error.message}`, error.stack);
    } else {
      log('ERROR', message, error);
    }
  }
}

/**
 * Internal log function
 */
function log(level: string, message: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (outputChannel) {
    outputChannel.appendLine(formattedMessage);
    if (args.length > 0) {
      outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }
  
  // In development, also log to console
  if (process.env.NODE_ENV === 'development') {
    console.log(formattedMessage, ...args);
  }
}
