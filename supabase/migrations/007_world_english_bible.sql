-- Allow study state for the bundled public-domain World English Bible.

alter table public.bible_annotations
  drop constraint if exists bible_annotations_translation_check;
alter table public.bible_annotations
  add constraint bible_annotations_translation_check
  check (translation in ('WEB', 'KJV', 'NIV', 'ESV'));

alter table public.bible_reading_progress
  drop constraint if exists bible_reading_progress_translation_check;
alter table public.bible_reading_progress
  add constraint bible_reading_progress_translation_check
  check (translation in ('WEB', 'KJV', 'NIV', 'ESV'));
