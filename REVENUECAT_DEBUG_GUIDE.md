# RevenueCat Subscription Debugging Guide

## Current Issue
Mobile app shows "Unable to load subscription options" when trying to purchase.

## What We Fixed (Code)
1. ✅ Added detailed console logging to track where it fails
2. ✅ Added fallback to check `offerings.all` if `offerings.current` is empty
3. ✅ Added detailed error messages showing what's actually returned

## What Needs to Be Checked (Configuration)

### 1. RevenueCat Dashboard Configuration

**Go to:** https://app.revenuecat.com/

#### A. Check Projects
- Verify you're in the correct project
- Note the iOS API key (should be: `appl_umJNBJEnUpZyeMlXteBXflPGrXB`)

#### B. Check Products
**Path:** RevenueCat Dashboard → Products

**Verify these product IDs exist:**
- `btn_monthly` 
- `btn_quarterly`
- `btn_yearly`
- `engine_monthly`
- `engine_quarterly`
- `engine_yearly`
- `applied_power_monthly`
- `applied_power_quarterly`
- `applied_power_yearly`
- `competitor_monthly`
- `competitor_quarterly`
- `competitor_yearly`

**For each product, check:**
- Status: Should be "Active" or "Approved"
- Product ID matches exactly (case-sensitive!)
- Linked to correct App Store Connect product

#### C. Check Offerings
**Path:** RevenueCat Dashboard → Offerings

**Critical check:**
1. Is there a "current" offering?
2. Does it have packages assigned to it?
3. Are the packages pointing to the correct products?

**If "current" offering is missing:**
- Create one named "default" or "current"
- Set it as "Current offering"
- Add all products to it

#### D. Check Entitlements
**Path:** RevenueCat Dashboard → Entitlements

**Verify:**
- At least one entitlement exists (e.g., "premium", "pro", etc.)
- Products are attached to entitlements

---

### 2. App Store Connect Configuration

**Go to:** https://appstoreconnect.apple.com/

#### A. Check In-App Purchases
**Path:** Apps → gainsai → In-App Purchases

**Verify for EACH product:**
1. **Product ID** matches RevenueCat exactly
2. **Status** is "Ready to Submit" or "Approved"
3. **Type** is "Auto-Renewable Subscription"
4. **Subscription Group** exists and is configured
5. **Pricing** is set for all territories (at least US)
6. **Localization** has at least English configured

#### B. Check Subscription Groups
- All products should be in the same subscription group
- Group should have subscription levels configured
- Products shouldn't conflict with each other

#### C. Check Agreements
**Path:** Agreements, Tax, and Banking

**Verify:**
- Paid Applications agreement is active
- Banking information is complete
- Tax forms are submitted

---

### 3. Build Configuration

#### A. Check Capabilities
**In Xcode or EAS:**
- In-App Purchase capability is enabled
- Push Notifications capability is enabled (we just added this)

#### B. Check Provisioning Profile
- Profile includes In-App Purchase capability
- Profile is not expired
- Profile matches bundle ID: `com.thegainslab.gainsai`

---

## Testing Steps (After Configuration)

### Step 1: Check Logs
After next build, open Xcode Console and filter for `[RevenueCat]`.

**Look for:**
```
[RevenueCat] Fetching offerings...
[RevenueCat] Offerings fetched successfully
[RevenueCat] Current offering exists: true/false
[RevenueCat] Current offering packages: X
```

### Step 2: Sandbox Testing
1. Sign out of App Store on device
2. Sign in with Apple Sandbox test account
3. Try to purchase
4. Check console logs

### Step 3: Common Issues

**If you see:** `Current offering exists: false`
→ **Fix:** Set a "current" offering in RevenueCat Dashboard

**If you see:** `Current offering packages: 0`
→ **Fix:** Add products to the current offering in RevenueCat

**If you see:** Products but wrong IDs
→ **Fix:** Product IDs in App Store Connect must exactly match RevenueCat

**If purchase fails with "Cannot connect to iTunes Store"**
→ **Fix:** Check sandbox account is logged in, check network

---

## Quick Diagnostic Commands

Run these in the app to get detailed info:

```javascript
// Check RevenueCat configuration
const offerings = await Purchases.getOfferings();
console.log('Offerings:', JSON.stringify(offerings, null, 2));

// Check customer info
const customerInfo = await Purchases.getCustomerInfo();
console.log('Customer Info:', JSON.stringify(customerInfo, null, 2));
```

---

## Most Likely Issues (in order)

1. **No "current" offering in RevenueCat** (90% of cases)
2. **Products not added to offering** (5% of cases)
3. **Product IDs don't match between RevenueCat and App Store Connect** (3% of cases)
4. **App Store Connect products not approved yet** (1% of cases)
5. **Banking/agreements not complete in App Store Connect** (1% of cases)

---

## Next Build

After fixing configuration:
1. Don't need to change code (we already added debugging)
2. Build and deploy: `eas build --platform ios --profile production --auto-submit`
3. Check Xcode Console logs after opening app
4. Share the log output if still failing

---

## Support Resources

- RevenueCat Docs: https://docs.revenuecat.com/docs/ios
- RevenueCat Troubleshooting: https://docs.revenuecat.com/docs/errors
- Apple Sandbox Testing: https://developer.apple.com/apple-pay/sandbox-testing/
