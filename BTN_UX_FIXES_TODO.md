# BTN User Experience - Critical Fixes Needed

## 🔴 CRITICAL ISSUES (Break the Flow)

### 1. Redirect After Intake Completion
**Current Behavior:**
- User completes intake → Taken to signup page (?)
- User has to manually navigate to Profile
- No automatic redirect to /btn workout generator

**Expected Behavior:**
- Complete intake → Auto-redirect to `/btn` workout generator
- Show success message: "Your profile is ready! Generate your first workout below."

**Files to Check:**
- `app/intake/page.tsx` - Line 759-772 (redirect logic after `handleNewPaidUserSubmission`)
- Verify `subscription_tier = 'BTN'` is set correctly in database
- Check if redirect happens before profile generation completes

**Possible Issues:**
- Profile generation is async, redirect happens too fast?
- `subscription_tier` not properly set in webhook?
- Redirect logic bypassed somehow?

---

### 2. Dashboard Error for BTN Users
**Current Behavior:**
- BTN user visits `/dashboard`
- Sees error: "No program found. Please complete the intake assessment"
- "Complete Assessment" button (confusing - they already did it!)

**Expected Behavior:**
- BTN users should either:
  - **Option A:** Not see dashboard at all (redirect to /btn)
  - **Option B:** See BTN-specific dashboard view
  - **Option C:** See message: "BTN subscription - use the Workout Generator instead"

**Files to Fix:**
- `app/dashboard/page.tsx` - Check for program requirement
- Add BTN subscription check
- Either redirect BTN users or show appropriate content

**Suggested Fix:**
```typescript
// In dashboard/page.tsx
if (userSubscription === 'BTN') {
  // Option A: Redirect to /btn
  router.push('/btn')
  
  // OR Option B: Show BTN dashboard variant
  return <BTNDashboard />
  
  // OR Option C: Show helpful message
  return (
    <div>
      <h2>BTN Subscription</h2>
      <p>Generate workouts at the BTN Workout Generator</p>
      <Link href="/btn">Go to Generator</Link>
    </div>
  )
}
```

---

## 🟡 HIGH PRIORITY (UX Issues)

### 3. Navigation Bar for BTN Users
**Current Behavior:**
- BTN users see standard navigation (Dashboard, Profile, etc.)
- Links go to pages that don't work for BTN users

**Expected Behavior:**
- BTN users see customized navigation:
  - 🏠 Home
  - 🏋️ Workout Generator (highlight as primary)
  - 👤 Profile
  - 📊 Workouts (future - their history)
  - ⬆️ Upgrade to Premium

**Files to Fix:**
- Navigation component (find the main nav)
- Add subscription tier check
- Conditionally render nav items

---

### 4. Profile Access - Make it Obvious
**Current Behavior:**
- BTN users complete intake
- Profile exists but not highlighted
- User doesn't know their profile is ready

**Expected Behavior:**
- After first intake completion:
  - Show modal/banner: "Your profile is ready! View it anytime."
  - Prominent "View Profile" button on /btn page
- Profile page should show:
  - "Your data is used to personalize workouts (coming soon!)"
  - Clear indication they can edit anytime

**Files to Fix:**
- `app/btn/page.tsx` - Add "View Profile" link prominently
- `app/profile/page.tsx` - Add BTN-specific messaging

---

### 5. Post-Intake Success Flow
**Current Behavior:**
- Unclear what happens after intake completes
- User doesn't know where to go next

**Expected Behavior:**
- Show completion screen with clear next steps:
  ```
  ✅ Your BTN Profile is Ready!
  
  What's Next:
  1. Generate your first workout
  2. View your profile anytime
  3. Come back daily for new workouts
  
  [Go to Workout Generator] (primary CTA)
  [View My Profile] (secondary)
  ```

**Files to Fix:**
- `app/intake/page.tsx` - Add better success message for BTN users
- Maybe create intermediate success page?

---

## 🟢 MEDIUM PRIORITY (Polish)

### 6. BTN Landing Page (/btn)
**Current Behavior:**
- Shows generator or paywall
- No guidance for new users who just subscribed

**Expected Behavior:**
- First-time users see:
  - Welcome message
  - Quick tutorial: "How to use BTN"
  - "Generate your first workout" CTA
- Returning users see:
  - Recent workouts (future)
  - Quick stats (future)
  - Generator ready to use

**Files to Fix:**
- `app/btn/page.tsx`
- Add first-time user detection (check if any workouts generated)
- Show onboarding vs. returning user view

---

### 7. Error States & Loading
**Current Issue:**
- Generic errors don't help BTN users understand what's wrong
- Loading states unclear

**Expected:**
- Clear error messages specific to BTN flow
- Loading states: "Saving your profile...", "Redirecting to generator..."
- Helpful recovery: "Something went wrong. Try [action]"

---

## 🔧 TECHNICAL FIXES NEEDED

