INSERT INTO public.site_content (key, value) VALUES
  ('facts.delete', 'Delete'),
  ('facts.delete_confirm', 'Delete this fact for good?'),
  ('facts.keep', 'Keep'),
  ('facts.select_all', 'Select all'),
  ('facts.delete_selected', 'Delete selected'),
  ('facts.delete_selected_confirm', 'Delete {n} facts for good?'),
  ('facts.deleted', 'Deleted.'),
  ('facts.import_hint', 'Importing the same file twice adds every line again.')
ON CONFLICT (key) DO NOTHING;