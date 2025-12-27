# Admin Backend Design Plan

## Overview

This document outlines the design for an admin backend to manage users, subscriptions, and training/performance data for The Gains Lab CrossFit training app.

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

---

## 2. Admin Dashboard Architecture

### Option A: Web-Only Admin (Recommended)
Build the admin dashboard as part of the **Next.js web app** only.

**Pros:**
- Faster to build (leverage existing Next.js patterns)
- Desktop-optimized for data-heavy views
- Easier to secure (not in mobile app bundle)
- Can use existing admin APIs directly

**Cons:**
- Not accessible from mobile

### Option B: Shared Web + Mobile Admin
Build admin views in both Next.js and React Native.

**Pros:**
- Admin access anywhere

**Cons:**
- Double development effort
- Complex data tables on mobile
- Security considerations for mobile admin access

### Option C: Web Admin with Mobile Read-Only Summary
Full admin on web, lightweight summary on mobile for admins.

**Recommendation:** **Option A (Web-Only)** for initial release, with Option C as a future enhancement.

---

## 3. Proposed Admin Dashboard Structure

```
/dashboard/admin/
├── index.tsx                    # Dashboard overview
├── users/
│   ├── index.tsx               # User list (all roles)
│   └── [userId]/
│       └── index.tsx           # User detail view
├── subscriptions/
│   ├── index.tsx               # Subscription management
│   └── analytics.tsx           # Revenue/churn analytics
├── training/
│   ├── index.tsx               # Training overview
│   ├── programs.tsx            # Active programs summary
│   └── performance.tsx         # Platform-wide performance
├── coaches/
│   ├── index.tsx               # Coach management
│   └── applications.tsx        # Pending coach applications
└── settings/
    └── index.tsx               # Admin settings
```

---

## 4. Core Admin Views

### 4.1 Dashboard Overview (`/dashboard/admin`)
Quick-glance metrics and alerts.

**Metrics Cards:**
- Total Users (with trend)
- Active Subscriptions (by tier)
- Trial Users (with days remaining)
- Canceled/Expired This Month
- Daily Active Users (7-day trend)
- Programs Generated This Week

**Alerts Section:**
- Trials expiring in next 3 days
- Payment failures
- Inactive users (no activity in 14+ days)
- Pending coach applications

**Quick Actions:**
- Search for user
- Export user data
- View system health

---

### 4.2 Users List (`/dashboard/admin/users`)
Full user management interface.

**Table Columns:**
| Column | Description |
|--------|-------------|
| User | Name, email, avatar |
| Role | athlete / coach / admin (badge) |
| Subscription | Tier + Status (color-coded badge) |
| Program | Current active program |
| Last Active | Relative time |
| Joined | Date |
| Actions | View / Edit / ... |

**Filters:**
- Role (athlete, coach, admin)
- Subscription Tier (FREE, BTN, ENGINE, etc.)
- Subscription Status (active, trialing, canceled, expired)
- Ability Level (Beginner, Intermediate, Advanced)
- Has Active Program (yes/no)
- Activity (active last 7d, 30d, inactive)
- Date Range (joined between)

**Bulk Actions:**
- Export to CSV
- Send notification (future)

**Status Badge Colors:**
| Status | Color |
|--------|-------|
| active | Green |
| trialing | Blue |
| canceled | Orange |
| expired | Red |
| FREE | Gray |

---

### 4.3 User Detail View (`/dashboard/admin/users/[userId]`)
Comprehensive single-user view with all relevant data.

**Sections:**

#### A. Account Information
```
┌─────────────────────────────────────────────────────────────┐
│ ACCOUNT INFO                                                 │
├─────────────────────────────────────────────────────────────┤
│ Name:           John Smith                                   │
│ Email:          john@example.com                             │
│ Role:           [Athlete]                                    │
│ Joined:         Jan 15, 2025 (11 months ago)                │
│ Last Active:    2 hours ago                                  │
│ Auth ID:        abc123-def456-...                           │
└─────────────────────────────────────────────────────────────┘
```

