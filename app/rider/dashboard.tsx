import { Redirect } from 'expo-router';
import React from 'react';

export default function DeprecatedDashboard() {
  // This file is obsolete. The rider app now uses the /(tabs) layout.
  // Redirecting to ensure any old deep links or cached state correctly routes.
  return <Redirect href={"/rider/(tabs)" as any} />;
}
