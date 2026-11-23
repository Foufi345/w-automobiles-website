-- ============================================================================
-- W Automobiles — Multilingual Vehicle Content (EN / AR)
-- Migration: 002_i18n.sql
-- Run in Supabase SQL Editor.
-- Existing `description` and `features` columns remain the French source.
-- ============================================================================

alter table public.cars
  add column if not exists description_en text,
  add column if not exists description_ar text,
  add column if not exists features_en text[] not null default '{}',
  add column if not exists features_ar text[] not null default '{}';
