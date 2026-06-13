import { View } from 'react-native';
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';
import { BrandMark } from '@/components/common/BrandMark';

type Props = {
  serverUrl: string;
  token: string;
  onError?: (message: string) => void;
};

function PreviewTrack() {
  const tracks = useTracks([Track.Source.Camera]);
  const track = tracks[0];
  return (
    <View className="aspect-video overflow-hidden bg-black">
      {track ? (
        <VideoTrack trackRef={track} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center">
          <BrandMark size={62} />
          <Text variant="caption" className="mt-2">Waiting for the host's camera</Text>
        </View>
      )}
      <View className="absolute left-3 top-3 flex-row items-center gap-2 rounded-full bg-live px-2.5 py-1">
        <BrandMark size={18} />
        <Text className="text-xs font-semibold text-white">LIVE PREVIEW</Text>
      </View>
      <View className="absolute right-3 top-3 w-8 h-8 rounded-full bg-black/70 items-center justify-center">
        <Ionicons name="volume-mute" size={17} color="white" />
      </View>
    </View>
  );
}

export function LiveRoomPreview({ serverUrl, token, onError }: Props) {
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
      onError={(error) => onError?.(error.message)}
    >
      <PreviewTrack />
    </LiveKitRoom>
  );
}
