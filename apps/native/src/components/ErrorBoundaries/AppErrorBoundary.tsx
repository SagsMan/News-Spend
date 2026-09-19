import { ErrorBoundary } from "@sentry/react-native";
import type React from "react";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Text } from "../ui";

type AppFallbackProps = {
  error: unknown;
  componentStack?: string;
  eventId?: string;
  resetError?: () => void;
};

const FallbackComponent: React.FC<AppFallbackProps> = ({ resetError }) => (
  <View className="flex-1 items-center justify-center p-4">
    <Text className="mb-2 font-semibold text-lg">
      Oops! Something went wrong
    </Text>
    <Text className="mb-4 text-center">
      Something unexpected happened. We've been notified and are working on a
      fix.
    </Text>
    <Button onPress={() => resetError?.()}>
      <Button.Label>Try Again</Button.Label>
    </Button>
  </View>
);

export const AppErrorBoundary = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const handleError = (error: unknown) => {
    console.error("Error caught by AppErrorBoundary:", error);
  };

  return (
    <ErrorBoundary
      beforeCapture={(scope) => {
        scope.setTag("boundary", "app");
      }}
      fallback={(props) => <FallbackComponent {...props} />}
      onError={handleError}
      showDialog
    >
      {children}
    </ErrorBoundary>
  );
};
