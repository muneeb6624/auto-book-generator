import { supabase } from '../db/supabaseClient.js';
import { generateChapterBody, summarizeChapter } from '../services/llmService.js';
import { buildPreviousSummariesContext } from '../services/summaryService.js';
import {
  CHAPTER_NOTE_STATUS,
  isValidTriStatus,
} from '../utils/status.js';
import * as notify from '../services/notificationService.js';

function nowIso() {
  return new Date().toISOString();
}

export async function patchChapterNotes(req, res, next) {
  try {
    const { id } = req.params;
    const { chapter_notes, chapter_notes_status } = req.body || {};
    const patch = { updated_at: nowIso() };
    if (chapter_notes !== undefined) {
      patch.chapter_notes = chapter_notes != null ? String(chapter_notes) : null;
    }
    if (chapter_notes_status !== undefined) {
      if (!isValidTriStatus(chapter_notes_status)) {
        const e = new Error('chapter_notes_status must be yes, no, or no_notes_needed');
        e.status = 400;
        throw e;
      }
      patch.chapter_notes_status = chapter_notes_status;
      if (chapter_notes_status === CHAPTER_NOTE_STATUS.YES) {
        patch.status = 'waiting_notes';
      } else if (chapter_notes_status === CHAPTER_NOTE_STATUS.NO) {
        patch.status = 'paused';
      } else if (chapter_notes_status === CHAPTER_NOTE_STATUS.NO_NOTES_NEEDED) {
        patch.status = 'pending';
      }
    }

    const { data: updated, error } = await supabase
      .from('chapters')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error || !updated) {
      const e = new Error('Chapter not found');
      e.status = 404;
      throw e;
    }

    if (updated.chapter_notes_status === CHAPTER_NOTE_STATUS.YES) {
      await notify.notifyChapterWaitingNotes(updated.book_id, id, updated.title).catch(() => {});
    }
    if (updated.chapter_notes_status === CHAPTER_NOTE_STATUS.NO) {
      await notify
        .notifyPausedOrError(
          `Chapter paused: ${updated.title}`,
          `Chapter ${id} on book ${updated.book_id}: chapter_notes_status is "no".`
        )
        .catch(() => {});
    }

    res.json(updated);
  } catch (e) {
    next(e);
  }
}

function canGenerateChapter(ch) {
  const st = ch.chapter_notes_status;
  if (!st || st === CHAPTER_NOTE_STATUS.NO) return { ok: false, reason: 'paused_or_empty_status' };
  if (st === CHAPTER_NOTE_STATUS.NO_NOTES_NEEDED) return { ok: true };
  if (st === CHAPTER_NOTE_STATUS.YES) {
    if ((ch.chapter_notes || '').trim()) return { ok: true };
    return { ok: false, reason: 'waiting_for_chapter_notes' };
  }
  return { ok: false, reason: 'invalid' };
}

export async function generateChapter(req, res, next) {
  try {
    const { id } = req.params;
    const { data: chapter, error } = await supabase.from('chapters').select('*').eq('id', id).single();
    if (error || !chapter) {
      const e = new Error('Chapter not found');
      e.status = 404;
      throw e;
    }

    const gate = canGenerateChapter(chapter);
    if (!gate.ok) {
      const e = new Error(
        gate.reason === 'waiting_for_chapter_notes'
          ? 'chapter_notes_status is yes: add chapter_notes before generating'
          : 'Chapter is gated: set chapter_notes_status to no_notes_needed or address pause'
      );
      e.status = 400;
      throw e;
    }

    const { data: book, error: bookErr } = await supabase
      .from('books')
      .select('*')
      .eq('id', chapter.book_id)
      .single();
    if (bookErr || !book || !(book.outline || '').trim()) {
      const e = new Error('Book or outline missing');
      e.status = 400;
      throw e;
    }

    const { data: prior, error: priorErr } = await supabase
      .from('chapters')
      .select('chapter_index, summary')
      .eq('book_id', chapter.book_id)
      .lt('chapter_index', chapter.chapter_index)
      .order('chapter_index', { ascending: true });
    if (priorErr) throw Object.assign(new Error(priorErr.message), { status: 500 });

    const previousSummariesContext = buildPreviousSummariesContext(prior || []);

    const body = await generateChapterBody({
      bookTitle: book.title,
      outline: book.outline,
      chapterTitle: chapter.title,
      chapterIndex: chapter.chapter_index,
      previousSummariesContext,
      chapterNotes: chapter.chapter_notes,
    });

    const summary = await summarizeChapter({
      bookTitle: book.title,
      chapterTitle: chapter.title,
      chapterBody: body,
    });

    const { data: updated, error: upErr } = await supabase
      .from('chapters')
      .update({
        body,
        summary,
        status: 'complete',
        updated_at: nowIso(),
      })
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });

    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function listChaptersForBook(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('chapters')
      .select('id, book_id, chapter_index, title, status, chapter_notes_status, summary, body, updated_at')
      .eq('book_id', id)
      .order('chapter_index', { ascending: true });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    res.json(data || []);
  } catch (e) {
    next(e);
  }
}
