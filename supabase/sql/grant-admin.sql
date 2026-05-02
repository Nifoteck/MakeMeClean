-- Grant admin access to a user (replace with your auth.users id)
INSERT INTO public.admins (user_id)
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (user_id) DO NOTHING;

