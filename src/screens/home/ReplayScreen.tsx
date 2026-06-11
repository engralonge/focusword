import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import type { LiveStackParamList } from '@/navigation/types';
import type { LiveRecording } from '@/types';
import { fetchRecordingById } from '@/services/streaming/streamingService';

type Route = RouteProp<LiveStackParamList, 'Replay'>;

function ReplayPlayer({ recording }: { recording: LiveRecording }) {
  const player = useVideoPlayer(recording.playbackUrl);
  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: 'black' }}
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      contentFit="contain"
    />
  );
}

export function ReplayScreen() {
  const { params } = useRoute<Route>();
  const [recording, setRecording] = useState<LiveRecording | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setError(null);
    void fetchRecordingById(params.recordingId)
      .then((result) => {
        setRecording(result);
        if (!result) setError('This replay is no longer available.');
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : 'Could not load replay.');
      });
  }, [params.recordingId]));

  return (
    <ScreenContainer contentClassName="px-5">
      <Text variant="title" className="mt-4">Study replay</Text>
      {error ? <Text className="mt-4 text-red-400">{error}</Text> : null}
      {!recording && !error ? <Text variant="caption" className="mt-4">Loading replay...</Text> : null}
      {recording ? (
        <>
          <View className="mt-5 overflow-hidden rounded-2xl border border-border">
            <ReplayPlayer recording={recording} />
          </View>
          <Card className="mt-5">
            <Text variant="subtitle">{recording.title}</Text>
            <Text variant="caption" className="mt-2">Hosted by {recording.hostName}</Text>
            <Text variant="caption" className="mt-1">
              Recorded {new Date(recording.readyAt).toLocaleDateString()}
            </Text>
          </Card>
        </>
      ) : null}
    </ScreenContainer>
  );
}
