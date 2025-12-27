-- Create admin_notes table for storing admin notes about users
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id ON admin_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_admin_id ON admin_notes(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_at ON admin_notes(created_at DESC);

-- Add comment
COMMENT ON TABLE admin_notes IS 'Admin notes about users for tracking support interactions and engagement outreach';
