import Purchases, { PurchasesOfferings, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { createClient } from '@/lib/supabase/client';

export type ProgramType = 'btn' | 'engine' | 'applied_power' | 'competitor';

export interface ProgramInfo {
  id: ProgramType;
  name: string;
  displayName: string;
  icon: string;
  shortDescription: string;
  bullets: string[];
  monthlyPrice: string;
  quarterlyPrice: string;
  yearlyPrice: string;
}

export const PROGRAMS: Record<ProgramType, ProgramInfo> = {
  btn: {
    id: 'btn',
    name: 'btn',
    displayName: 'BTN (Better Than Nothing)',
    icon: '🎯',
    shortDescription: 'Build a personalized workout library',
    bullets: [
      'Personalized workouts, targets and stretch goals',
      'Fitness matrix for deep analytics',
      'Unlimited workout storage',
      'Target skills, time domains, or choose variation',
    ],
    monthlyPrice: '$14.99',
    quarterlyPrice: '$34.99',
    yearlyPrice: '$99.99',
  },
  engine: {
    id: 'engine',
    name: 'engine',
    displayName: 'Engine',
    icon: '⚡',
    shortDescription: 'Improve conditioning and endurance',
    bullets: [
      'Aerobic capacity building',
      'Lactate threshold training',
      '5-6 workouts per week',
      'Intermediate to advanced',
    ],
    monthlyPrice: '$29.99',
    quarterlyPrice: '$74.99',
    yearlyPrice: '$239.99',
  },
  applied_power: {
    id: 'applied_power',
    name: 'applied_power',
    displayName: 'Applied Power',
    icon: '💪',
    shortDescription: 'Strength and Power for athletes',
    bullets: [
      'Personalized workouts, not just percentages',
      'Technical Work to improve movement quality',
      'Daily mobility work',
      'Accessories target specific needs and general strength',
    ],
    monthlyPrice: '$29.99',
    quarterlyPrice: '$74.99',
    yearlyPrice: '$239.99',
  },
  competitor: {
    id: 'competitor',
    name: 'competitor',
    displayName: 'Competitor',
    icon: '🚀',
    shortDescription: 'Our flagship program for serious athletes',
    bullets: [
      'Complete athletic development',
      'Competition-ready programming',
      '6-7 workouts per week',
      'Advanced training methodology',
      'Priority support and coaching',
    ],
    monthlyPrice: '$89.99',
    quarterlyPrice: '$224.99',
    yearlyPrice: '$699.99',
  },
};

/**
 * Check if user has an active subscription to a specific program
 */
export async function hasActiveSubscription(program?: ProgramType): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    
    if (program) {
      // Check specific entitlement
      const entitlement = customerInfo.entitlements.active[program];
      return entitlement !== undefined;
    } else {
      // Check if user has any active entitlement
      return Object.keys(customerInfo.entitlements.active).length > 0;
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Get current active subscriptions
 */
export async function getActiveSubscriptions(): Promise<string[]> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Object.keys(customerInfo.entitlements.active);
  } catch (error) {
    console.error('Error getting active subscriptions:', error);
    return [];
  }
}

/**
 * Get offerings (products) from RevenueCat
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    console.log('[RevenueCat] Fetching offerings...');
    const offerings = await Purchases.getOfferings();
    console.log('[RevenueCat] Offerings fetched successfully');
    console.log('[RevenueCat] Current offering exists:', !!offerings.current);
    console.log('[RevenueCat] Current offering ID:', offerings.current?.identifier);
    console.log('[RevenueCat] Current offering packages:', offerings.current?.availablePackages?.length || 0);
    console.log('[RevenueCat] All offerings count:', Object.keys(offerings.all || {}).length);
    
    // Log all product IDs for debugging
    if (offerings.current) {
      offerings.current.availablePackages.forEach((pkg) => {
        console.log('[RevenueCat] Product:', pkg.product.identifier, '-', pkg.product.priceString);
      });
    }
    
    return offerings;
  } catch (error) {
    console.error('[RevenueCat] Error getting offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
      return null;
    }
    console.error('Error purchasing package:', error);
    throw error;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
}

/**
 * Set user ID for RevenueCat (link to Supabase auth)
 */
export async function setRevenueCatUserId(authId: string) {
  try {
    await Purchases.logIn(authId);
  } catch (error) {
    console.error('Error setting RevenueCat user ID:', error);
  }
}

/**
 * Log out from RevenueCat
 */
export async function logoutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
}

