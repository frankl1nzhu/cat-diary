-- Remove auto-create personal family trigger for new users
-- Users should manually create/join families via the UI

DROP TRIGGER IF EXISTS on_auth_user_created_family ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_family();
