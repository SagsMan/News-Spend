import { useMutation } from "@tanstack/react-query";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import { Switch } from "heroui-native/switch";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { useUser } from "#/hooks/auth";
import { userQueryOptions } from "#/hooks/auth/useUser";
import { orpc, type RouterInputs } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  RouterInputs["notificationSettings"]["update"]["notification_type"];

type NotificationConfig = {
  type: NotificationType;
  title: string;
  description: string;
};

// Scoped extension of the user type, ideally merged into the real User type
// upstream so this cast can be removed.
type UserWithNotifications = {
  notificationPreferences?: {
    types?: Partial<Record<NotificationType, boolean>>;
  };
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NOTIFICATION_CONFIGS: NotificationConfig[] = [
  {
    type: "BREAKING_NEWS",
    title: "Breaking News",
    description: "Get notified when important news happens",
  },
  {
    type: "COMMENT",
    title: "New Comment",
    description: "Get notified when someone comments on your post",
  },
  {
    type: "EARNING_OPPORTUNITY",
    title: "Earning Opportunity",
    description: "Get notified when you have a new earning opportunity",
  },
  {
    type: "MISC",
    title: "Miscellaneous",
    description: "Get notified for other things that are important",
  },
];

type ItemProps = {
  config: NotificationConfig;
  checked: boolean;
  isLoading: boolean;
  onToggle: (type: NotificationType, enabled: boolean) => void;
};

const NotificationItem = ({
  config,
  checked,
  isLoading,
  onToggle,
}: ItemProps) => {
  const handleValueChange = useCallback(
    (enabled: boolean) => {
      onToggle(config.type, enabled);
    },
    [config.type, onToggle]
  );

  return (
    <ListGroup.Item onPress={() => handleValueChange(!checked)}>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{config.title}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription>
          <Text className="text-muted text-xs">{config.description}</Text>
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Switch
          isDisabled={isLoading}
          isSelected={checked}
          onSelectedChange={handleValueChange}
        >
          <Switch.Thumb />
        </Switch>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function Notifications() {
  const { data: session } = useUser();
  const user = session?.user;

  // Track which notification types have an in-flight mutation so we can
  // disable only the toggled item rather than the whole list.
  const [pendingTypes, setPendingTypes] = useState<Set<NotificationType>>(
    () => new Set()
  );

  const notificationSettingsMutation = useMutation(
    orpc.notificationSettings.update.mutationOptions({
      onMutate: async ({ notification_type, enabled }) => {
        setPendingTypes((prev) => new Set(prev).add(notification_type));

        await queryClient.cancelQueries({
          queryKey: userQueryOptions.queryKey,
        });

        const previousData = queryClient.getQueryData(
          userQueryOptions.queryKey
        );

        queryClient.setQueryData(userQueryOptions.queryKey, (old: any) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            user: {
              ...old.user,
              notificationPreferences: {
                ...old.user?.notificationPreferences,
                types: {
                  ...old.user?.notificationPreferences?.types,
                  [notification_type]: enabled,
                },
              },
            },
          };
        });

        return { previousData, notification_type };
      },

      onError: (_err, _variables, context) => {
        toast.error("Failed to update notification settings");
        if (context?.previousData) {
          queryClient.setQueryData(
            userQueryOptions.queryKey,
            context.previousData
          );
        }
      },

      onSettled: (_data, _error, _variables, context) => {
        if (context?.notification_type) {
          setPendingTypes((prev) => {
            const next = new Set(prev);
            next.delete(context.notification_type);
            return next;
          });
        }
      },
    })
  );

  const handleNotificationToggle = useCallback(
    (notification_type: NotificationType, enabled: boolean) => {
      if (!user?.id) {
        console.warn("Cannot update notifications: user not found");
        return;
      }
      notificationSettingsMutation.mutate({ notification_type, enabled });
    },
    [user?.id, notificationSettingsMutation]
  );

  // Extract the types object so the reference is stable across renders when
  // the data hasn't changed, which keeps the useCallback memoisation effective.
  const notifTypes = (user as UserWithNotifications | undefined)
    ?.notificationPreferences?.types;

  const getNotificationStatus = useCallback(
    (type: NotificationType): boolean => notifTypes?.[type] ?? false,
    [notifTypes]
  );

  if (!user) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Spinner size="lg" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen statusBarStyle="light">
      <ListGroup variant="transparent">
        {NOTIFICATION_CONFIGS.map((config, index) => (
          <View key={config.type}>
            <NotificationItem
              checked={getNotificationStatus(config.type)}
              config={config}
              isLoading={pendingTypes.has(config.type)}
              onToggle={handleNotificationToggle}
            />
            {index < NOTIFICATION_CONFIGS.length - 1 && (
              <Separator className="mx-4" />
            )}
          </View>
        ))}
      </ListGroup>
    </Screen>
  );
}
