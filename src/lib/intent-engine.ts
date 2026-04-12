import type { Intent, IntentRule } from './types';
import { getIntentOverrides } from './storage';

const DEFAULT_RULES: Omit<IntentRule, 'id'>[] = [
  { pattern: 'youtube\\.com|youtu\\.be|netflix\\.com|vimeo\\.com|twitch\\.tv|disneyplus\\.com|hbomax\\.com|primevideo\\.com|hulu\\.com|spotify\\.com|open.spotify', patternType: 'domain', intent: 'watch_later', confidence: 0.95, enabled: true },
  { pattern: 'watch|video|stream|player|movie|episode|series', patternType: 'url', intent: 'watch_later', confidence: 0.7, enabled: true },
  
  { pattern: 'udemy\\.com|coursera\\.org|udacity\\.com|edx\\.org|khanacademy\\.org|pluralsight\\.com|skillshare\\.com|linkedin\\.com/learning|udemy|pluralsight|skillshare', patternType: 'domain', intent: 'learn_later', confidence: 0.95, enabled: true },
  { pattern: 'codecademy\\.com|freecodecamp\\.org|scrimba\\.com|w3schools\\.com|javascript\\.info|mozilladev\\.mdn', patternType: 'domain', intent: 'learn_later', confidence: 0.95, enabled: true },
  { pattern: 'codecademy|freecodecamp|scrimba', patternType: 'url', intent: 'learn_later', confidence: 0.95, enabled: true },
  { pattern: 'documentation|tutorial|learn|course|guide|how-to|bootcamp|training', patternType: 'url', intent: 'learn_later', confidence: 0.8, enabled: true },
  { pattern: 'mozilla\\.org|reactjs\\.org|vuejs\\.org|angular\\.io|typescriptlang\\.org|python\\.org|rust-lang\\.org|nodejs\\.org', patternType: 'domain', intent: 'learn_later', confidence: 0.85, enabled: true },
  
  { pattern: 'wikipedia\\.org|wikiversity\\.org|britannica\\.com|thoughtco\\.com', patternType: 'domain', intent: 'learn_later', confidence: 0.9, enabled: true },
  { pattern: 'scholar\\.google|researchgate\\.net|arxiv\\.org|jstor\\.org', patternType: 'domain', intent: 'learn_later', confidence: 0.95, enabled: true },
  { pattern: 'khanacademy|IXL|quizlet|chegg|cengage', patternType: 'domain', intent: 'learn_later', confidence: 0.95, enabled: true },
  { pattern: 'saylor\\.org|oll\\.sc|openstax|merriam-webster|dictionary', patternType: 'domain', intent: 'learn_later', confidence: 0.85, enabled: true },
  { pattern: 'notion\\.so|evernote\\.com|onenote|oneNote', patternType: 'domain', intent: 'learn_later', confidence: 0.8, enabled: true },
  { pattern: 'study|lecture|assignment|homework|exam|revision', patternType: 'title', intent: 'learn_later', confidence: 0.85, enabled: true },
  { pattern: 'tutorial|lesson|chapter|course|lecture|module', patternType: 'title', intent: 'learn_later', confidence: 0.8, enabled: true },
  { pattern: 'learn|study|education|teaching|course', patternType: 'title', intent: 'learn_later', confidence: 0.75, enabled: true },
  
  { pattern: 'medium\\.com|dev\\.to|blog\\.|substack\\.com|hashnode\\.com', patternType: 'domain', intent: 'read_later', confidence: 0.85, enabled: true },
  { pattern: 'article|blog post', patternType: 'title', intent: 'read_later', confidence: 0.7, enabled: true },
  { pattern: 'news\\.|newspaper|magazine|reuters|bbc|cnn|nytimes|theguardian|wsj\\.com|forbes\\.com', patternType: 'domain', intent: 'read_later', confidence: 0.8, enabled: true },
  { pattern: 'reddit\\.com/r/|hackernews|ycombinator', patternType: 'domain', intent: 'read_later', confidence: 0.75, enabled: true },
  
  { pattern: 'amazon\\.|ebay\\.com|etsy\\.com|shopify|walmart\\.com|target\\.com|bestbuy\\.com|aliexpress\\.com|wish\\.com', patternType: 'domain', intent: 'buy_later', confidence: 0.95, enabled: true },
  { pattern: 'product|cart|checkout|/buy/|/shop/|/product/|/item/', patternType: 'url', intent: 'buy_later', confidence: 0.8, enabled: true },
  { pattern: 'flipkart\\.com|snapdeal\\.com|myntra\\.com|indiamart\\.com', patternType: 'domain', intent: 'buy_later', confidence: 0.95, enabled: true },
  
  { pattern: 'compare|comparison|/vs/|versus', patternType: 'url', intent: 'compare_later', confidence: 0.85, enabled: true },
  { pattern: 'g2\\.com|capterra\\.com|trustpilot\\.com|producthunt', patternType: 'domain', intent: 'compare_later', confidence: 0.8, enabled: true },
  
  { pattern: 'github\\.com|gitlab\\.com|bitbucket\\.org', patternType: 'domain', intent: 'work', confidence: 0.95, enabled: true },
  { pattern: 'jira|confluence|figma\\.com|slack\\.com|trello\\.com|asana\\.com|zoom\\.us', patternType: 'domain', intent: 'work', confidence: 0.9, enabled: true },
  { pattern: 'docs\\.google|office\\.com|sheets\\.google|slides\\.google|drive\\.google', patternType: 'domain', intent: 'work', confidence: 0.9, enabled: true },
  { pattern: 'linear\\.app|shortcut\\.io|basecamp\\.com|monday\\.com|clickup\\.com|teamwork\\.com', patternType: 'domain', intent: 'work', confidence: 0.9, enabled: true },
  { pattern: 'stack overflow|stackexchange|stackoverflow', patternType: 'domain', intent: 'work', confidence: 0.85, enabled: true },
  { pattern: 'upwork\\.com|freelancer\\.com|fiverr\\.com|toptal\\.com|peopleperhour', patternType: 'domain', intent: 'work', confidence: 0.95, enabled: true },
  { pattern: 'airtable\\.com|hubspot\\.com|salesforce\\.com|zendesk\\.com', patternType: 'domain', intent: 'work', confidence: 0.9, enabled: true },
  { pattern: 'project|report|presentation|spreadsheet', patternType: 'title', intent: 'work', confidence: 0.7, enabled: true },
  
  { pattern: 'temp|temporary|test|localhost|127\\.0\\.0\\.1', patternType: 'domain', intent: 'temporary', confidence: 0.95, enabled: true },
];

