import { GhostTab } from './types';
import { getAIMetadata, getAISettings } from './ai-storage';

export async function getAIRankingScore(tab: GhostTab): Promise<number> {
  try {
    const settings = await getAISettings();
    if (!settings.aiEnabled) {
      return 0;
    }

    const aiMeta = await getAIMetadata(tab.id);
    if (!aiMeta?.priorityScore) {
      return 0;
    }

    return aiMeta.priorityScore;
  } catch {
    return 0;
  }
}

export async function sortTabsWithAI(tabs: GhostTab[]): Promise<GhostTab[]> {
  const settings = await getAISettings();
  if (!settings.aiEnabled) {
    return tabs;
  }

  const tabsWithAI = await Promise.all(
    tabs.map(async (tab) => {
      const aiScore = await getAIRankingScore(tab);
      return { tab, aiScore };
    })
  );

  return tabsWithAI
    .sort((a, b) => {
      if (a.aiScore > 0 && b.aiScore > 0) {
        return b.aiScore - a.aiScore;
      }
      if (a.aiScore > 0) return -1;
      if (b.aiScore > 0) return 1;
      return 0;
    })
    .map((item) => item.tab);
}

export async function getResumeTabsFromAI(tabs: GhostTab[], limit = 3): Promise<GhostTab[]> {
  const settings = await getAISettings();
  if (!settings.aiEnabled) {
    return [];
  }

  const tabsWithScores = await Promise.all(
    tabs.map(async (tab) => {
      const aiMeta = await getAIMetadata(tab.id);
      return {
        tab,
        score: aiMeta?.priorityScore || 0,
        reason: aiMeta?.resumeReason || '',
      };
    })
  );

  return tabsWithScores
    .filter((item) => item.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.tab);
}

export async function getTabCluster(tabId: string): Promise<string | null> {
  const meta = await getAIMetadata(tabId);
  return meta?.cluster || null;
}

export async function groupTabsByCluster(tabs: GhostTab[]): Promise<Record<string, GhostTab[]>> {
  const settings = await getAISettings();
  if (!settings.aiEnabled) {
    return {};
  }

  const clusters: Record<string, GhostTab[]> = {};
  
  for (const tab of tabs) {
    const cluster = await getTabCluster(tab.id);
    if (cluster) {
      if (!clusters[cluster]) clusters[cluster] = [];
      clusters[cluster].push(tab);
    }
  }

  return clusters;
}