-- Profiles table for username + phone
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL,
    phone text,
    email text,
    created_at timestamptz DEFAULT now()
);

-- Unique index on username (case-insensitive)
CREATE UNIQUE INDEX profiles_username_unique ON profiles (lower(username));

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (for username uniqueness check during signup)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);

-- Users can insert their own profile
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
