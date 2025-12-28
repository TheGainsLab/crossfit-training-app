# Admin Backend Design Plan

## Overview

This document outlines the design for an **admin backend** focused on **customer engagement and marketing** for The Gains Lab CrossFit training app.

**Key Principles:**
- **Engagement-first**: Not just a management tool—surfaces actionable insights for outreach
- **Quick status filtering**: Rapidly identify user cohorts (trial, active, at-risk, churned)
- **Mobile app is primary**: Web app discontinued; admin is internal-only tool
- **RevenueCat for payments**: Mobile subscription management via RevenueCat (synced to Supabase)

---

## 1. Current State

### Existing Admin APIs
| Endpoint | Description | Status |
|----------|-------------|--------|
| `GET /api/admin/users` | List all users (paginated, searchable) | ✅ Exists |
| `GET /api/admin/athletes` | Athletes with program info | ✅ Exists |
| `GET /api/admin/athletes/[id]` | Single athlete details | ✅ Exists |
| `GET /api/admin/system-stats` | System-wide statistics | ✅ Exists |
| `GET /api/admin/daily-active-users` | Activity metrics | ✅ Exists |
| `GET /api/admin/check-role` | Verify admin status | ✅ Exists |
| `POST /api/admin/workouts/import` | CSV bulk import | ✅ Exists |

### User Data Model
```typescript
interface User {
  id: number
  auth_id: string
  email: string
  name: string
  role: 'athlete' | 'coach' | 'admin'
  ability_level: 'Beginner' | 'Intermediate' | 'Advanced'
  subscription_tier: 'FREE' | 'PREMIUM' | 'BTN' | 'ENGINE' | 'APPLIED_POWER' | null
  subscription_status: 'active' | 'trialing' | 'canceled' | 'expired' | null
  current_program: string | null
  engine_program_version: '5-day' | '3-day' | null
  engine_current_day: number | null
  engine_months_unlocked: number | null
  created_at: string
  updated_at: string
}
```

### RevenueCat Integration ✅ CONFIRMED

The `subscriptions` table syncs automatically with RevenueCat via webhook on every purchase, renewal, cancellation, and expiration event.

**Subscriptions Table Schema:**
```sql
CREATE TABLE public.subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- Status & Plan
  status VARCHAR(50) NOT NULL,        -- 'active', 'expired', 'past_due'
  is_trial_period BOOLEAN DEFAULT FALSE, -- TRUE = trial, FALSE = paying
  plan VARCHAR(100),                   -- Plan name
  entitlement_identifier VARCHAR(100), -- RevenueCat entitlement (ENGINE, BTN, etc.)

  -- Billing
  amount_cents INTEGER,
  billing_interval VARCHAR(20),        -- 'monthly', 'quarterly', 'yearly'

  -- Dates
  subscription_start DATE,
  current_period_start DATE,
  current_period_end DATE,             -- When subscription expires/renews

  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,               -- For "trials expiring" feature

  -- Cancellation
  canceled_at TIMESTAMPTZ,             -- For win-back targeting

  -- Platform
  platform VARCHAR(20),                -- 'ios', 'android'
  store VARCHAR(20),                   -- 'app_store', 'play_store'

  -- RevenueCat IDs
  revenuecat_subscriber_id VARCHAR(255),
  revenuecat_product_id VARCHAR(255),

  -- Legacy Stripe fields (for migration)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Metadata
  current_month INTEGER DEFAULT 1,
  organization_id INTEGER DEFAULT 1,
  revenue_share_config JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_subscription_source CHECK (
    stripe_subscription_id IS NOT NULL OR revenuecat_subscriber_id IS NOT NULL
  )
);

-- Indexes (already exist)
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_revenuecat_id ON subscriptions(revenuecat_subscriber_id);
CREATE INDEX idx_subscriptions_entitlement ON subscriptions(user_id, entitlement_identifier, status);
```

