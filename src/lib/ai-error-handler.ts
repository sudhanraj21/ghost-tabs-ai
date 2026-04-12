import { getAISettings, setAISettings } from './ai-storage';

export enum AIErrorType {
  NO_API_KEY = 'NO_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AIError {
  type: AIErrorType;
  message: string;
  timestamp: number;
  retryable: boolean;
}

const ERROR_MESSAGES: Record<AIErrorType, string> = {
  [AIErrorType.NO_API_KEY]: 'No API key configured. Please add your Anthropic API key in settings.',
  [AIErrorType.INVALID_API_KEY]: 'Invalid API key. Please check your Anthropic API key in settings.',
  [AIErrorType.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [AIErrorType.TIMEOUT]: 'Request timed out. Please check your internet connection.',
  [AIErrorType.NETWORK_ERROR]: 'Network error. Please check your internet connection.',
  [AIErrorType.PARSE_ERROR]: 'Failed to parse AI response. Please try again.',
  [AIErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

export function getErrorMessage(type: AIErrorType): string {
  return ERROR_MESSAGES[type] || ERROR_MESSAGES[AIErrorType.UNKNOWN_ERROR];
}

export function isRetryableError(type: AIErrorType): boolean {
  return type === AIErrorType.RATE_LIMITED || 
         type === AIErrorType.TIMEOUT || 
         type === AIErrorType.NETWORK_ERROR;
}

export function getRetryDelay(type: AIErrorType, attemptCount: number = 1): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  
  switch (type) {
    case AIErrorType.RATE_LIMITED:
      return Math.min(baseDelay * Math.pow(2, attemptCount) * 5, maxDelay);
    case AIErrorType.TIMEOUT:
    case AIErrorType.NETWORK_ERROR:
      return Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    default:
      return 0;
  }
}

export async function handleAIError(error: unknown): Promise<AIError> {
  const errorObj: AIError = {
    type: AIErrorType.UNKNOWN_ERROR,
    message: 'An unexpected error occurred',
    timestamp: Date.now(),
    retryable: false,
  };

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      errorObj.type = AIErrorType.TIMEOUT;
      errorObj.message = 'Request timed out';
      errorObj.retryable = true;
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorObj.type = AIErrorType.NETWORK_ERROR;
      errorObj.message = 'Network error';
      errorObj.retryable = true;
    } else {
      errorObj.message = error.message;
    }
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    
    if (status === 401 || status === 403) {
      errorObj.type = AIErrorType.INVALID_API_KEY;
      errorObj.message = 'Invalid API key';
      errorObj.retryable = false;
    } else if (status === 429) {
      errorObj.type = AIErrorType.RATE_LIMITED;
      errorObj.message = 'Rate limited';
      errorObj.retryable = true;
    }
  }

  const settings = await getAISettings();
  await setAISettings({
    ...settings,
    lastError: errorObj.message,
    lastErrorTime: errorObj.timestamp,
  });

  console.error('[AI Error]', errorObj.type, errorObj.message);
  return errorObj;
}

export async function clearAIError(): Promise<void> {
  const settings = await getAISettings();
  await setAISettings({
    ...settings,
    lastError: undefined,
    lastErrorTime: undefined,
  });
}

export async function getLastAIError(): Promise<AIError | null> {
  const settings = await getAISettings();
  
  if (!settings.lastError || !settings.lastErrorTime) {
    return null;
  }

  return {
    type: AIErrorType.UNKNOWN_ERROR,
    message: settings.lastError,
    timestamp: settings.lastErrorTime,
    retryable: isRetryableError(AIErrorType.UNKNOWN_ERROR),
  };
}

export function shouldRetry(error: AIError, attemptCount: number, maxRetries: number = 3): boolean {
  if (!error.retryable) return false;
  if (attemptCount >= maxRetries) return false;
  return true;
}