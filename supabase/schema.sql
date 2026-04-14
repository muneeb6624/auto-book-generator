-- Run this in Supabase SQL Editor (new project).

create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes_on_outline_before text,
  outline text,
  notes_on_outline_after text,
  status_outline_notes text,
  outline_status text not null default 'draft',
  final_review_notes text,
  final_review_notes_status text,
  book_output_status text not null default 'paused',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_index int not null,
  title text not null,
  body text,
  summary text,
  chapter_notes text,
  chapter_notes_status text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, chapter_index)
);

create index if not exists chapters_book_id_idx on public.chapters (book_id);

alter table public.books disable row level security;
alter table public.chapters disable row level security;
