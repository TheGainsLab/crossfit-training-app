-- Create meal templates tables for favorite meals feature
-- This allows users to save commonly eaten meals for quick daily logging

-- Table: meal_templates
-- Stores user's saved meal templates (e.g., "My Regular Breakfast")
CREATE TABLE IF NOT EXISTS meal_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic info
  template_name TEXT NOT NULL,
  meal_type meal_type_enum, -- breakfast, lunch, dinner, snack, pre_workout, post_workout, other
  
  -- Pre-calculated totals (sum of all items in this template)
  total_calories NUMERIC(8,2) DEFAULT 0,
  total_protein NUMERIC(6,2) DEFAULT 0,
  total_carbohydrate NUMERIC(6,2) DEFAULT 0,
  total_fat NUMERIC(6,2) DEFAULT 0,
  total_fiber NUMERIC(6,2) DEFAULT 0,
  total_sugar NUMERIC(6,2) DEFAULT 0,
  total_sodium NUMERIC(8,2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_logged_at TIMESTAMPTZ, -- Track when user last logged this template
  log_count INT DEFAULT 0, -- How many times user has logged this template
  
  -- Constraints
  CONSTRAINT unique_user_template_name UNIQUE(user_id, template_name)
);

COMMENT ON TABLE meal_templates IS 'User saved meal templates for quick daily logging';
COMMENT ON COLUMN meal_templates.template_name IS 'User-defined name like "My Regular Breakfast"';
COMMENT ON COLUMN meal_templates.last_logged_at IS 'Last time this template was logged to food_entries';
COMMENT ON COLUMN meal_templates.log_count IS 'Total number of times this template has been logged';

-- Indexes for meal_templates
CREATE INDEX idx_meal_templates_user_id ON meal_templates(user_id);
CREATE INDEX idx_meal_templates_meal_type ON meal_templates(user_id, meal_type);
CREATE INDEX idx_meal_templates_last_logged ON meal_templates(user_id, last_logged_at DESC);

-- Table: meal_template_items
-- Individual food items within a meal template
CREATE TABLE IF NOT EXISTS meal_template_items (
  id BIGSERIAL PRIMARY KEY,
  meal_template_id BIGINT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  
  -- Food identification (from FatSecret API)
  food_id TEXT NOT NULL, -- FatSecret food ID (string format)
  food_name TEXT NOT NULL,
  
  -- Serving info
  serving_id TEXT, -- FatSecret serving ID (string format)
  serving_description TEXT, -- e.g., "1 large", "100g", "1 cup"
  number_of_units NUMERIC(8,2) NOT NULL DEFAULT 1, -- Quantity (e.g., 4 for "4 eggs")
  
  -- Nutrition (already calculated for the quantity)
  calories NUMERIC(8,2) DEFAULT 0,
  protein NUMERIC(6,2) DEFAULT 0,
  carbohydrate NUMERIC(6,2) DEFAULT 0,
  fat NUMERIC(6,2) DEFAULT 0,
  fiber NUMERIC(6,2) DEFAULT 0,
  sugar NUMERIC(6,2) DEFAULT 0,
  sodium NUMERIC(8,2) DEFAULT 0,
  
  -- Display order
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE meal_template_items IS 'Individual food items within meal templates';
COMMENT ON COLUMN meal_template_items.food_id IS 'FatSecret food ID (string format)';
COMMENT ON COLUMN meal_template_items.number_of_units IS 'Quantity of servings (e.g., 4 for "4 eggs")';
COMMENT ON COLUMN meal_template_items.sort_order IS 'Order in which items appear in template';

-- Indexes for meal_template_items
CREATE INDEX idx_meal_template_items_template_id ON meal_template_items(meal_template_id, sort_order);
CREATE INDEX idx_meal_template_items_food_id ON meal_template_items(food_id);

-- Triggers for updated_at (reuse existing function)
DROP TRIGGER IF EXISTS trg_meal_templates_updated_at ON meal_templates;
CREATE TRIGGER trg_meal_templates_updated_at
BEFORE UPDATE ON meal_templates
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS Policies for meal_templates
ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own meal templates
DROP POLICY IF EXISTS meal_templates_select_own ON meal_templates;
CREATE POLICY meal_templates_select_own ON meal_templates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can insert their own meal templates
DROP POLICY IF EXISTS meal_templates_insert_own ON meal_templates;
CREATE POLICY meal_templates_insert_own ON meal_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can update their own meal templates
DROP POLICY IF EXISTS meal_templates_update_own ON meal_templates;
CREATE POLICY meal_templates_update_own ON meal_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can delete their own meal templates
DROP POLICY IF EXISTS meal_templates_delete_own ON meal_templates;
CREATE POLICY meal_templates_delete_own ON meal_templates
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- RLS Policies for meal_template_items
ALTER TABLE meal_template_items ENABLE ROW LEVEL SECURITY;

-- Users can view items from their own meal templates
DROP POLICY IF EXISTS meal_template_items_select_own ON meal_template_items;
CREATE POLICY meal_template_items_select_own ON meal_template_items
  FOR SELECT
  TO authenticated
  USING (
    meal_template_id IN (
      SELECT id FROM meal_templates 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users can insert items to their own meal templates
DROP POLICY IF EXISTS meal_template_items_insert_own ON meal_template_items;
CREATE POLICY meal_template_items_insert_own ON meal_template_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    meal_template_id IN (
      SELECT id FROM meal_templates 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users can update items in their own meal templates
DROP POLICY IF EXISTS meal_template_items_update_own ON meal_template_items;
CREATE POLICY meal_template_items_update_own ON meal_template_items
  FOR UPDATE
  TO authenticated
  USING (
    meal_template_id IN (
      SELECT id FROM meal_templates 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    meal_template_id IN (
      SELECT id FROM meal_templates 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users can delete items from their own meal templates
DROP POLICY IF EXISTS meal_template_items_delete_own ON meal_template_items;
CREATE POLICY meal_template_items_delete_own ON meal_template_items
  FOR DELETE
  TO authenticated
  USING (
    meal_template_id IN (
      SELECT id FROM meal_templates 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