const rules = DEFAULT_RULES.map((rule, index) => ({
  ...rule,
  id: `rule-${index}`,
}));

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function classifyIntent(url: string, title: string): { intent: Intent; confidence: number } {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const domain = extractDomain(url);
  const lowerDomain = domain.toLowerCase();

  const scores: Record<Intent, number> = {
    watch_later: 0,
    learn_later: 0,
    read_later: 0,
    buy_later: 0,
    compare_later: 0,
    work: 0,
    temporary: 0,
    unknown: 0,
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let matches = false;
    switch (rule.patternType) {
      case 'domain':
        matches = new RegExp(rule.pattern, 'i').test(lowerDomain);
        break;
      case 'url':
        matches = new RegExp(rule.pattern, 'i').test(lowerUrl);
        break;
      case 'title':
        matches = new RegExp(rule.pattern, 'i').test(lowerTitle);
        break;
    }

    if (matches) {
      scores[rule.intent] += rule.confidence;
    }
  }

  let bestIntent: Intent = 'unknown';
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent as Intent;
    }
  }

  if (maxScore === 0) {
    return { intent: 'unknown', confidence: 0 };
  }

  const confidence = Math.min(maxScore, 1);
  return { intent: bestIntent, confidence };
}

export async function getIntentForUrl(url: string, title: string): Promise<{ intent: Intent; confidence: number }> {
  const overrides = await getIntentOverrides();
  const override = overrides.find(o => o.url === url);
  
  if (override) {
    return { intent: override.intent, confidence: 1 };
  }

  return classifyIntent(url, title);
}

export function getAllRules(): IntentRule[] {
  return [...rules];
}
