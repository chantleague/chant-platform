# Supabase Setup Guide

This document explains how to set up Supabase for the Chant Platform.

## Prerequisites

- A Supabase account (https://supabase.com)
- A Supabase project created

## Environment Variables

1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

3. Optional AI chant audio settings:
  - `SUNO_API_KEY`: API key used by the admin AI chant generator
  - `SUNO_API_URL`: Optional override for the Suno generation endpoint (defaults to `https://api.suno.ai/v1/generate`)

You can find these values in your Supabase project settings.

## Database Setup

### Creating Tables

The following SQL migrations need to be run in your Supabase database:

1. **Matches Table** (`supabase/migrations/001_create_matches.sql`)
   - Stores matchday information
   - Fields: id, slug, title, description, home_team, away_team, matchday, status, starts_at

2. **Chant Packs Table** (`supabase/migrations/002_create_chant_packs.sql`)
   - Stores official chant packs for each match
   - Fields: id, match_id, title, description, audio_url, official, created_at, updated_at

3. **Chant Votes Table** (`supabase/migrations/003_create_chant_votes.sql`)
  - Stores votes on chant packs
  - Unique index on `(chant_pack_id, user_id)` to prevent duplicate votes

4. **Clubs + MVP Votes Tables** (`supabase/migrations/004_create_clubs_and_votes.sql`)
  - Stores clubs and battle MVP votes
  - Unique index on `(battle_id, club_slug, user_id)` for MVP duplicate-vote protection

5. **MVP Vote Throttle Hash** (`supabase/migrations/005_add_voter_hash_to_votes.sql`)
  - Adds `voter_hash` support for MVP vote throttling

6. **Fan Chants Table** (`supabase/migrations/006_create_chants.sql`)
  - Stores fan-submitted chants linked to battles
  - Links each fan chant to a `chant_packs` row so existing chant voting works
  - Enforces max 2 submissions per user per battle via DB trigger

7. **Premier League Club Seed** (`supabase/migrations/007_seed_premier_league_clubs.sql`)
  - Seeds 20 Premier League clubs into `clubs`

8. **Fixtures Table** (`supabase/migrations/008_create_fixtures.sql`)
  - Stores upcoming club fixtures used to generate battle links

9. **Fan Chant Audio Column** (`supabase/migrations/009_add_audio_url_to_chants.sql`)
  - Adds optional `audio_url` to `chants` for AI-generated audio playback

### Running Migrations

In Supabase SQL Editor, run the SQL from migration files in numeric order.

## Storage Bucket Setup

### Creating the `chant-audio` Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `chant-audio`
3. Set the following policies:
   - **Public Read**: Allow public access to files (for audio playback)
   - **Authenticated Write**: Allow authenticated users to upload files

### Storage Policies (SQL)

```sql
-- Allow public read access
CREATE POLICY "Public read access to chant-audio" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chant-audio');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload to chant-audio" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chant-audio'
    AND auth.role() = 'authenticated'
  );
```

## Features Implemented

### 1. Database Tables
- `matches`: Stores battle/match information
- `chant_packs`: Stores official chant packs linked to matches
- `chant_votes`: Stores fan voting on chants
- `clubs`: Stores supported clubs
- `votes`: Stores MVP voting between battle clubs
- `chants`: Stores fan-submitted chants linked to battles and chant packs

### 2. Admin Pages
- `/admin/battles`: Dashboard to manage all battles
- `/admin/battles/new`: Create new battle/match
- `/admin/battles/[id]`: Manage individual battle with upload and distribution tabs

### 3. Upload Functionality
- Upload audio files to Supabase storage
- Associate audio with official chant packs
- Metadata storage in database

### 4. Distribution Messages
- Generate platform-specific messages for:
  - WhatsApp
  - TikTok
  - YouTube
- Copy-to-clipboard functionality for easy sharing

### 5. Public Display
- `/battles/[slug]`: Display official chant packs on battle pages
- Audio player for listening to chants
- Distinguishes official chants with badge

### 6. Fan Chant Submission
- Fan chant submission form on `/battles/[slug]`
- Submissions saved to `chants` and linked `chant_packs` rows
- Existing `VoteButton` system used for fan chant voting

### 7. AI Chant Generation
- `/admin/chants`: Generate AI chant lyrics from club, player, and rival input
- Optional Suno integration stores generated audio URLs for playback
- Generated chants are persisted to `chant_packs` and `chants`

## Notes

- Audio files are stored in `chant-audio` bucket under `{battleId}/` folder structure
- All chant packs created through admin are marked as official by default
- Distribution messages are pre-formatted for optimal sharing on each platform