**Key Queries Enabled:**
| Query | SQL Pattern |
|-------|-------------|
| Active subscribers | `WHERE status = 'active'` |
| Trial users | `WHERE status = 'active' AND is_trial_period = TRUE` |
| Paying customers | `WHERE status = 'active' AND is_trial_period = FALSE` |
| Trials expiring soon | `WHERE is_trial_period = TRUE AND current_period_end < NOW() + INTERVAL '3 days'` |
| Canceled (win-back) | `WHERE canceled_at IS NOT NULL AND status = 'active'` |
| Billing issues | `WHERE status = 'past_due'` |
| Expired | `WHERE status = 'expired'` |
| Platform breakdown | `GROUP BY platform` |
| Revenue by plan | `SUM(amount_cents) ... GROUP BY plan, billing_interval` |

**Example: Trial Conversion Rate**
```sql
SELECT
  plan,
  COUNT(*) FILTER (WHERE is_trial_period = FALSE) as paying_count,
  COUNT(*) FILTER (WHERE is_trial_period = TRUE) as trial_count
FROM subscriptions
WHERE status = 'active'
GROUP BY plan;
```

---

## 2. Purpose: Customer Engagement & Marketing Tool

This admin backend is designed to **drive customer engagement**, not just display data.

### Core Use Cases

| Use Case | Filter/View | Action |
|----------|-------------|--------|
| "Trials expiring soon" | Status: trialing, expires in ≤3 days | Reach out, offer help |
| "New trials this week" | Status: trialing, created last 7 days | Welcome outreach |
| "At-risk active users" | Status: active, no activity 7+ days | Re-engagement nudge |
| "Win-back opportunities" | Status: canceled, was highly active | Win-back campaign |
| "Engaged free users" | Status: free, high activity | Upsell opportunity |
| "Payment issues" | RevenueCat billing problem flag | Support outreach |

### Engagement Metrics

**Primary "At-Risk" Indicator:** `days_since_last_activity`
- 7+ days: Yellow warning
- 14+ days: Orange alert
- 30+ days: Red critical

This metric will be refined over time based on observed patterns.

### Secondary Engagement Signals
- Workout completion rate (last 30 days)
- Login frequency
- Program progress (stalled vs advancing)
- Time trial improvements (engaged) vs stagnation

---

## 3. Admin Dashboard Architecture

### Platform Decision
**Web-only admin dashboard** (internal tool)
- Desktop-optimized for data tables and analytics
- Not exposed in mobile app
- Accessed via admin URL (e.g., admin.thegainslab.com or /admin route)

### Role Model

**Current:** Single super-admin role (full access)

**Future:** Tiered roles
| Role | Access |
|------|--------|
| Super Admin | Full platform access |
| Coach/Manager | Access to assigned athletes only |

This allows coaches to have admin-like visibility over their subset of users without seeing the entire platform.

---

## 4. Proposed Admin Dashboard Structure

```
/admin/
├── index.tsx                    # Dashboard overview (engagement metrics)
├── users/
│   ├── index.tsx               # User list with engagement filters
│   └── [userId]/
│       └── index.tsx           # User detail + engagement view
├── engagement/
│   ├── at-risk.tsx             # At-risk users (no recent activity)
│   ├── trials.tsx              # Trial management & conversion
│   └── win-back.tsx            # Churned users for outreach
├── training/
│   └── index.tsx               # Platform-wide training metrics
├── chat/                        # (Future: Admin support chat)
│   └── index.tsx               # Support inbox
└── settings/
    └── index.tsx               # Admin settings
```

---

## 5. Core Admin Views

### 5.1 Dashboard Overview (`/admin`)
Engagement-focused quick-glance metrics.

**Engagement Alert Cards:**
| Card | Description | Action |
|------|-------------|--------|
| Trials Expiring | Count expiring in 1/3/7 days | View list |
| At-Risk Users | Active users, no activity 7+ days | View list |
| New Trials | Started this week | Welcome outreach |
| Recent Cancellations | Churned last 7 days | Win-back |

**Key Metrics:**
- Total Active Subscribers (by tier)
- Trial → Paid Conversion Rate (last 30 days)
- Avg Days Since Last Activity (platform health)
- Workouts Logged This Week

