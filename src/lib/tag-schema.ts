export const DEFAULT_TAG_SCHEMA = [
  'milestone',
  'daily_life',
  'family',
  'planning',
  'finances',
  'travel',
  'affection',
  'conflict_resolution'
] as const;

export type DefaultTag = (typeof DEFAULT_TAG_SCHEMA)[number];

// Stable color hints — kept in sync between badges and chip strip.
export const TAG_COLORS: Record<string, string> = {
  milestone: '#ec4899',
  daily_life: '#64748b',
  family: '#f59e0b',
  planning: '#10b981',
  finances: '#0ea5e9',
  travel: '#8b5cf6',
  affection: '#ef4444',
  conflict_resolution: '#a3a3a3'
};

export function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? '#94a3b8';
}
