import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { reportError } from '@/services/observability/errorReporter';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void reportError(error, {
      componentStack: info.componentStack?.slice(0, 4000) ?? null,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background">
          <Text variant="title" className="text-center">FocusWord needs a moment</Text>
          <Text variant="body" className="text-center mt-3">
            Something unexpected happened. The issue has been recorded securely.
          </Text>
          <Button
            title="Try again"
            className="mt-6 min-w-40"
            onPress={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
