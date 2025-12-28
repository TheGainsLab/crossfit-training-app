-- Support Chat Tables
-- Enables user <-> admin messaging

-- Conversations table (one per user)
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'open',  -- 'open', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  unread_by_admin BOOLEAN DEFAULT FALSE,
  unread_by_user BOOLEAN DEFAULT FALSE,

  -- Ensure one conversation per user (for MVP)
  CONSTRAINT unique_user_conversation UNIQUE (user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_auto_reply BOOLEAN DEFAULT FALSE  -- For the "we'll respond soon" message
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conversations_unread_admin ON support_conversations(unread_by_admin) WHERE unread_by_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- Comments
COMMENT ON TABLE support_conversations IS 'Support chat conversations between users and admins';
COMMENT ON TABLE support_messages IS 'Individual messages within support conversations';
COMMENT ON COLUMN support_conversations.unread_by_admin IS 'True when user sent a message admin hasnt seen';
COMMENT ON COLUMN support_conversations.unread_by_user IS 'True when admin sent a message user hasnt seen';
COMMENT ON COLUMN support_messages.is_auto_reply IS 'True for automated acknowledgment messages';