#### B. Subscription Status
```
┌─────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION                                                 │
├─────────────────────────────────────────────────────────────┤
│ Tier:           [ENGINE] (Conditioning Program)              │
│ Status:         [ACTIVE] ●                                   │
│ Since:          Mar 1, 2025                                  │
│ Billing Cycle:  Monthly ($29/mo)                            │
│ Next Billing:   Jan 1, 2026                                  │
│ Stripe ID:      cus_xxxxx (link to Stripe)                  │
│                                                              │
│ History:                                                     │
│   • Dec 1: Payment succeeded ($29.00)                        │
│   • Nov 1: Payment succeeded ($29.00)                        │
│   • Oct 1: Upgraded from FREE to ENGINE                      │
│   • Sep 15: Account created (FREE trial)                     │
└─────────────────────────────────────────────────────────────┘
```

#### C. Program Status
```
┌─────────────────────────────────────────────────────────────┐
│ TRAINING PROGRAM                                             │
├─────────────────────────────────────────────────────────────┤
│ Current Program:   Engine 5-Day                              │
│ Program Day:       47 of 120                                 │
│ Phase:             Build                                     │
│ Months Unlocked:   3                                         │
│ Modalities:        Rower, Bike, SkiErg                       │
│                                                              │
│ Additional Programs:                                         │
│   • BTN: Not subscribed                                      │
│   • Applied Power: Not subscribed                            │
└─────────────────────────────────────────────────────────────┘
```

#### D. Training Activity (Last 30 Days)
```
┌─────────────────────────────────────────────────────────────┐
│ TRAINING ACTIVITY                                            │
├─────────────────────────────────────────────────────────────┤
│ Workouts Logged:     18 / 22 scheduled (82%)                │
│ Streak:              5 days                                  │
│ Avg Session Length:  ~45 min                                 │
│                                                              │
│ [====Activity Heatmap (GitHub-style)====================]   │
│                                                              │
│ Recent Sessions:                                             │
│   • Dec 27: Engine Day 47 - Threshold (45 min)              │
│   • Dec 26: Rest Day                                         │
│   • Dec 25: Engine Day 46 - Aerobic Base (52 min)           │
│   • Dec 24: Engine Day 45 - Speed/Power (38 min)            │
└─────────────────────────────────────────────────────────────┘
```

#### E. Performance Metrics
```
┌─────────────────────────────────────────────────────────────┐
│ PERFORMANCE OVERVIEW                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Engine Pacing (vs predicted):                                │
│   Rower:    +3.2% ahead of target  ↑                        │
│   Bike:     -1.1% behind target    ↓                        │
│   SkiErg:   +0.5% on target        →                        │
│                                                              │
│ Time Trial PRs:                                              │
│   • 2K Row: 7:12 (Dec 15) - Improved 8s from baseline       │
│   • 10 min Bike: 245 cal (Dec 10)                           │
│                                                              │
│ Trends: [Link to detailed analytics]                        │
└─────────────────────────────────────────────────────────────┘
```

#### F. Strength Data (if BTN/Premium)
```
┌─────────────────────────────────────────────────────────────┐
│ STRENGTH (1RM Data)                                          │
├─────────────────────────────────────────────────────────────┤
│ Back Squat:      315 lb (Dec 20)                            │
│ Front Squat:     265 lb (Dec 18)                            │
│ Deadlift:        405 lb (Nov 30)                            │
│ Clean:           225 lb (Dec 15)                            │
│ Snatch:          165 lb (Dec 10)                            │
│                                                              │
│ [View All 1RMs] [View Ratio Analysis]                       │
└─────────────────────────────────────────────────────────────┘
```

