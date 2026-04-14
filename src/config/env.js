import dotenv from 'dotenv';

// Default loads `.env`; many setups keep secrets in `.env.local` only.
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

function optional(name, fallback = '') {
  const v = process.env[name];
  return v != null && String(v).trim() ? String(v).trim() : fallback;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  // Free tier often has quota for 1.5-flash / 2.0-flash-lite but *not* for `gemini-2.0-flash` (limit: 0).
  // Override with GEMINI_MODEL in .env.local — pick a model that shows non-zero limits in AI Studio → Rate limits.
  geminiModel: optional('GEMINI_MODEL', 'gemini-1.5-flash'),
  teamsWebhookUrl: optional('TEAMS_WEBHOOK_URL'),
  smtp: {
    host: optional('SMTP_HOST'),
    port: Number(optional('SMTP_PORT', '587')) || 587,
    secure: optional('SMTP_SECURE', 'false') === 'true',
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
    from: optional('SMTP_FROM'),
  },
  notifyTo: optional('NOTIFY_TO'),
};

export function assertCoreEnv() {
  required('SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY');
  required('GEMINI_API_KEY');
}
