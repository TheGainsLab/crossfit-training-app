# BTN Workout Generator - Implementation TODO

## Overview
BTN is both a standalone service AND an entry point to Premium/Applied Power. Users should experience the full platform to encourage upgrades.

---

## ✅ COMPLETED (Already Built)

- [x] BTN subscription page `/btn` with paywall
- [x] Stripe checkout integration (test: `price_1SK2r2LEmGVLIgpHjn1dF2EU`)
- [x] Full intake flow (5 sections: Personal, Skills, Conditioning, 1RMs, Generate)
- [x] Account creation with password
- [x] Workout generator UI with 10-workout generation
- [x] Exercise database + generation logic (1500+ lines)
- [x] Webhook handling for BTN subscriptions
- [x] Subscription access checking

---

## 🔴 PHASE 1: Save Workout History to Database

### 1.1 Database Schema
- [ ] Create `btn_workouts` table (or use existing `program_workouts` table?)
  - `id` (primary key)
  - `user_id` (foreign key to users)
  - `workout_name` (string)
  - `workout_format` (string: "For Time", "AMRAP", "EMOM", etc.)
  - `time_domain` (string: "Sprint", "Short", "Medium", "Long", "Extended")
  - `exercises` (JSONB: array of {name, reps, weight})
  - `rounds` (int, nullable)
  - `amrap_time` (int, nullable)
  - `pattern` (string, nullable: "21-15-9", "1-2-3-4-5", etc.)
  - `generated_at` (timestamp)
  - `completed` (boolean, default false)
  - `completed_at` (timestamp, nullable)
  - `result` (string, nullable: time or rounds+reps)
  - `notes` (text, nullable)
  - `created_at` (timestamp)

### 1.2 API Routes
- [ ] `POST /api/btn/generate-workout` 
  - Accept parameters (time domain, format preferences)
  - Call generation logic
  - Save to database
  - Return generated workout

- [ ] `GET /api/btn/workouts`
  - Fetch user's workout history
  - Support filtering by date, time domain, completed status
  - Return list of workouts

- [ ] `PATCH /api/btn/workouts/:id`
  - Update workout (mark completed, add result, add notes)