#### G. Admin Actions
```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN ACTIONS                                                │
├─────────────────────────────────────────────────────────────┤
│ [Change Role ▼]  [Manage Subscription]  [Reset Password]    │
│ [View as User]   [Export Data]          [Impersonate]       │
│                                                              │
│ Notes:                                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Add admin note about this user...                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.4 Subscriptions Dashboard (`/dashboard/admin/subscriptions`)
Financial and subscription health overview.

**Metrics:**
- MRR (Monthly Recurring Revenue)
- Active Subscriptions by Tier (pie chart)
- Trial → Paid Conversion Rate
- Churn Rate (monthly)
- Average Revenue Per User

**Tables:**
- Recent Subscription Changes (upgrades, downgrades, cancellations)
- Trials Expiring Soon
- Failed Payments (needs attention)
- Recently Churned (win-back opportunities)

---

### 4.5 Training Overview (`/dashboard/admin/training`)
Platform-wide training metrics.

**Metrics:**
- Total Workouts Logged (this week/month)
- Active Programs by Type
- Average Completion Rate
- Most Popular Modalities

**Charts:**
- Workout volume over time (line chart)
- Distribution by program type (bar chart)
- Peak training hours (heatmap)

---

### 4.6 Coach Management (`/dashboard/admin/coaches`)
Manage coach applications and relationships.

**Sections:**
- Pending Applications (approve/reject)
- Active Coaches (with athlete counts)
- Coach-Athlete Relationships
- Coach Activity Metrics

---

## 5. New API Endpoints Required

### 5.1 Enhanced User Detail
```
GET /api/admin/users/[userId]/full-profile
```
Returns comprehensive user data including:
- User account info
- Subscription details (with Stripe data)
- Program enrollment status
- Recent training activity summary
- Performance metrics summary
- Coach relationships (if any)

### 5.2 Subscription Analytics
```
GET /api/admin/subscriptions/analytics
```
Returns:
- MRR and trends
- Churn metrics
- Trial conversions
- Revenue by tier

### 5.3 Subscription Changes Feed
```
GET /api/admin/subscriptions/changes
```
Returns recent subscription events (upgrades, downgrades, cancellations).

### 5.4 Expiring Trials
```
GET /api/admin/subscriptions/expiring-trials
```
Returns users whose trials expire within N days.

### 5.5 Training Analytics (Platform-wide)
```
GET /api/admin/training/analytics
```
Returns:
- Workout counts by day/week/month
- Program type distribution
- Completion rates
- Modality popularity

### 5.6 User Activity Timeline
```
GET /api/admin/users/[userId]/activity
```
Returns chronological feed of user actions:
- Workouts completed
- Programs started/modified
- Subscription changes
- Login history

### 5.7 Admin Notes
```
GET/POST /api/admin/users/[userId]/notes
```
Admin-only notes about users (support interactions, special cases, etc.).

### 5.8 Coach Applications
```
GET /api/admin/coaches/applications
PATCH /api/admin/coaches/applications/[id]
```
List and approve/reject coach applications.

---

## 6. Data Visualization Components

### 6.1 Status Badge Component
```tsx
<StatusBadge
  status="active" // active | trialing | canceled | expired
  size="sm"       // sm | md | lg
/>
```

### 6.2 Subscription Tier Badge
```tsx
<TierBadge
  tier="ENGINE"   // FREE | BTN | ENGINE | APPLIED_POWER | PREMIUM
/>
```

### 6.3 Activity Heatmap
GitHub-style contribution graph showing workout frequency.

### 6.4 Metric Card
```tsx
<MetricCard
  title="Active Users"
  value={1234}
  change={+12}         // percentage change
  changeLabel="vs last week"
  trend="up"           // up | down | neutral