**Quick Filters:**
- "Show me trials expiring in 3 days"
- "Show me users inactive 14+ days"
- "Show me canceled users from last month"

---

### 5.2 Users List (`/admin/users`)
Full user list with **engagement-focused filters**.

**Table Columns:**
| Column | Description |
|--------|-------------|
| User | Name, email |
| Subscription | Tier + Status (color badge) |
| Last Active | Days ago (color-coded) |
| Workouts (30d) | Count in last 30 days |
| Program | Current program + day |
| Joined | Date |
| Actions | View / Chat / Note |

**Filters (Engagement-First):**

*By Status:*
- [ ] Active
- [ ] Trialing
- [ ] Canceled
- [ ] Expired
- [ ] Free

*By Engagement:*
- [ ] Active last 7 days
- [ ] Inactive 7-14 days (warning)
- [ ] Inactive 14-30 days (alert)
- [ ] Inactive 30+ days (critical)

*By Subscription Tier:*
- [ ] ENGINE
- [ ] BTN
- [ ] APPLIED_POWER
- [ ] PREMIUM
- [ ] FREE

*By Trial Status:*
- [ ] Trial expires in 1 day
- [ ] Trial expires in 3 days
- [ ] Trial expires in 7 days

**Status Badge Colors:**
| Status | Color | Meaning |
|--------|-------|---------|
| active | Green | Paying, engaged |
| trialing | Blue | Trial period |
| canceled | Orange | Churned |
| expired | Red | Trial/sub expired |
| FREE | Gray | Free tier |

**Last Active Colors:**
| Days | Color | Label |
|------|-------|-------|
| 0-3 | Green | Active |
| 4-7 | Yellow | Recent |
| 8-14 | Orange | Warning |
| 15-30 | Red | At Risk |
| 30+ | Dark Red | Critical |

---

### 5.3 User Detail View (`/admin/users/[userId]`)
Comprehensive single-user view with engagement context.

**Sections:**

#### A. Account Information
```
┌─────────────────────────────────────────────────────────────┐
│ ACCOUNT INFO                                                │
├─────────────────────────────────────────────────────────────┤
│ Name:           John Smith                                  │
│ Email:          john@example.com                            │
│ Role:           [Athlete]                                   │
│ Joined:         Jan 15, 2025 (11 months ago)                │
│ Last Active:    [2 days ago] ●                              │
└─────────────────────────────────────────────────────────────┘
```

#### B. Subscription Status (RevenueCat)
```
┌─────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION                                                │
├─────────────────────────────────────────────────────────────┤
│ Tier:           [ENGINE] (Conditioning Program)             │
│ Status:         [ACTIVE] ●                                  │
│ Since:          Mar 1, 2025                                 │
│ Platform:       iOS (RevenueCat)                            │
│ Renewal:        Jan 1, 2026                                 │
│                                                             │
│ History:                                                    │
│   • Oct 1: Converted from trial to paid                     │
│   • Sep 15: Started trial                                   │
└─────────────────────────────────────────────────────────────┘
```

#### C. Engagement Summary
```
┌─────────────────────────────────────────────────────────────┐
│ ENGAGEMENT                                                  │
├─────────────────────────────────────────────────────────────┤
│ Status:              [ENGAGED] ●                            │
│ Days Since Active:   2                                      │
│ Workouts (30d):      18 logged                              │
│ Completion Rate:     82%                                    │
│ Current Streak:      5 days                                 │
│                                                             │
│ Engagement Trend:    ↑ Improving (vs last month)            │
└─────────────────────────────────────────────────────────────┘
```

#### D. Program Status
```
┌─────────────────────────────────────────────────────────────┐
│ TRAINING PROGRAM                                            │
├─────────────────────────────────────────────────────────────┤
│ Current Program:   Engine 5-Day                             │
│ Program Day:       47 of 120                                │
│ Phase:             Build                                    │
│ Months Unlocked:   3                                        │
│ Modalities:        Rower, Bike, SkiErg                      │
└─────────────────────────────────────────────────────────────┘
```

