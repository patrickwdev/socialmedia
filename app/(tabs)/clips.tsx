import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ClipsFeed from '@/components/ClipsFeed';

export default function ClipsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  return <ClipsFeed initialClipId={params.id} />;
}
