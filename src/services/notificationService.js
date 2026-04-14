import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

function smtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.notifyTo);
}

let transporter;
function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(subject, text) {
  const tx = getTransporter();
  if (!tx || !config.notifyTo) return;
  const from = config.smtp.from || config.smtp.user;
  await tx.sendMail({
    from,
    to: config.notifyTo,
    subject,
    text,
  });
}

export async function sendTeamsMessage(title, text) {
  if (!config.teamsWebhookUrl) return;
  const body = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: title,
    themeColor: '0078D4',
    title,
    text,
  };
  const res = await fetch(config.teamsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn('Teams webhook failed', res.status, await res.text());
  }
}

export async function notifyBoth(subject, text) {
  await Promise.allSettled([sendEmail(subject, text), sendTeamsMessage(subject, text)]);
}

export async function notifyOutlineReady(bookId, title) {
  const msg = `Outline generated for "${title}" (book ${bookId}). Review in app / set status_outline_notes.`;
  await notifyBoth(`Book outline ready: ${title}`, msg);
}

export async function notifyChapterWaitingNotes(bookId, chapterId, chapterTitle) {
  const msg = `Chapter "${chapterTitle}" (${chapterId}) is waiting for editor notes. Book ${bookId}.`;
  await notifyBoth(`Chapter waiting for notes: ${chapterTitle}`, msg);
}

export async function notifyFinalCompiled(bookId, title) {
  const msg = `Final draft compiled for "${title}" (book ${bookId}).`;
  await notifyBoth(`Book compiled: ${title}`, msg);
}

export async function notifyPausedOrError(subject, detail) {
  await notifyBoth(subject, detail);
}
