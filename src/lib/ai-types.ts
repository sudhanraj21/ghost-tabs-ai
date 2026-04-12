export interface AIMetadata {
  tabId: string;
  label?: string;
  summary?: string;
  cluster?: string;
  resumeReason?: string;
  priorityScore?: number;
  lastUpdatedAt?: number;
  similarTabs?: string[];
  duplicateOf?: string;
  customLabel?: string;
  predictedResume?: boolean;
  userContext?: string;
  aiIntent?: string;
}

export interface AIEnrichmentRequest {
  tabId: string;
  title: string;
  url: string;
  domain: string;
  intent: string;
  parkedAt: number;
  restoreCount?: number;
  totalActiveTimeMs?: number;
  allTabs?: AIEnrichmentRequest[];
  userTimeContext?: string;
}

export interface AIEnrichmentResponse {
  label?: string;
  summary?: string;
  cluster?: string;
  resumeReason?: string;
  priority: number;
  similarTabs?: string[];
  duplicateOf?: string;
  customLabel?: string;
  predictedResume?: boolean;
  userContext?: string;
  intent?: string;
}

export interface AISettings {
  aiEnabled: boolean;
  aiMode: 'metadata_only' | 'smart_resume' | 'full';
  aiAutoEnrichOnPark: boolean;
  aiApiKey?: string;
  aiDuplicateDetection: boolean;
  aiAutoLabeling: boolean;
  aiSmartPrediction: boolean;
  lastError?: string;
  lastErrorTime?: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  aiEnabled: false,
  aiMode: 'metadata_only',
  aiAutoEnrichOnPark: false,
  aiDuplicateDetection: true,
  aiAutoLabeling: true,
  aiSmartPrediction: true,
};