#### E. Training Activity (Last 30 Days)
```
┌─────────────────────────────────────────────────────────────┐
│ RECENT ACTIVITY                                             │
├─────────────────────────────────────────────────────────────┤
│ [====Activity Heatmap (last 30 days)=====================]  │
│                                                             │
│ Recent Sessions:                                            │
│   • Dec 27: Engine Day 47 - Threshold                       │
│   • Dec 25: Engine Day 46 - Aerobic Base                    │
│   • Dec 24: Engine Day 45 - Speed/Power                     │
│   • Dec 22: Engine Day 44 - Long Intervals                  │
│                                                             │
│ [View Full History]                                         │
└─────────────────────────────────────────────────────────────┘
```

#### F. Performance Snapshot
```
┌─────────────────────────────────────────────────────────────┐
│ PERFORMANCE                                                 │
├─────────────────────────────────────────────────────────────┤
│ Engine Pacing (vs predicted):                               │
│   Rower:    +3.2% ahead  ↑                                  │
│   Bike:     -1.1% behind ↓                                  │
│                                                             │
│ Recent PRs:                                                 │
│   • 2K Row: 7:12 (Dec 15)                                   │
└─────────────────────────────────────────────────────────────┘
```

#### G. Admin Actions & Notes
```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN ACTIONS                                               │
├─────────────────────────────────────────────────────────────┤
│ [Start Chat]  [Add Note]  [Export Data]                     │
│                                                             │
│ Notes:                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dec 20: Reached out about missed workouts - traveling   │ │
│ │ Dec 1: Upgraded from trial, very engaged                │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [+ Add Note]                                                │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.4 Engagement Views

#### At-Risk Users (`/admin/engagement/at-risk`)
Users who need re-engagement outreach.

**Filters:**
- Inactive 7-14 days
- Inactive 14-30 days
- Inactive 30+ days

**Columns:** User, Tier, Last Active, Last Workout, Workouts (30d), Actions

---

#### Trials Dashboard (`/admin/engagement/trials`)
Manage trial conversions.

**Sections:**
- Expiring in 1 day (urgent)
- Expiring in 3 days
- Expiring in 7 days
- New trials this week
- Recent conversions (success stories)
- Recent expirations (missed opportunities)

---

#### Win-Back (`/admin/engagement/win-back`)
Churned users for outreach campaigns.

**Filters:**
- Canceled last 7 days
- Canceled last 30 days
- Previously highly engaged (good candidates)
- Canceled after trial (never converted)

---

### 5.5 Training Overview (`/admin/training`)
Platform-wide training health.

**Metrics:**
- Total Workouts This Week
- Avg Workouts Per Active User
- Most Active Program Type
- Completion Rates by Program

**Charts:**
- Daily workout volume (line)
- Distribution by program (pie)

---

## 6. Chat System

### Phase 1: Admin Support Chat ✅ IMPLEMENTED

Admin can initiate and respond to user conversations.

**Database Schema:** (see `supabase/migrations/20251227_create_support_chat.sql`)
```sql
-- Support conversations (one per user)
CREATE TABLE support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'open',  -- 'open', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  unread_by_admin BOOLEAN DEFAULT FALSE,
  unread_by_user BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_user_conversation UNIQUE (user_id)
);

-- Messages
CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_auto_reply BOOLEAN DEFAULT FALSE  -- For auto-acknowledgment
);
```

**Admin Web Features ✅:**
- Chat inbox page (`/dashboard/admin/chat`) with conversation list
- Unread badge in sidebar navigation
- Filter by status (all, open, resolved)
- Real-time message display
- Reply interface
- Mark conversations as resolved/reopen
- Chat section embedded in user detail page for quick replies
- Link from user detail to full conversation

**API Endpoints ✅:**
```
GET  /api/admin/chat/conversations        # List all conversations
GET  /api/admin/chat/conversations/[id]   # Get conversation with messages
PATCH /api/admin/chat/conversations/[id]  # Update status
POST /api/admin/chat/conversations/[id]/messages  # Send admin message

