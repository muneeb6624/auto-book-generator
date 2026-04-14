/**
 * Build context string from prior chapter rows (ordered by chapter_index).
 * @param {Array<{ chapter_index: number, summary: string | null }>} priorChapters
 */
export function buildPreviousSummariesContext(priorChapters) {
  if (!priorChapters?.length) return '';
  return priorChapters
    .filter((c) => c.summary && String(c.summary).trim())
    .map((c) => `Chapter ${c.chapter_index} summary:\n${c.summary.trim()}`)
    .join('\n\n');
}