/>
```

### 6.5 User Table
Reusable sortable, filterable table with:
- Column sorting
- Multi-select filters
- Pagination
- Row actions
- Bulk selection

---

## 7. Implementation Phases

### Phase 1: Core Admin Dashboard (MVP)
**Goal:** Essential user and subscription visibility

1. Admin dashboard layout with navigation
2. Dashboard overview with key metrics
3. Users list with filters and pagination
4. Basic user detail view (account + subscription)
5. System stats integration (already exists)

**Estimated scope:** ~8-10 components, ~3-4 new API endpoints

### Phase 2: Training & Performance Views
**Goal:** Training visibility for all users

1. User detail: training activity section
2. User detail: performance metrics section
3. Platform-wide training analytics
4. Activity timeline for users

**Estimated scope:** ~5-6 components, ~2-3 new API endpoints

### Phase 3: Subscription Management
**Goal:** Financial and subscription health

1. Subscription analytics dashboard
2. Expiring trials view
3. Failed payments view
4. Subscription change feed
5. Stripe integration links

**Estimated scope:** ~4-5 components, ~3-4 new API endpoints

### Phase 4: Coach Management
**Goal:** Coach oversight and approval

1. Coach applications queue
2. Approve/reject workflow
3. Coach-athlete relationship view
4. Coach activity metrics

**Estimated scope:** ~4-5 components, ~2-3 new API endpoints

### Phase 5: Advanced Features
**Goal:** Power admin features

1. Admin notes system
2. User impersonation
3. Bulk actions (export, notifications)
4. Audit logging
5. Mobile admin summary (optional)

---

## 8. Security Considerations

### Authentication
- All admin routes require authenticated user
- All admin routes verify `role === 'admin'`
- Use existing `isAdmin()` permission check

### Authorization
```typescript
// Every admin API route should start with:
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

### Client-Side Protection
- Admin navigation only rendered for admin users
- Redirect non-admins away from /dashboard/admin/*
- Hide admin routes from mobile app (web only)

### Audit Logging (Phase 5)
- Log all admin actions
- Track who viewed/modified what
- Stripe webhook verification for payment data

---

## 9. UI/UX Considerations

### Design System
- Use existing Tailwind + component patterns
- Dark mode support (match app theme)
- Responsive but desktop-optimized

### Navigation
```
Admin Dashboard (sidebar)
├── Overview
├── Users
│   └── [User Detail]
├── Subscriptions
├── Training
├── Coaches
└── Settings
```

### Loading States
- Skeleton loaders for tables
- Optimistic updates where appropriate
- Error boundaries with retry

### Search
- Global search in header
- Search by name, email, or user ID
- Instant results (debounced)

---

## 10. Questions for Discussion

Before implementation, please clarify:

1. **Priority Features:** Which views are most critical for launch?
   - [ ] User list + detail
   - [ ] Subscription management
   - [ ] Training analytics
   - [ ] Coach management

2. **Stripe Integration Depth:**
   - View-only (links to Stripe dashboard)?
   - Or in-app subscription management (refunds, upgrades)?

3. **Admin Roles:**
   - Single admin role, or multiple levels (super-admin, support, etc.)?

4. **Mobile Admin:**
   - Web-only for now?
   - Or need mobile read-only summary?

5. **Notifications:**
   - Email alerts for critical events (failed payments, churn)?
   - In-app notification system?

6. **Data Export:**
   - CSV export sufficient?
   - Or need advanced reporting?

7. **User Impersonation:**
   - Needed for support/debugging?
   - If yes, with full audit logging?

---

## 11. Tech Stack for Admin

### Frontend (Web)
- Next.js 15 (existing)
- React 19 (existing)
- Tailwind CSS (existing)
- Chart.js or Recharts (for charts)
- TanStack Table (for data tables)

### Backend
- Next.js API Routes (existing pattern)
- Supabase PostgreSQL (existing)
- Stripe API (existing integration)

### No Additional Infrastructure Needed
Leverages existing stack entirely.

---

## Summary

This admin backend will provide:

1. **Complete User Visibility** - See every user's account status, subscription, and activity
2. **Subscription Health** - Monitor trials, churn, and revenue
3. **Training Insights** - Platform-wide and per-user training metrics
4. **Coach Oversight** - Manage coach applications and relationships
5. **Actionable Alerts** - Surface users needing attention

Built on your existing Next.js + Supabase stack with no additional infrastructure.

---

*Document created: December 27, 2025*
*Ready for review and feedback*
