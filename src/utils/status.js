/** PDF: yes = wait for notes, no_notes_needed = proceed, no or empty = pause */

export const OUTLINE_NOTE_STATUS = {
  YES: 'yes',
  NO: 'no',
  NO_NOTES_NEEDED: 'no_notes_needed',
};

export const CHAPTER_NOTE_STATUS = OUTLINE_NOTE_STATUS;

export function isValidTriStatus(value) {
  return (
    value === OUTLINE_NOTE_STATUS.YES ||
    value === OUTLINE_NOTE_STATUS.NO ||
    value === OUTLINE_NOTE_STATUS.NO_NOTES_NEEDED
  );
}

export function outlineBlocksProgress(statusOutlineNotes) {
  if (!statusOutlineNotes) return true;
  if (statusOutlineNotes === OUTLINE_NOTE_STATUS.NO) return true;
  if (statusOutlineNotes === OUTLINE_NOTE_STATUS.YES) return true;
  return false;
}

export function outlineAllowsChapterPhase(statusOutlineNotes) {
  return statusOutlineNotes === OUTLINE_NOTE_STATUS.NO_NOTES_NEEDED;
}

export function chapterBlocksGeneration(chapterNotesStatus) {
  if (!chapterNotesStatus) return true;
  if (chapterNotesStatus === CHAPTER_NOTE_STATUS.NO) return true;
  if (chapterNotesStatus === CHAPTER_NOTE_STATUS.YES) return true;
  return false;
}

export function chapterAllowsAutoProceed(chapterNotesStatus) {
  return chapterNotesStatus === CHAPTER_NOTE_STATUS.NO_NOTES_NEEDED;
}

/**
 * Compile only if:
 * - final_review_notes_status = no_notes_needed
 * OR notes exist for final draft (non-empty final_review_notes)
 */
export function canCompileBook(book) {
  const status = book.final_review_notes_status;
  const notes = (book.final_review_notes || '').trim();
  if (status === OUTLINE_NOTE_STATUS.NO_NOTES_NEEDED) return true;
  if (notes.length > 0) return true;
  return false;
}
