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

### Running Migrations

In Supabase SQL Editor, run the SQL from both migration files in order.

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

## Notes

- Audio files are stored in `chant-audio` bucket under `{battleId}/` folder structure
- All chant packs created through admin are marked as official by default
- Distribution messages are pre-formatted for optimal sharing on each platform
