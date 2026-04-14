import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { supabase } from '../db/supabaseClient.js';
import { canCompileBook } from '../utils/status.js';
import * as notify from '../services/notificationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.join(__dirname, '..', '..', 'outputs');

function nowIso() {
  return new Date().toISOString();
}

export async function compileBook(req, res, next) {
  try {
    const { id } = req.params;
    const format = (req.query.format || 'txt').toLowerCase();

    const { data: book, error: bookErr } = await supabase.from('books').select('*').eq('id', id).single();
    if (bookErr || !book) {
      const e = new Error('Book not found');
      e.status = 404;
      throw e;
    }

    if (!canCompileBook(book)) {
      const e = new Error(
        'Compile blocked: set final_review_notes_status to no_notes_needed and/or add final_review_notes (see PDF gate)'
      );
      e.status = 400;
      throw e;
    }

    const { data: chapters, error: chErr } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', id)
      .order('chapter_index', { ascending: true });
    if (chErr) throw Object.assign(new Error(chErr.message), { status: 500 });
    if (!chapters?.length) {
      const e = new Error('No chapters to compile');
      e.status = 400;
      throw e;
    }

    const incomplete = chapters.filter((c) => c.status !== 'complete' || !(c.body || '').trim());
    if (incomplete.length) {
      const e = new Error('All chapters must be complete with body before compile');
      e.status = 400;
      throw e;
    }

    const lines = [`# ${book.title}`, '', ...chapters.flatMap((c) => [`## Chapter ${c.chapter_index}: ${c.title}`, '', c.body, '', ''])];

    const text = lines.join('\n').trim() + '\n';

    await fs.mkdir(outputsDir, { recursive: true });
    const baseName = `${id.slice(0, 8)}-${Date.now()}`;
    const txtPath = path.join(outputsDir, `${baseName}.txt`);
    await fs.writeFile(txtPath, text, 'utf8');

    let docxPath = null;
    if (format === 'docx' || format === 'both') {
      const children = [];
      children.push(
        new Paragraph({
          children: [new TextRun({ text: book.title, bold: true, size: 32 })],
        })
      );
      for (const c of chapters) {
        children.push(new Paragraph({ text: '' }));
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Chapter ${c.chapter_index}: ${c.title}`, bold: true, size: 26 }),
            ],
          })
        );
        for (const para of (c.body || '').split(/\n\n+/)) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: para.trim(), size: 22 })],
            })
          );
        }
      }
      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      docxPath = path.join(outputsDir, `${baseName}.docx`);
      await fs.writeFile(docxPath, buffer);
    }

    const { data: updatedBook, error: upErr } = await supabase
      .from('books')
      .update({ book_output_status: 'compiled', updated_at: nowIso() })
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 500 });

    await notify.notifyFinalCompiled(id, book.title).catch(() => {});

    if (format === 'docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${book.title.replace(/[^\w\-]+/g, '_')}.docx"`);
      const buf = await fs.readFile(docxPath);
      return res.send(buf);
    }

    if (format === 'both') {
      return res.json({
        book: updatedBook,
        files: { txt: txtPath, docx: docxPath },
        preview: text.slice(0, 2000),
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${book.title.replace(/[^\w\-]+/g, '_')}.txt"`);
    res.send(text);
  } catch (e) {
    next(e);
  }
}
