import { config } from '../config/env.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function generateText(prompt, options = {}) {
  const model = options.model || config.geminiModel;
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'Gemini request failed';
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) {
    const err = new Error('Empty response from Gemini');
    err.status = 502;
    throw err;
  }
  return text.trim();
}

export async function generateOutline({ title, notesBefore }) {
  const prompt = `You are a professional book editor. Create a clear, structured outline for a book.

Book title: ${title}
Editor notes / direction (must be reflected): ${notesBefore}

Return only the outline with numbered major sections and bullet sub-points where useful. No preamble.`;
  return generateText(prompt);
}

/**
 * Returns JSON string from model; caller parses. Asks for strict JSON array.
 */
export async function planChapterTitlesFromOutline({ title, outline }) {
  const prompt = `Given this book title and outline, respond with ONLY valid JSON (no markdown fences): an array of objects with keys "index" (1-based integer) and "title" (short chapter title string). Use 4 to 8 chapters unless the outline clearly needs fewer.

Title: ${title}

Outline:
${outline}`;
  const raw = await generateText(prompt, { temperature: 0.4 });
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
    else throw Object.assign(new Error('Could not parse chapter plan JSON'), { status: 502 });
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw Object.assign(new Error('Invalid chapter plan from model'), { status: 502 });
  }
  return parsed
    .map((row, i) => ({
      index: Number(row.index) || i + 1,
      title: String(row.title || `Chapter ${i + 1}`).slice(0, 500),
    }))
    .sort((a, b) => a.index - b.index);
}

export async function generateChapterBody({
  bookTitle,
  outline,
  chapterTitle,
  chapterIndex,
  previousSummariesContext,
  chapterNotes,
}) {
  const notesBlock = chapterNotes?.trim()
    ? `Editor notes for this chapter (address carefully):\n${chapterNotes.trim()}\n`
    : '';

  const contextBlock = previousSummariesContext?.trim()
    ? `Summaries of previous chapters (continuity context):\n${previousSummariesContext.trim()}\n`
    : 'This is the first chapter; no prior summaries.\n';

  const prompt = `Using the following chapter summaries and outline, write the full prose for one chapter of the book. Match tone and continuity. Use clear sections if appropriate. Do not include the chapter title as a heading unless it fits naturally.

Book title: ${bookTitle}

Outline (reference):
${outline}

${contextBlock}
${notesBlock}
Write Chapter ${chapterIndex}: "${chapterTitle}"

Output only the chapter text.`;
  return generateText(prompt, { maxOutputTokens: 12000 });
}

export async function summarizeChapter({ bookTitle, chapterTitle, chapterBody }) {
  const prompt = `Summarize the following chapter in 2-4 tight paragraphs for use as context when writing later chapters. Focus on plot points, arguments, and entities introduced. No preamble.

Book: ${bookTitle}
Chapter: ${chapterTitle}

Chapter text:
${chapterBody.slice(0, 120000)}`;

  return generateText(prompt, { temperature: 0.3, maxOutputTokens: 2048 });
}
