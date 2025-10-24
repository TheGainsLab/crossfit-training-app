-- Add timestamp columns for BTN workouts
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_program_metcons_updated_at 
    BEFORE UPDATE ON program_metcons 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Backfill created_at for existing rows (set to NOW, or leave as is)
-- Existing rows will have created_at = NOW() from the default
COMMENT ON COLUMN program_metcons.created_at IS 'Timestamp when the workout was created/generated';
COMMENT ON COLUMN program_metcons.updated_at IS 'Timestamp when the workout was last updated';