GET  /api/chat/conversation               # Get/create user's conversation
GET  /api/chat/messages                   # Get user's messages
POST /api/chat/messages                   # Send user message (+ auto-reply)
```

**Auto-Reply Feature:**
When a user sends their first message, an automatic acknowledgment is sent:
> "Thanks for reaching out! We typically respond within a few hours during business hours. We'll get back to you as soon as possible."

---

### Mobile App Requirements (TODO)

The mobile app needs to implement the user-side chat interface.

**Location:** Profile page (as a module card, like existing modules)

**UI Components Needed:**
1. **Chat Module Card** - Appears in Profile page
   - Shows unread badge if `unread_by_user = true`
   - Tapping opens the chat screen

2. **Chat Screen** - Full conversation view
   - Message list (user messages on right, admin on left)
   - Auto-reply messages styled differently (lighter color)
   - Text input with send button
   - Scroll to latest message on open

**API Integration:**
```typescript
// On chat screen mount:
const conversation = await fetch('/api/chat/conversation').json()
const messages = await fetch('/api/chat/messages').json()

// On send:
const result = await fetch('/api/chat/messages', {
  method: 'POST',
  body: JSON.stringify({ content: messageText })
}).json()
// result.message = the sent message
// result.autoReply = auto-reply if first message (add to list)
```

**Supabase Realtime (Optional Enhancement):**
```typescript
// Subscribe to new messages
supabase
  .channel('support_messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'support_messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Add new message to list (filter out own messages)
  })
  .subscribe()
```

**Push Notifications (Future):**
- Not implemented yet
- When implemented: notify user when admin replies

---

### Phase 2: Friends & Social Chat (Future)
- Friend request system
- User-to-user messaging
- This is a larger feature with its own design doc

---

## 7. New API Endpoints Required

### Phase 1: Core Admin (MVP)

```
GET  /api/admin/users
     ?status=active|trialing|canceled|expired
     ?inactive_days=7|14|30
     ?tier=ENGINE|BTN|...
     ?search=email|name
     &page=1&limit=50

GET  /api/admin/users/[userId]/profile
     Returns: account, subscription (RevenueCat), engagement summary

GET  /api/admin/users/[userId]/notes
POST /api/admin/users/[userId]/notes
     Admin notes CRUD

GET  /api/admin/engagement/summary
     Returns: at-risk counts, trial counts, key metrics
```

### Phase 2: Training & Performance

```
GET  /api/admin/users/[userId]/activity
     Returns: recent workouts, completion rate, streak

GET  /api/admin/users/[userId]/performance
     Returns: pacing data, PRs, trends

GET  /api/admin/training/analytics
     Returns: platform-wide workout metrics
```

### Phase 3: Subscriptions (RevenueCat)

```
GET  /api/admin/subscriptions/overview
     Returns: counts by tier/status, conversion rates

GET  /api/admin/subscriptions/trials
     ?expiring_in=1|3|7 (days)
     Returns: trial users with expiration info

GET  /api/admin/subscriptions/changes
     Returns: recent upgrades, cancellations, expirations
```

### Phase 4: Chat ✅ IMPLEMENTED

```
# Admin endpoints
GET   /api/admin/chat/conversations              # List all conversations
GET   /api/admin/chat/conversations/[id]         # Get conversation + messages
PATCH /api/admin/chat/conversations/[id]         # Update status
POST  /api/admin/chat/conversations/[id]/messages # Send admin message

