import { AIMetadata, AIEnrichmentRequest, AIEnrichmentResponse, AISettings, DEFAULT_AI_SETTINGS } from './ai-types';

const AI_METADATA_KEY = 'ghosttabs_ai_metadata';
const AI_SETTINGS_KEY = 'ghosttabs_ai_settings';

export async function getAISettings(): Promise<AISettings> {
  const result = await chrome.storage.local.get(AI_SETTINGS_KEY);
  return result[AI_SETTINGS_KEY] || DEFAULT_AI_SETTINGS;
}

export async function setAISettings(settings: AISettings): Promise<void> {
  await chrome.storage.local.set({ [AI_SETTINGS_KEY]: settings });
}

export async function getAIMetadata(tabId: string): Promise<AIMetadata | null> {
  const result = await chrome.storage.local.get(AI_METADATA_KEY);
  const allMetadata = result[AI_METADATA_KEY] || {};
  return allMetadata[tabId] || null;
}

export async function getAllAIMetadata(): Promise<Record<string, AIMetadata>> {
  const result = await chrome.storage.local.get(AI_METADATA_KEY);
  return result[AI_METADATA_KEY] || {};
}

export async function setAIMetadata(tabId: string, metadata: Partial<AIMetadata>): Promise<void> {
  const result = await chrome.storage.local.get(AI_METADATA_KEY);
  const allMetadata = result[AI_METADATA_KEY] || {};
  allMetadata[tabId] = {
    ...allMetadata[tabId],
    ...metadata,
    tabId,
    lastUpdatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [AI_METADATA_KEY]: allMetadata });
}

export async function deleteAIMetadata(tabId: string): Promise<void> {
  const result = await chrome.storage.local.get(AI_METADATA_KEY);
  const allMetadata = result[AI_METADATA_KEY] || {};
  delete allMetadata[tabId];
  await chrome.storage.local.set({ [AI_METADATA_KEY]: allMetadata });
}

export function buildAIRequest(tab: {
  id: string;
  title: string;
  url: string;
  domain: string;
  intent: string;
  parkedAt: number;
  restoreCount?: number;
  totalActiveTimeMs?: number;
}): AIEnrichmentRequest {
  return {
    tabId: tab.id,
    title: tab.title,
    url: tab.url,
    domain: tab.domain,
    intent: tab.intent,
    parkedAt: tab.parkedAt,
    restoreCount: tab.restoreCount,
    totalActiveTimeMs: tab.totalActiveTimeMs,
  };
}

export function parseAIResponse(responseText: string): AIEnrichmentResponse | null {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      label: parsed.label,
      summary: parsed.summary,
      cluster: parsed.cluster,
      resumeReason: parsed.resume_reason,
      priority: typeof parsed.priority === 'number' ? Math.max(0, Math.min(1, parsed.priority)) : 0.5,
      similarTabs: parsed.similar_tabs || [],
      duplicateOf: parsed.duplicate_of || undefined,
      customLabel: parsed.custom_label || undefined,
      predictedResume: parsed.predicted_resume || false,
      userContext: parsed.user_context || undefined,
      intent: parsed.intent || undefined,
    };
  } catch {
    return null;
  }
}