### 8. Webhook - Verify BTN Tier Assignment
**Check:**
- Does webhook properly set `subscription_tier = 'BTN'`?
- Is it uppercase 'BTN' or lowercase 'btn'?
- Is it set on both `users` table and `subscriptions` table?

**Files:**
- `app/api/stripe-webhook/route.ts`
- Check `getPlanFromPriceId()` function
- Verify BTN price ID is recognized

**Test:**
```sql
-- After BTN subscription, check database:
SELECT id, email, subscription_tier FROM users WHERE email = 'test@example.com';
SELECT plan FROM subscriptions WHERE user_id = X;
```

---

### 9. Profile Generation Timeout
**Potential Issue:**
- Profile generation might be slow
- Redirect happens before profile is saved?

**Fix:**
- Add timeout handling
- Show loading state during profile generation
- Don't redirect until profile confirmed saved

**Files:**
- `app/api/save-intake-data/route.ts`
- Ensure `generate-user-profile` completes before returning success

---

### 10. Redirect Race Condition
**Potential Issue:**
- Multiple redirects happening simultaneously?
- Profile generation async but redirect synchronous?

**Debug:**
- Add console logs to track redirect path
- Check if multiple `router.push()` calls happening
- Verify subscription_tier query returns correct value

**Files:**
- `app/intake/page.tsx` - Lines 746-772

---

## 📋 TESTING CHECKLIST

### Test BTN Flow End-to-End:
- [ ] Subscribe at /btn with test card
- [ ] Redirected to /intake with session_id
- [ ] Complete all 5 sections
- [ ] Create password on Section 5
- [ ] Click "Generate Program"
- [ ] **EXPECT:** Loading state appears
- [ ] **EXPECT:** Success message shows
- [ ] **EXPECT:** Auto-redirect to /btn (NOT signup, NOT dashboard)
- [ ] **EXPECT:** See workout generator
- [ ] Click "Generate 10 Workouts"
- [ ] **EXPECT:** Workouts appear
- [ ] Navigate to /profile
- [ ] **EXPECT:** See full profile data
- [ ] Navigate to /dashboard
- [ ] **EXPECT:** Either redirect to /btn OR see BTN-friendly message (NOT error)

### Debug Queries:
```sql
-- Check user after signup
SELECT id, email, subscription_tier, auth_id FROM users WHERE email = 'yourtest@email.com';

-- Check subscription
SELECT user_id, plan, status FROM subscriptions WHERE user_id = X;

-- Check profile was generated
SELECT user_id, generated_at FROM user_profiles WHERE user_id = X ORDER BY generated_at DESC LIMIT 1;
```

---

## 🎯 PRIORITIZED FIX ORDER

### Sprint 1: Critical Path (Fix the Flow)
1. **Fix redirect after intake** - Must go to /btn, not signup
2. **Fix dashboard error** - BTN users shouldn't see "no program" error
3. **Verify webhook** - Ensure subscription_tier set correctly

### Sprint 2: Navigation & Clarity
4. **Update navigation** - BTN-specific nav items
5. **Add success messaging** - Clear next steps after intake
6. **Profile prominence** - Make profile access obvious

### Sprint 3: Polish
7. **BTN landing improvements** - First-time vs. returning user
8. **Error handling** - Better error messages
9. **Loading states** - Clear progress indicators

---

## ❓ QUESTIONS TO ANSWER

1. **Where should BTN users land after intake?**
   - /btn (workout generator) ✓ probably this
   - /profile (their profile)
   - Custom welcome page

2. **Should BTN users see the dashboard at all?**
   - Redirect them away to /btn
   - Show BTN-specific dashboard variant
   - Show "coming soon" message

3. **When should profile be shown?**
   - After first login only
   - Always accessible from nav
   - Only when they click "View Profile"

4. **What happens if user visits /dashboard?**
   - Hard redirect to /btn
   - Show helpful message with link
   - Show empty state with upgrade prompt

---

## 🐛 IMMEDIATE DEBUG STEPS

1. **Check browser console** during intake completion:
   - Look for errors
   - Check which URLs are being called
   - See redirect logs

2. **Check database** after test signup:
   ```sql
   SELECT * FROM users WHERE email = 'test@test.com';
   SELECT * FROM subscriptions WHERE user_id = X;
   SELECT * FROM user_profiles WHERE user_id = X;
   ```

3. **Check Vercel logs** for save-intake-data:
   - Does it detect BTN user?
   - Does profile generation succeed?
   - What's the response?

4. **Test redirect path:**
   - Add console.log before each router.push()
   - Verify subscription_tier query returns 'BTN'
   - Check if redirect is called at all

---

## 🚀 SUCCESS CRITERIA

BTN flow is fixed when:
- ✅ User completes intake → Auto goes to /btn
- ✅ No errors on dashboard (either redirected away or shows BTN content)
- ✅ Profile is accessible and obvious
- ✅ User knows what to do next at every step
- ✅ Zero confusion about "complete assessment" (already done!)
- ✅ Can generate workouts immediately
- ✅ Navigation makes sense for BTN subscription