# User endpoints (for mobile app)
GET  /api/chat/conversation                      # Get/create user's conversation
GET  /api/chat/messages                          # Get user's messages
POST /api/chat/messages                          # Send message (+ auto-reply)
```

---

## 8. Implementation Phases

### Phase 1: Core Admin Dashboard (MVP) ✅ LAUNCH
**Goal:** User visibility with engagement filters

1. Admin layout with navigation
2. Dashboard overview with engagement metrics
3. Users list with status/engagement filters
4. User detail view (account + subscription + engagement)
5. Admin notes system
6. RevenueCat subscription data display

**Deliverables:**
- ~8-10 React components
- ~4-5 API endpoints
- Database: admin_notes table

---

### Phase 2: Training & Performance ✅ LAUNCH
**Goal:** Workout and performance visibility

1. User detail: training activity section
2. User detail: performance metrics
3. Activity heatmap component
4. Platform-wide training analytics page

**Deliverables:**
- ~5-6 React components
- ~2-3 API endpoints

---

### Phase 3: Subscription & Engagement Views ✅ LAUNCH
**Goal:** Engagement-focused dashboards

1. Trials dashboard (expiring, new, converted)
2. At-risk users view
3. Win-back opportunities view
4. Subscription overview with RevenueCat data

**Deliverables:**
- ~4-5 React components
- ~3-4 API endpoints

---

### Phase 4: Admin Support Chat ✅ WEB COMPLETE
**Goal:** Direct user communication

**Completed (Web Admin):**
1. ✅ Database schema for chat (support_conversations, support_messages)
2. ✅ Support inbox UI (`/dashboard/admin/chat`)
3. ✅ Chat interface with message threading
4. ✅ Unread badge in sidebar navigation
5. ✅ Chat section in user detail page
6. ✅ Auto-reply on first user message
7. ✅ User-side API endpoints (ready for mobile)

**Remaining (Mobile App):**
1. Chat module card on Profile page
2. Chat screen with message list and input
3. Optional: Supabase Realtime for live updates
4. Future: Push notifications for admin replies

**Deliverables Completed:**
- Database schema: `20251227_create_support_chat.sql`
- Web components: Chat inbox, conversation view, message input
- API endpoints: 7 endpoints (4 admin, 3 user)

---

### Phase 5: Coach Management (Future)
**Goal:** Tiered admin access

1. Coach role with limited access
2. Assign athletes to coaches
3. Coach dashboard (subset of admin)
4. Coach applications workflow

---

### Phase 6: Advanced Features (Future)
**Goal:** Power features

1. Friends system
2. User-to-user chat
3. Bulk actions & exports
4. Audit logging
5. Advanced analytics

---

## 9. Security

### Authentication
- All admin routes require authenticated user
- Verify `role === 'admin'` (or coach role for future subset access)
- Use existing `isAdmin()` permission check

### Authorization Pattern
```typescript
// Every admin API route:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const adminCheck = await isAdmin(supabase, user.id)
if (!adminCheck) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Future: Coach Role Access
```typescript
// Coach can only access their assigned athletes
const canAccess = await canAccessAthleteData(supabase, coachId, athleteId)
if (!canAccess.hasAccess) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## 10. Tech Stack

### Frontend (Admin Web)
- Next.js 15 (existing)
- React 19 (existing)
- Tailwind CSS (existing)
- TanStack Table (data tables)
- Recharts or Chart.js (visualizations)

### Backend
- Next.js API Routes
- Supabase PostgreSQL
- Supabase Realtime (for chat)
- RevenueCat webhook/sync (subscriptions)

### No Additional Infrastructure
Leverages existing stack entirely.

---

## 11. Summary

This admin backend is a **customer engagement and marketing tool** that enables:

| Capability | Description |
|------------|-------------|
| **Quick Status Filtering** | Find users by subscription status, engagement level |
| **At-Risk Identification** | Surface users needing outreach (days since last activity) |
| **Trial Management** | Track and convert trials before expiration |
| **Win-Back Targeting** | Identify churned users for campaigns |
| **Training Visibility** | See workout completion and engagement |
| **Support Chat** | Direct communication with users (future) |
| **Scalable Roles** | Super-admin now, coach subsets later |

**Launch Scope:** Phases 1, 2, 3
**Post-Launch:** Admin chat, coach management, social features

---

## 12. Open Items

- [x] ~~Confirm RevenueCat data structure in Supabase~~ ✅ Schema confirmed (see Section 1)
- [ ] Define exact "at-risk" thresholds (start with 7/14/30 days)
- [ ] Design chat notification strategy (push, email, in-app)
- [ ] Plan coach role permissions matrix

---

*Document updated: December 27, 2025*
*Version: 2.1 - Chat System Implementation Complete (Web)*
