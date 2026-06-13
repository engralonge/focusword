import { VideoView, useVideoPlayer } from 'expo-video';
import { View } from 'react-native';
import { BrandMark } from '@/components/common/BrandMark';

export function RecordingPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (nextPlayer) => {
    nextPlayer.muted = true;
    nextPlayer.loop = true;
    nextPlayer.play();
  });

  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9 }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls={false}
        contentFit="cover"
      />
      <View
        pointerEvents="none"
        className="absolute bottom-2 right-2 opacity-75"
      >
        <BrandMark size={30} />
      </View>
    </View>
  );
}
