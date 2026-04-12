import { getAISettings, setAIMetadata, buildAIRequest, parseAIResponse } from './ai-storage';
import { handleAIError, AIErrorType, clearAIError, shouldRetry, getRetryDelay } from './ai-error-handler';

const ENRICHMENT_PROMPT = `You are a smart tab assistant for a ghost tab manager. Analyze this browser tab and provide JSON metadata.

Current tab:
- Title: {title}
- URL: {url}
- Domain: {domain}
- Current Intent (may be wrong): {intent}
- Time parked: {parkedAt}
- Restore count: {restoreCount}

All ghost tabs (for duplicate detection):
{allTabs}

User context: {userContext}

IMPORTANT: If the current intent is "unknown" or generic, analyze the page properly and provide the correct intent.

Allowed intents (pick the BEST match):
- watch_later: video, streaming, movies, TV, entertainment
- learn_later: courses, tutorials, documentation, learning, articles
- read_later: blogs, news, articles, newsletters, reading content
- buy_later: shopping, products, e-commerce, prices, carts
- compare_later: comparisons, reviews, alternatives, vs pages
- work: coding, docs, tools, project management, business
- temporary: temp links, tests, localhost, quick references
- research: (create this if doing research on specific topics)
- finance: (create this for banking, investing, crypto)
- social: (create this for social media, messaging)
- news: (create this for news sites)

If none match, create a new intent that best describes this tab's content.

Respond with EXACTLY this JSON (no other text):
{
  "label": "short descriptive label (max 25 chars)",
  "summary": "one-line summary (max 80 chars)", 
  "cluster": "group name (max 25 chars)",
  "resume_reason": "why user might want to resume (max 70 chars)",
  "priority": number between 0 and 1,
  "duplicate_of": "tab ID if duplicate, else null",
  "similar_tabs": ["tab IDs if similar content, else []"],
  "custom_label": "personal label like 'Work - Project X' if applicable (max 30 chars)",
  "predicted_resume": boolean if likely next resume,
  "user_context": "morning/afternoon/evening/work/leisure context",
  "intent": "the correct intent (one of the allowed intents above, or a new one if needed)"
}`;

const PREDICTION_PROMPT = `You are a smart tab assistant. Analyze the user's tab history to predict which ghost tab they'll want to resume next.

Current time context: {timeContext}
Day: {dayOfWeek}
Recently active tabs: {recentTabs}
All ghost tabs: {allGhostTabs}

User patterns from history:
- {patterns}

Respond with EXACTLY this JSON:
{
  "predicted_tab_id": "ID of tab user likely wants next",
  "confidence": number 0-1,
  "reason": "short reason why (max 60 chars)",
  "alternative_tabs": ["IDs of other likely tabs"]
}`;

export async function enrichTabWithAI(tab: {
  id: string;
  title: string;
  url: string;
  domain: string;
  intent: string;
  parkedAt: number;
  restoreCount?: number;
  totalActiveTimeMs?: number;
}, allGhostTabs?: Array<{id: string; title: string; url: string}>): Promise<boolean> {
  try {
    const settings = await getAISettings();
    if (!settings.aiEnabled || !settings.aiAutoEnrichOnPark) {
      return false;
    }

    const request = buildAIRequest(tab);
    const userContext = getTimeContext();
    const allTabsStr = allGhostTabs?.map(t => `- ${t.title} (${t.url})`).join('\n') || 'None';

    const prompt = ENRICHMENT_PROMPT
      .replace('{title}', request.title || 'Untitled')
      .replace('{url}', request.url)
      .replace('{domain}', request.domain)
      .replace('{intent}', request.intent)
      .replace('{parkedAt}', new Date(request.parkedAt).toLocaleString())
      .replace('{restoreCount}', String(request.restoreCount || 0))
      .replace('{allTabs}', allTabsStr)
      .replace('{userContext}', userContext);

    const response = await callAI(prompt);
    
    if (!response) {
      console.warn('[AI] No response from AI service');
      return false;
    }

    const parsed = parseAIResponse(response);
    if (!parsed) {
      console.warn('[AI] Failed to parse AI response');
      return false;
    }

    await setAIMetadata(tab.id, {
      label: parsed.label,
      summary: parsed.summary,
      cluster: parsed.cluster,
      resumeReason: parsed.resumeReason,
      priorityScore: parsed.priority,
      similarTabs: parsed.similarTabs,
      duplicateOf: parsed.duplicateOf,
      customLabel: parsed.customLabel,
      predictedResume: parsed.predictedResume,
      userContext: parsed.userContext,
      aiIntent: parsed.intent,
    });

    console.log('[AI] Enriched tab:', tab.id, parsed.label);
    return true;
  } catch (error) {
    console.error('[AI] Enrichment failed:', error);
    return false;
  }
}

