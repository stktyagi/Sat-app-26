import React from 'react';
import { Redirect } from 'expo-router';

export default function LeaderboardRedirect() {
  return <Redirect href={"/(tabs)/leaderboard" as any} />;
}
