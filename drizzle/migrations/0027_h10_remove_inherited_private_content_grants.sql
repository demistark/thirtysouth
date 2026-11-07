REVOKE ALL ON public.private_content FROM anon, PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.private_content TO authenticated;
GRANT ALL ON public.private_content TO service_role;