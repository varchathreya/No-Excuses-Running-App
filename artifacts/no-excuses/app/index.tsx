import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useApp } from '@/context/AppContext';

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const { offlineMode } = useApp();

  if (!isLoaded && !offlineMode) return null;
  return <Redirect href={isSignedIn || offlineMode ? '/(tabs)' : '/sign-in'} />;
}