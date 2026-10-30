ALTER TABLE public.chapters
 ADD COLUMN layout text DEFAULT 'left' CHECK (layout IN ('left','center','right')),
 ADD COLUMN heading_before text,
 ADD COLUMN heading_before_align text DEFAULT 'center' CHECK (heading_before_align IN ('left','center','right')),
 ADD COLUMN transition_after text,
 ADD COLUMN transition_after_align text DEFAULT 'right' CHECK (transition_after_align IN ('left','center','right'));