- [ ] `DELETE /api/btn/workouts/:id`
  - Delete a workout (if user doesn't like it)

### 1.3 Update Generator Component
- [ ] Update `BTNWorkoutGenerator` to call API instead of local function
- [ ] Save generated workouts to database
- [ ] Add "Save Workout" or auto-save after generation
- [ ] Show workout history below generator
- [ ] Add "Log Result" button for each workout
- [ ] Add workout detail modal with result logging

---

## 🔴 PHASE 2: Personalize by Intake Data

### 2.1 Fetch User Profile in Generator
- [ ] Load user's intake data on `/btn` page load:
  - Equipment (from `user_equipment` table)
  - Skills (from `user_skills` table)
  - 1RMs (from `user_one_rms` table)
  - Gender, body weight (from `users` table)

### 2.2 Equipment Filtering
- [ ] Update `generateTestWorkouts()` to accept `availableEquipment` parameter
- [ ] Filter exercise database by user's equipment
  - If no barbell → exclude Olympic lifts
  - If no rope → exclude rope climbs
  - If no rings → exclude ring exercises
  - etc.
- [ ] Ensure at least 3 exercises per time domain remain available

### 2.3 Skills Filtering
- [ ] Update exercise selection to respect skill levels:
  - If skill = "Don't have it" → exclude from workouts
  - If skill = "Beginner" → include but with lower reps
  - If skill = "Advanced" → include with higher reps
- [ ] Examples:
  - No Ring Muscle-ups → exclude or substitute
  - Beginner Double Unders → max 30-50 reps
  - Advanced Pull-ups → can do 20+ reps

### 2.4 Weight Personalization
- [ ] Use user's 1RMs to calculate workout weights
  - Clean 1RM = 225 → workout weight = 135 (60%)
  - Snatch 1RM = 185 → workout weight = 95 (51%)
- [ ] If no 1RM entered → use current generic weights
- [ ] Adjust by gender (already have male/female in utils.ts)

### 2.5 "Roll Your Own" Mode
- [ ] Add toggle switch at top of generator:
  ```
  [ ] Roll Your Own Mode
  "Generate workouts without equipment/skill restrictions"
  ```
- [ ] When enabled:
  - Bypass equipment filtering
  - Bypass skill filtering
  - Use generic weights
  - Generate completely random workouts
- [ ] Save preference in local storage or user preferences table

---

## 🔴 PHASE 3: Dashboard Access for BTN Users

### 3.1 Update Dashboard Navigation
- [ ] Check if current dashboard shows nav for BTN users
- [ ] BTN users should see:
  - ✅ "Workouts" tab (their BTN workouts)
  - ✅ "Profile" (full profile access)
  - ✅ "Analytics" (heat map, trends)
  - ❌ "Program" tab (grayed out - Premium feature)
  - ❌ "Skills" tab (grayed out - Premium feature)
  - ❌ "Accessories" tab (grayed out - Premium feature)

### 3.2 Workouts Tab (Metcon-style View)
- [ ] Create or adapt metcons view for BTN workouts
- [ ] Show BTN workout history in same format as Premium metcons:
  - Date
  - Workout name
  - Format (For Time, AMRAP, etc.)
  - Time domain
  - Result (time or rounds+reps)
  - "Log Result" button if not completed
  - "View Details" to see exercises
- [ ] Filter by:
  - Date range
  - Time domain
  - Completed vs. Incomplete

### 3.3 Heat Map for BTN
- [ ] Show BTN workouts on heat map by:
  - X-axis: Time domain (Sprint, Short, Medium, Long, Extended)
  - Y-axis: Primary movement pattern or format
- [ ] Color intensity = number of workouts in that category
- [ ] Click square → shows workouts in that category
- [ ] Future: Click square → "Generate workout for this category"

### 3.4 Analytics for BTN
- [ ] Show BTN-specific analytics:
  - Total workouts generated
  - Total workouts completed
  - Completion rate by time domain
  - Most common exercises
  - PRs (if they log same workout multiple times)
  - Trends over time

---

## 🔴 PHASE 4: Profile Access for BTN Users

### 4.1 Profile Page Access
- [ ] Verify BTN users can access `/profile` 
- [ ] Show full profile with all sections:
  - Personal info
  - Equipment
  - Skills
  - 1RMs
  - Conditioning benchmarks
- [ ] Add "Edit Profile" to update intake data
- [ ] Show upgrade prompts in grayed-out sections?

### 4.2 Profile Update Flow
- [ ] BTN users can click "Edit Profile"
- [ ] Goes to intake page in "edit mode"
- [ ] Can update any section
- [ ] Save updates
- [ ] Regenerate workout recommendations based on new data?

---

## 🔴 PHASE 5: Upgrade Prompts & Cross-Selling

### 5.1 Strategic Upgrade Points
- [ ] Dashboard "Program" tab:
  - Show grayed out with "Upgrade to Premium" badge
  - "Get personalized 12-week programs" CTA
  
- [ ] Heat map feature:
  - BTN users see it but with limited data
  - "Unlock full analytics with Premium" banner
  
- [ ] After generating 10 workouts:
  - "Want unlimited workouts? Upgrade to Premium"
  
- [ ] Profile page:
  - "Use this data for full strength & conditioning programming"

### 5.2 Upgrade Flow
- [ ] "Upgrade" button in dashboard nav
- [ ] `/upgrade` page showing Premium vs. Applied Power
- [ ] One-click upgrade (Stripe customer portal?)
- [ ] Maintain BTN subscription or upgrade/replace?

---

## 🟡 PHASE 6: Advanced Features (Future)

### 6.1 Interactive Heat Map Generation
- [ ] Click any heat map square
- [ ] Modal: "Generate workout for [Time Domain] + [Movement Pattern]"
- [ ] User confirms → generates targeted workout
- [ ] Saves to history

### 6.2 Workout Favoriting
- [ ] "⭐ Favorite" button on workouts
- [ ] "Favorites" tab in dashboard
- [ ] "Re-generate similar workout" based on favorite

### 6.3 Workout Sharing
- [ ] "Share" button generates link
- [ ] Public workout view (no login required)
- [ ] "Try this workout" → signup prompt

### 6.4 Smart Generation
- [ ] AI suggests workouts based on:
  - Recent completion rate
  - Weak time domains (fewer completions)
  - Skills that need practice
  - Equipment not used recently

### 6.5 BTN Mobile App
- [ ] Timer integration
- [ ] Log results during workout
- [ ] Voice announcements for EMOM/intervals

---

## 🔧 TECHNICAL DEBT & IMPROVEMENTS

### Database
- [ ] Decide: Separate `btn_workouts` table or reuse `program_workouts`?
- [ ] Add indexes for fast queries (user_id, generated_at, time_domain)
- [ ] Migration script for schema changes

### Generator Logic
- [ ] Refactor `generateTestWorkouts()` to accept user profile
- [ ] Make equipment filtering configurable
- [ ] Make skill filtering configurable
- [ ] Add unit tests for generation logic

### UI/UX
- [ ] Loading states for workout generation
- [ ] Error handling if generation fails
- [ ] Empty states ("No workouts yet - generate your first!")
- [ ] Skeleton loaders for workout history

### Performance
- [ ] Cache user profile on client side
- [ ] Lazy load workout history (pagination)
- [ ] Optimize generation algorithm (currently synchronous)

---

## 📋 PRIORITIZED SPRINT PLAN

### Sprint 1: Core Persistence (Week 1)
1. Database schema for BTN workouts
2. API routes (generate, list, update)
3. Update generator to save to DB
4. Basic workout history view

### Sprint 2: Personalization (Week 2)
1. Load user profile in generator
2. Equipment filtering
3. Skills filtering (basic)
4. "Roll Your Own" toggle

### Sprint 3: Dashboard Integration (Week 3)
1. BTN dashboard nav
2. Workouts tab (metcon-style)
3. Heat map for BTN
4. Basic analytics

### Sprint 4: Profile & Upgrades (Week 4)
1. Full profile access
2. Profile edit flow
3. Upgrade prompts
4. Upgrade flow

### Future Sprints:
- Sprint 5: Advanced features (interactive heat map, favorites)
- Sprint 6: Smart generation, AI recommendations
- Sprint 7: Mobile optimization, sharing

---

## ❓ OPEN QUESTIONS

1. **Database Table:**
   - Create new `btn_workouts` table?
   - Or reuse existing `program_workouts` table with a `workout_type` field?

2. **Workout Limits:**
   - Should BTN users have unlimited workout generation?
   - Or limit to X workouts per day/week?

3. **Result Logging:**
   - Simple text field for time/rounds?
   - Or structured fields (minutes, seconds, rounds, reps)?

4. **BTN + Premium:**
   - If user upgrades, do they keep BTN access?
   - Or does Premium include BTN?

5. **Analytics Complexity:**
   - How detailed should BTN analytics be vs. Premium?
   - Same heat map or simplified version?

---

## 🎯 SUCCESS METRICS

### User Engagement
- % of BTN users who complete full intake
- % of BTN users who generate workouts within 24 hours
- Average workouts generated per user per week
- % of generated workouts that get logged

### Conversion
- % of BTN users who view Premium features
- % of BTN users who upgrade within 30 days
- Time from BTN signup to upgrade

### Retention
- % of BTN users who return within 7 days
- % of BTN users active after 30 days
- Churn rate (cancellations)

---

## 🚀 LAUNCH CHECKLIST

Before BTN goes live:
- [ ] All Phase 1 complete (workout persistence)
- [ ] All Phase 2 complete (personalization)
- [ ] Phase 3 at least 50% complete (dashboard access)
- [ ] Testing: Full end-to-end flow works
- [ ] Testing: Equipment filtering works correctly
- [ ] Testing: Workout history displays properly
- [ ] Testing: Upgrade prompts appear appropriately
- [ ] Documentation: How to use BTN (help docs)
- [ ] Monitoring: Track generation errors
- [ ] Monitoring: Track API performance
