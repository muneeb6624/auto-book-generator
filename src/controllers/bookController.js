import { supabase } from '../db/supabaseClient.js';
import { generateOutline, planChapterTitlesFromOutline } from '../services/llmService.js';
import {
  OUTLINE_NOTE_STATUS,
  isValidTriStatus,
  outlineAllowsChapterPhase,
} from '../utils/status.js';
import * as notify from '../services/notificationService.js';

function nowIso() {
  return new Date().toISOString();
}

export async function createBook(req, res, next) {
  try {
    const { title, notes_on_outline_before } = req.body || {};
    if (!title || !String(title).trim()) {
      const e = new Error('title is required');
      e.status = 400;
      throw e;
    }
    const { data, error } = await supabase
      .from('books')
      .insert({
        title: String(title).trim(),
        notes_on_outline_before: notes_on_outline_before != null ? String(notes_on_outline_before) : null,
        outline_status: 'draft',
        book_output_status: 'paused',
        updated_at: nowIso(),
      })
      .select()
      .single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
}

export async function getBook(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !data) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function patchBook(req, res, next) {
  try {
    const { id } = req.params;
    const { title, notes_on_outline_before, notes_on_outline_after } = req.body || {};
    const patch = {};
    if (title !== undefined) {
      const t = String(title).trim();
      if (!t) {
        const e = new Error('title cannot be empty');
        e.status = 400;
        throw e;
      }
      patch.title = t;
    }
    if (notes_on_outline_before !== undefined) {
      patch.notes_on_outline_before =
        notes_on_outline_before != null ? String(notes_on_outline_before) : null;
    }
    if (notes_on_outline_after !== undefined) {
      patch.notes_on_outline_after =
        notes_on_outline_after != null ? String(notes_on_outline_after) : null;
    }
    if (Object.keys(patch).length === 0) {
      const e = new Error('No updatable fields provided');
      e.status = 400;
      throw e;
    }
    patch.updated_at = nowIso();
    const { data: updated, error } = await supabase
      .from('books')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error || !updated) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function generateOutlineHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !book) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    const before = (book.notes_on_outline_before || '').trim();
    if (!before) {
      const e = new Error('notes_on_outline_before is required before generating outline');
      e.status = 400;
      throw e;
    }
    const afterNotes = (book.notes_on_outline_after || '').trim();
    const promptNotes = afterNotes ? `${before}\n\nEditor feedback on previous outline:\n${afterNotes}` : before;

    const outline = await generateOutline({ title: book.title, notesBefore: promptNotes });

    let outline_status = 'waiting_review';
    const s = book.status_outline_notes;
    if (s === OUTLINE_NOTE_STATUS.NO_NOTES_NEEDED) outline_status = 'approved';
    else if (s === OUTLINE_NOTE_STATUS.YES || s === OUTLINE_NOTE_STATUS.NO || !s) outline_status = 'waiting_review';

    const { data: updated, error: upErr } = await supabase
      .from('books')
      .update({
        outline,
        outline_status,
        updated_at: nowIso(),
      })
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });

    await notify.notifyOutlineReady(id, book.title).catch(() => {});

    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function patchOutlineReview(req, res, next) {
  try {
    const { id } = req.params;
    const { status_outline_notes, notes_on_outline_after } = req.body || {};

    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !book) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    if (!(book.outline || '').trim()) {
      const e = new Error('No outline yet; generate outline first');
      e.status = 400;
      throw e;
    }

    const patch = { updated_at: nowIso() };
    if (notes_on_outline_after !== undefined) {
      patch.notes_on_outline_after = notes_on_outline_after != null ? String(notes_on_outline_after) : null;
    }
    if (status_outline_notes !== undefined) {
      if (!isValidTriStatus(status_outline_notes)) {
        const e = new Error('status_outline_notes must be yes, no, or no_notes_needed');
        e.status = 400;
        throw e;
      }
      patch.status_outline_notes = status_outline_notes;
    }

    if (patch.status_outline_notes === OUTLINE_NOTE_STATUS.NO_NOTES_NEEDED) {
      patch.outline_status = 'approved';
    } else if (patch.status_outline_notes === OUTLINE_NOTE_STATUS.YES) {
      patch.outline_status = 'waiting_review';
    } else if (patch.status_outline_notes === OUTLINE_NOTE_STATUS.NO) {
      patch.outline_status = 'paused';
      await notify
        .notifyPausedOrError(
          `Book outline paused: ${book.title}`,
          `Book ${id}: status_outline_notes is "no" or paused until changed.`
        )
        .catch(() => {});
    }

    const { data: updated, error: upErr } = await supabase
      .from('books')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function planChapters(req, res, next) {
  try {
    const { id } = req.params;
    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !book) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    if (!outlineAllowsChapterPhase(book.status_outline_notes)) {
      const e = new Error(
        'Cannot plan chapters until status_outline_notes is no_notes_needed (editor gate)'
      );
      e.status = 400;
      throw e;
    }
    if (!(book.outline || '').trim()) {
      const e = new Error('Outline missing');
      e.status = 400;
      throw e;
    }

    const plan = await planChapterTitlesFromOutline({ title: book.title, outline: book.outline });

    await supabase.from('chapters').delete().eq('book_id', id);

    const rows = plan.map((p) => ({
      book_id: id,
      chapter_index: p.index,
      title: p.title,
      body: null,
      summary: null,
      chapter_notes: null,
      chapter_notes_status: null,
      status: 'pending',
      updated_at: nowIso(),
    }));

    const { data: inserted, error: insErr } = await supabase.from('chapters').insert(rows).select();
    if (insErr) throw Object.assign(new Error(insErr.message), { status: 500 });

    res.status(201).json({ book_id: id, chapters: inserted });
  } catch (e) {
    next(e);
  }
}

/** Demo helper: set chapter_notes_status to no_notes_needed for all pending chapters (PDF empty = pause). */
export async function unlockAllChapters(req, res, next) {
  try {
    const { id } = req.params;
    const { data: book, error } = await supabase.from('books').select('id').eq('id', id).single();
    if (error || !book) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    const { data, error: upErr } = await supabase
      .from('chapters')
      .update({
        chapter_notes_status: 'no_notes_needed',
        status: 'pending',
        updated_at: nowIso(),
      })
      .eq('book_id', id)
      .is('body', null)
      .select();
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });
    res.json({ updated: data?.length ?? 0, chapters: data });
  } catch (e) {
    next(e);
  }
}

export async function patchFinalReview(req, res, next) {
  try {
    const { id } = req.params;
    const { final_review_notes_status, final_review_notes } = req.body || {};

    const patch = { updated_at: nowIso() };
    if (final_review_notes !== undefined) {
      patch.final_review_notes = final_review_notes != null ? String(final_review_notes) : null;
    }
    if (final_review_notes_status !== undefined) {
      if (!isValidTriStatus(final_review_notes_status)) {
        const e = new Error('final_review_notes_status must be yes, no, or no_notes_needed');
        e.status = 400;
        throw e;
      }
      patch.final_review_notes_status = final_review_notes_status;
    }

    const { data: updated, error } = await supabase
      .from('books')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error || !updated) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
}
