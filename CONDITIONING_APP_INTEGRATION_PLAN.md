# Conditioning App Integration Plan
## Unified Workouts Table Migration

---

## Current State

### Existing `program_metcons` Table
**Purpose:** Stores workout metadata and performance tracking
**Currently supports:**
- Premium program metcons (`workout_type='program'`)
- BTN generated workouts (`workout_type='btn'`)

**Fields:**
- `id` (primary key)
- `program_id` (nullable, for Premium workouts)
- `program_workout_id` (nullable)
- `week`, `day` (nullable, for Premium workouts)
- `metcon_id` (nullable, link to metcons library)
- `user_id` (nullable, for BTN/conditioning workouts)
- `workout_type` (TEXT: 'program' | 'btn' | 'conditioning')
- `workout_name` (TEXT, BTN/conditioning-specific)
- `workout_format` (TEXT, BTN-specific)
- `time_domain` (TEXT, BTN-specific)
- `exercises` (JSONB, BTN-specific)
- `rounds`, `amrap_time`, `pattern` (BTN-specific)
- `user_score`, `percentile`, `performance_tier`
- `excellent_score`, `median_score`, `std_dev`
- `result`, `result_time`, `result_rounds`, `result_reps` (BTN)
- `notes` (TEXT)
- `completed_at` (TIMESTAMP)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**NEW: Conditioning-specific fields:**
- `cardio_machine` (TEXT: 'rowing' | 'bike' | 'ski' | 'assault_bike' | 'treadmill')
- `duration_seconds` (INT)
- `calories_per_minute` (NUMERIC)
- `meters_per_minute` (NUMERIC)
- `watts_per_minute` (NUMERIC)
- `avg_watts` (NUMERIC)
- `total_calories` (INT)
- `total_meters` (INT)
- `workout_zone` (TEXT: 'z1' | 'z2' | 'z3' | 'z4' | 'z5')
- `target_zone` (TEXT)
- `avg_heart_rate` (INT)
- `max_heart_rate` (INT)
- `intensity_type` (TEXT: 'steady_state' | 'intervals' | 'tempo' | 'threshold' | 'vo2max' | 'sprint')
- `interval_work_seconds` (INT)
- `interval_rest_seconds` (INT)
- `interval_rounds` (INT)
- `interval_results` (JSONB)

---

## Proposed Unified Schema

### Option: Rename & Extend `program_metcons` → `workouts`

**Rationale:**
- ✅ Minimal breaking changes (can use views/aliases)
- ✅ Add `workout_type='conditioning'` support
- ✅ Keep all existing fields
- ✅ Add conditioning-specific fields as needed

**Steps:**
1. Add `workout_type='conditioning'` support
2. Add conditioning app specific fields (if needed)
3. Create views/aliases for backward compatibility
4. Update all queries to use unified table
5. Eventually rename table (low priority)

---

## Schema Design ✅ COMPLETE

**Migration created:** `supabase/migrations/20250120_add_conditioning_workout_fields.sql`

**Key Features:**
- Units per minute analytics (calories, meters, watts)
- Cardio machine support (rowing, bike, ski, assault bike, treadmill)
- Intensity zone tracking (z1-z5)
- Interval workout support with detailed results
- Heart rate tracking
- Workout type classification (steady state, intervals, tempo, etc.)

## Remaining Questions

1. **Where is the conditioning app located?**
   - Folder path?
   - Is it a separate Next.js app or React components?

2. **Integration points:**
   - Standalone route: `/conditioning` (like `/btn`)?
   - Premium block: `/dashboard/conditioning`?
   - Both?

3. **Data structure verification:**
   - Does the conditioning app match this schema?
   - Any additional fields needed?
   - Any modifications to proposed fields?

---

## Migration Steps

### Phase 1: Schema Updates ✅ READY
**Migration created:** `20250120_add_conditioning_workout_fields.sql`

**To apply:**
1. Review schema with conditioning app requirements
2. Adjust fields if needed
3. Run migration: `supabase migration up`
4. Verify constraints and indexes

### Phase 2: Code Integration
1. **Locate conditioning app code**
2. **Move to project structure:**
   - `/app/conditioning/` - Pages
   - `/app/api/conditioning/` - API routes
   - `/lib/conditioning/` - Shared logic
3. **Create API routes:**
   - `POST /api/conditioning/save-workout` - Save conditioning workout
   - `GET /api/conditioning/workouts` - Get user's workouts
   - `GET /api/conditioning/analytics` - Units per minute analytics
4. **Update queries to use unified `program_metcons` table**
5. **Test data insertion/retrieval**

### Phase 3: Backward Compatibility ✅ NO CHANGES NEEDED
- Existing Premium queries continue to work
- Existing BTN queries continue to work
- New conditioning queries use same table

### Phase 4: Analytics
1. **Create analytics queries:**
   - Units per minute trends
   - Zone distribution
   - Machine-specific analytics
   - Interval performance analysis
2. **Update charts/dashboards:**
   - Add conditioning workout visualizations
   - Cross-product analytics (if needed)

---

## Next Steps

**Immediate:**
1. ✅ Schema designed (review needed)
2. ⏳ Get conditioning app location
3. ⏳ Verify schema matches app needs
4. ⏳ Run migration
5. ⏳ Integrate codebase

