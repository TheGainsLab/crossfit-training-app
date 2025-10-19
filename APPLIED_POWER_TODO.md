# Applied Power - Supabase Function Changes Needed

## Overview
Applied Power users should receive a program with only 3 blocks (no SKILLS, no METCONS):
- TECHNICAL WORK
- STRENGTH AND POWER  
- ACCESSORIES

## Changes Required

### 1. Update `supabase/functions/generate-program/index.ts`

**Location:** Line 12
```typescript
// CURRENT:
const blocks = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']

// CHANGE TO:
// Accept programType parameter in request
interface GenerateProgramRequest {
  user_id: number
  weeksToGenerate?: number[]
  programType?: 'full' | 'applied_power'  // ADD THIS
}

// Then conditionally set blocks based on programType:
const { user_id, weeksToGenerate = [1, 2, 3, 4], programType = 'full' } = parsed || {}

const blocks = programType === 'applied_power'
  ? ['TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES']  // Applied Power: 3 blocks
  : ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']  // Full program: 5 blocks
```

### 2. No Changes Needed for `assign-exercises`
The assign-exercises function will work as-is. It will just be called for:
- TECHNICAL WORK
- STRENGTH AND POWER (multiple times based on main lift)
- ACCESSORIES

And NOT called for:
- SKILLS (skipped)
- METCONS (skipped)

### 3. No Changes Needed for `assign-metcon`
This function won't be called at all for Applied Power users since METCONS block is excluded.

---

## Testing Applied Power Flow

1. **Subscribe:** Visit `/appliedpower` → Subscribe with test card
2. **Intake:** Complete intake form (same as premium)
3. **Generation:** `save-intake-data` passes `programType: 'applied_power'`
4. **Program Created:** Only 3 blocks generated
5. **Dashboard:** User sees strength-focused program

---

## Frontend Changes Already Made

✅ `/app/appliedpower/page.tsx` - Subscription page
✅ `/app/api/appliedpower/create-checkout/route.ts` - Stripe checkout
✅ `/app/api/appliedpower/check-access/route.ts` - Access check
✅ Webhook updated to recognize Applied Power price ID
✅ Intake routing updated for Applied Power tier
✅ `save-intake-data` updated to pass `programType` parameter
✅ Dashboard will receive Applied Power programs

---

## Subscription Tier Values

**Database Values:**
- `users.subscription_tier` = `'APPLIED_POWER'` (uppercase)
- `subscriptions.plan` = `'applied_power'` (lowercase)

**Stripe Price ID:**
- Test: `price_1SK4BSLEmGVLIgpHrS1cfLrH`
- Live: TBD

---

## Next Steps

1. ✅ Deploy frontend changes (done automatically)
2. ⚠️ **YOU NEED TO:** Update `generate-program` Supabase function with programType logic
3. Test full flow end-to-end
4. Verify 3 blocks are generated (not 5)
