-- NaliBase — Supabase table schema for Base44 data sync
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New Query)
-- These tables mirror the Base44 entities for backup/external access.

-- Users
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  full_name text,
  email text,
  role text
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversation (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  name text,
  type text,
  participant_ids text[],
  last_message_text text,
  last_message_at timestamptz,
  avatar_url text
);

-- Messages
CREATE TABLE IF NOT EXISTS message (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  conversation_id text,
  sender_id text,
  sender_name text,
  sender_avatar text,
  text text,
  type text,
  file_url text,
  file_name text,
  file_size numeric,
  file_type text,
  duration numeric,
  read_by text[],
  reply_to_id text,
  reply_to_text text,
  reply_to_sender text,
  reactions jsonb,
  thread_id text,
  thread_reply_count numeric DEFAULT 0,
  is_edited boolean DEFAULT false,
  participant_ids text[]
);

-- Projects
CREATE TABLE IF NOT EXISTS project (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  title text,
  description text,
  owner_id text,
  collaborator_ids text[],
  collaborator_roles jsonb,
  genre text,
  bpm numeric,
  key text,
  status text,
  cover_url text
);

-- Tracks
CREATE TABLE IF NOT EXISTS track (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  project_id text,
  name text,
  file_url text,
  type text,
  color text,
  volume numeric DEFAULT 75,
  pan numeric DEFAULT 0,
  muted boolean DEFAULT false,
  solo boolean DEFAULT false,
  duration numeric,
  uploaded_by text,
  waveform_data numeric[],
  suggested_genre text,
  suggested_bpm numeric
);

-- Art Posts
CREATE TABLE IF NOT EXISTS artpost (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  title text,
  description text,
  image_url text,
  file_url text,
  price numeric DEFAULT 0,
  medium text,
  tags text[],
  likes numeric DEFAULT 0,
  liked_by text[],
  creator_id text,
  creator_name text,
  creator_avatar text,
  views numeric DEFAULT 0,
  duration numeric,
  genre text,
  bpm numeric,
  featured boolean DEFAULT false
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenge (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  title text,
  description text,
  host_artist_name text,
  host_artist_id text,
  source_track_url text,
  source_track_name text,
  stem_file_urls text[],
  stem_names text[],
  genre text,
  bpm numeric,
  key text,
  rules text,
  prize_description text,
  cover_url text,
  status text,
  start_date timestamptz,
  submission_end_date timestamptz,
  voting_end_date timestamptz
);

-- Challenge Submissions
CREATE TABLE IF NOT EXISTS challengesubmission (
  id text PRIMARY KEY,
  created_date timestamptz,
  updated_date timestamptz,
  created_by_id text,
  challenge_id text,
  project_id text,
  producer_id text,
  producer_name text,
  producer_avatar text,
  remix_file_url text,
  remix_name text,
  description text,
  vote_count numeric DEFAULT 0,
  source_type text,
  external_url text,
  file_format text,
  device_type text,
  status text,
  share_url text
);