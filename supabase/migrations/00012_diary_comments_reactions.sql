-- Diary comments
CREATE TABLE IF NOT EXISTS diary_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE diary_comments ENABLE ROW LEVEL SECURITY;

-- Allow users in the same family to read/create comments
CREATE POLICY "Users can read comments on family diary entries"
    ON diary_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM diary_entries de
            JOIN cats c ON c.id = de.cat_id
            JOIN family_members fm ON fm.family_id = c.family_id
            WHERE de.id = diary_comments.diary_id
              AND fm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create comments on family diary entries"
    ON diary_comments FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM diary_entries de
            JOIN cats c ON c.id = de.cat_id
            JOIN family_members fm ON fm.family_id = c.family_id
            WHERE de.id = diary_id
              AND fm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own comments"
    ON diary_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Diary reactions (emoji reactions)
CREATE TABLE IF NOT EXISTS diary_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(diary_id, user_id, emoji)
);

ALTER TABLE diary_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reactions on family diary entries"
    ON diary_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM diary_entries de
            JOIN cats c ON c.id = de.cat_id
            JOIN family_members fm ON fm.family_id = c.family_id
            WHERE de.id = diary_reactions.diary_id
              AND fm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add reactions to family diary entries"
    ON diary_reactions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM diary_entries de
            JOIN cats c ON c.id = de.cat_id
            JOIN family_members fm ON fm.family_id = c.family_id
            WHERE de.id = diary_id
              AND fm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove own reactions"
    ON diary_reactions FOR DELETE
    USING (auth.uid() = user_id);
