// React hook — subscribes to RevenueCat customerInfo and exposes whether
// the user has the Drape Pro entitlement active. iOS / Android only;
// web returns false (Stripe handles plan via Firestore subscription).
//
// Usage:
//   const { isPro, customerInfo, loading } = useRevenueCatPro();
//
// Reactive — updates immediately on purchase / restore / renewal / expiry
// because Purchases.addCustomerInfoUpdateListener fires from the SDK.

import { useEffect, useState } from 'react';
import { RevenueCatService } from '../services/revenuecat-service.js';

export function useRevenueCatPro() {
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Initial fetch — covers cold start / app foreground after long bg.
    RevenueCatService.getCustomerInfo().then((info) => {
      if (cancelled) return;
      setCustomerInfo(info);
      setLoading(false);
    });
    // Live updates — purchase / renewal / expiry triggers SDK callback.
    const unsub = RevenueCatService.addCustomerInfoListener((info) => {
      setCustomerInfo(info);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return {
    customerInfo,
    isPro: RevenueCatService.isProActive(customerInfo),
    loading,
  };
}
