import React from 'react';
import { getPublicShopName } from '@/lib/supabase/server';
import { LoginClient } from '@/components/auth/login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const shopName = await getPublicShopName();
  return <LoginClient initialShopName={shopName} />;
}