export async function predictNextResume(
  recentTabs: Array<{id: string; title: string; url: string}>,
  allGhostTabs: Array<{id: string; title: string; url: string; parkedAt: number; restoreCount?: number}>
): Promise<{tabId: string; confidence: number; reason: string} | null> {
  try {
    const settings = await getAISettings();
    if (!settings.aiEnabled || !settings.aiSmartPrediction) {
      return null;
    }

    const timeContext = getTimeContext();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const recentStr = recentTabs.slice(0, 5).map(t => `- ${t.title}`).join('\n');
    const allTabsStr = allGhostTabs.map(t => 
      `- ${t.title} (parked ${new Date(t.parkedAt).toLocaleDateString()}, restored ${t.restoreCount || 0} times)`
    ).join('\n');

    const prompt = PREDICTION_PROMPT
      .replace('{timeContext}', timeContext)
      .replace('{dayOfWeek}', dayOfWeek)
      .replace('{recentTabs}', recentStr || 'None')
      .replace('{allGhostTabs}', allTabsStr)
      .replace('{patterns}', 'User typically resumes work-related tabs in morning, entertainment in evening');

    const response = await callAI(prompt);
    if (!response) return null;

    const parsed = parsePredictionResponse(response);
    return parsed;
  } catch (error) {
    console.error('[AI] Prediction failed:', error);
    return null;
  }
}

function parsePredictionResponse(text: string): {tabId: string; confidence: number; reason: string} | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      tabId: parsed.predicted_tab_id || '',
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: parsed.reason || '',
    };
  } catch {
    return null;
  }
}

function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

async function callAI(prompt: string, retryCount: number = 0): Promise<string | null> {
  const settings = await getAISettings();
  const API_KEY = settings.aiApiKey || '';
  
  if (!API_KEY) {
    await handleAIError({ type: AIErrorType.NO_API_KEY, message: 'No API key configured', timestamp: Date.now(), retryable: false });
    console.warn('[AI] No API key configured');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn('[AI] Rate limited - too many requests');
      await handleAIError({ status: 429, type: AIErrorType.RATE_LIMITED });
      if (shouldRetry({ type: AIErrorType.RATE_LIMITED, message: 'Rate limited', timestamp: Date.now(), retryable: true }, retryCount)) {
        const delay = getRetryDelay(AIErrorType.RATE_LIMITED, retryCount);
        console.log(`[AI] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callAI(prompt, retryCount + 1);
      }
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      console.error('[AI] Invalid API key - check your settings');
      await handleAIError({ status: response.status, type: AIErrorType.INVALID_API_KEY });
      return null;
    }

    if (!response.ok) {
      console.warn('[AI] API request failed:', response.status, response.statusText);
      await handleAIError({ status: response.status, type: AIErrorType.UNKNOWN_ERROR });
      return null;
    }

    const data = await response.json();
    await clearAIError();
    return data.content?.[0]?.text || null;
  } catch (error) {
    const aiError = await handleAIError(error);
    if (shouldRetry(aiError, retryCount)) {
      const delay = getRetryDelay(aiError.type, retryCount);
      console.log(`[AI] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAI(prompt, retryCount + 1);
    }
    return null;
  }
}

export async function enrichTabAsync(tab: {
  id: string;
  title: string;
  url: string;
  domain: string;
  intent: string;
  parkedAt: number;
  restoreCount?: number;
  totalActiveTimeMs?: number;
}, allGhostTabs?: Array<{id: string; title: string; url: string}>): Promise<void> {
  setTimeout(() => {
    enrichTabWithAI(tab, allGhostTabs).catch(console.error);
  }, 1500);
}