# Demo API sequence (PowerShell). Set $base and $env:GEMINI_API_KEY / Supabase first.
# 1) Run schema in Supabase SQL Editor: supabase/schema.sql
# 2) Copy .env.example -> .env and fill values
# 3) npm run dev
# 4) Run this script (adjust $base if needed)

$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"

$r = Invoke-RestMethod -Method Post -Uri "$base/api/books" -ContentType "application/json" -Body (@{
  title = "Demo Book"
  notes_on_outline_before = "Non-fiction, 4 parts, focus on habits and systems."
} | ConvertTo-Json)
$bookId = $r.id
Write-Host "Created book $bookId"

Invoke-RestMethod -Method Post -Uri "$base/api/books/$bookId/outline/generate" | Out-Null
Write-Host "Outline generated"

Invoke-RestMethod -Method Patch -Uri "$base/api/books/$bookId/outline/review" -ContentType "application/json" -Body (@{
  status_outline_notes = "no_notes_needed"
} | ConvertTo-Json) | Out-Null
Write-Host "Outline approved"

Invoke-RestMethod -Method Post -Uri "$base/api/books/$bookId/chapters/plan" | Out-Null
Write-Host "Chapters planned"

Invoke-RestMethod -Method Post -Uri "$base/api/books/$bookId/chapters/unlock-all" | Out-Null
Write-Host "Chapters unlocked (no_notes_needed)"

$chapters = Invoke-RestMethod -Method Get -Uri "$base/api/books/$bookId/chapters"
foreach ($ch in $chapters) {
  Invoke-RestMethod -Method Post -Uri "$base/api/chapters/$($ch.id)/generate" | Out-Null
  Write-Host "Generated chapter $($ch.chapter_index)"
}

Invoke-RestMethod -Method Patch -Uri "$base/api/books/$bookId/final-review" -ContentType "application/json" -Body (@{
  final_review_notes_status = "no_notes_needed"
} | ConvertTo-Json) | Out-Null

Invoke-WebRequest -Method Post -Uri "$base/api/books/$bookId/compile" -OutFile "compiled-demo.txt"
Write-Host "Saved compiled-demo.txt"
