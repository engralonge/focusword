import { VideoView, useVideoPlayer } from 'expo-video';

export function RecordingPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (nextPlayer) => {
    nextPlayer.muted = true;
    nextPlayer.loop = true;
    nextPlayer.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}
