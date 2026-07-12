import type { RadarRun, RadarRunChangeSummary, ResearchItem } from "./types";
import { evaluateEvidenceCoverage } from "./workflows";

function titleKey(item: ResearchItem) {
  return item.title.trim().toLowerCase();
}

function qualityScore(item: ResearchItem) {
  const coverage = evaluateEvidenceCoverage(item);
  return coverage.primaryCount * 4 + coverage.highTrustCount * 2 + coverage.liveSearchCount - coverage.gaps.length;
}

const emptyChanges: RadarRunChangeSummary = {
  newOpportunities: [],
  repeatedOpportunities: [],
  newSourceUrls: [],
  removedSourceUrls: [],
  improvedEvidenceTitles: [],
  worsenedEvidenceTitles: [],
};

export function compareRadarRuns(previous: RadarRun | undefined, opportunities: ResearchItem[]): RadarRunChangeSummary {
  if (!previous) {
    return {
      ...emptyChanges,
      newOpportunities: opportunities.map((item) => item.title),
      newSourceUrls: opportunities.flatMap((item) => item.sources.map((source) => source.url)),
    };
  }

  const previousByTitle = new Map(previous.opportunities.map((item) => [titleKey(item), item]));
  const currentByTitle = new Map(opportunities.map((item) => [titleKey(item), item]));
  const previousUrls = new Set(previous.opportunities.flatMap((item) => item.sources.map((source) => source.url)));
  const currentUrls = new Set(opportunities.flatMap((item) => item.sources.map((source) => source.url)));

  const newOpportunities = opportunities.filter((item) => !previousByTitle.has(titleKey(item))).map((item) => item.title);
  const repeatedOpportunities = opportunities.filter((item) => previousByTitle.has(titleKey(item))).map((item) => item.title);
  const newSourceUrls = [...currentUrls].filter((url) => !previousUrls.has(url));
  const removedSourceUrls = [...previousUrls].filter((url) => !currentUrls.has(url));
  const improvedEvidenceTitles: string[] = [];
  const worsenedEvidenceTitles: string[] = [];

  currentByTitle.forEach((current, key) => {
    const previousItem = previousByTitle.get(key);
    if (!previousItem) return;
    const delta = qualityScore(current) - qualityScore(previousItem);
    if (delta > 0) improvedEvidenceTitles.push(current.title);
    if (delta < 0) worsenedEvidenceTitles.push(current.title);
  });

  return { newOpportunities, repeatedOpportunities, newSourceUrls, removedSourceUrls, improvedEvidenceTitles, worsenedEvidenceTitles };
}

export function createRadarRun(input: { mode: string; opportunities: ResearchItem[]; previousRun?: RadarRun; generatedAt?: string }): RadarRun {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const evidenceCoverages = input.opportunities.map(evaluateEvidenceCoverage);
  return {
    id: `radar-run-${Date.parse(generatedAt) || Date.now()}`,
    generatedAt,
    mode: input.mode,
    opportunityCount: input.opportunities.length,
    sourceCount: input.opportunities.reduce((count, item) => count + item.sources.length, 0),
    liveSourceCount: evidenceCoverages.reduce((count, coverage) => count + coverage.liveSearchCount, 0),
    primarySourceCount: evidenceCoverages.reduce((count, coverage) => count + coverage.primaryCount, 0),
    evidenceGapCount: evidenceCoverages.reduce((count, coverage) => count + coverage.gaps.length, 0),
    opportunities: input.opportunities,
    changes: compareRadarRuns(input.previousRun, input.opportunities),
  };
}
