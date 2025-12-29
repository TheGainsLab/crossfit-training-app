# Subscription System - Implementation Guide

## Overview

The subscription system is fully integrated with RevenueCat and ready for TestFlight testing.

## Files Created

### Core Library
- `fitness-mobile/lib/subscriptions.ts` - Helper functions and program definitions

### Screens
- `fitness-mobile/app/subscriptions/index.tsx` - Browse programs (paywall)
- `fitness-mobile/app/subscriptions/[program].tsx` - Program detail page
- `fitness-mobile/app/subscriptions/purchase/[program].tsx` - Purchase flow with RevenueCat
- `fitness-mobile/app/subscription-status.tsx` - View/manage subscriptions

### Components
- `fitness-mobile/components/SubscriptionGate.tsx` - Reusable subscription gate

## How to Use

### 1. Navigate to Subscriptions Browse
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/subscriptions');
```

### 2. Check if User Has Subscription
```typescript
import { hasActiveSubscription } from '@/lib/subscriptions';

// Check any active subscription
const hasAny = await hasActiveSubscription();

// Check specific program
const hasBTN = await hasActiveSubscription('btn');
const hasCompetitor = await hasActiveSubscription('competitor');
```

### 3. Gate Premium Features
```typescript
import SubscriptionGate from '@/components/SubscriptionGate';

export default function PremiumFeature() {
  return (
    <SubscriptionGate
      requiredProgram="btn"
      fallbackMessage="Subscribe to BTN to access this feature"
    >
      {/* Your premium content here */}
      <YourPremiumComponent />
    </SubscriptionGate>
  );
}
```

### 4. Get Active Subscriptions
```typescript
import { getActiveSubscriptions } from '@/lib/subscriptions';

const activeSubscriptions = await getActiveSubscriptions();
// Returns: ['btn', 'engine'] (array of active entitlement IDs)
```

### 5. Link User to RevenueCat on Login
```typescript
import { setRevenueCatUserId } from '@/lib/subscriptions';

// After successful authentication
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  await setRevenueCatUserId(user.id);
}
```

## Program Types

Four subscription programs available:
- `btn` - BTN program ($12.99/mo)
- `engine` - Engine program ($12.99/mo)
- `applied_power` - Applied Power ($12.99/mo)
- `competitor` - Competitor flagship ($24.99/mo)

Each has 3 billing periods:
- Monthly
- Quarterly (save 10%)
- Yearly (save 23%)

All include 3-day free trial.

## Testing in TestFlight

1. Build and upload: `eas build --platform ios`
2. Link subscriptions in App Store Connect
3. Install from TestFlight
4. Use Sandbox Apple ID to test purchases (free!)
5. Verify webhook updates your database

## Next Steps

1. Add subscription checks to premium features
2. Link "Subscribe" button from settings/profile
3. Test purchase flow end-to-end in TestFlight
4. Build Android version after iOS is working

