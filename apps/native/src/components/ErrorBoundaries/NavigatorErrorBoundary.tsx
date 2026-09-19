import { ErrorBoundary } from "@sentry/react-native";
import type React from "react";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Text } from "../ui";

type NavigatorFallbackProps = {
  error: unknown;
  componentStack?: string;
  eventId?: string;
  resetError?: () => void;
};

const NavigatorFallbackComponent: React.FC<NavigatorFallbackProps> = ({
  resetError,
}) => (
  <View className="flex-1 items-center justify-center p-4">
    <Text className="mb-2 font-semibold text-lg">Oops!</Text>
    <Text className="mb-4 text-center">
      Something unexpected happened. We've been notified and are working on a
      fix.
    </Text>
    <View className="flex-row gap-2">
      <Button
        onPress={() => {
          resetError?.();
        }}
      >
        <Button.Label>Try Again</Button.Label>
      </Button>
    </View>
  </View>
);

export const NavigatorErrorBoundary = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <ErrorBoundary
    beforeCapture={(scope) => {
      scope.setTag("boundary", "navigator");
    }}
    fallback={(props) => <NavigatorFallbackComponent {...props} />}
    onError={(error) => {
      console.error("Navigation error:", error);
    }}
  >
    {children}
  </ErrorBoundary>
);
