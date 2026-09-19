import {
  useLinkTo,
  useNavigation,
  useNavigationState,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";

import { trackNotificationOpen } from "#/lib/trackNotificationOpen";

export function HandlePushResponse() {
  const responseListener = useRef<Notifications.EventSubscription>(null);
  const routeName = useNavigationState(
    (state) => state?.routes[state.index].params?.screen
  );
  const linkTo = useLinkTo();
  const navigation = useNavigation();
  const navigationState = navigation.getState();
  const currentTabName = navigationState?.routes[navigationState.index];
  console.log(
    "🚀 ~ file: handlePushResponse.tsx:16 ~ currentTabName:",
    currentTabName
  );

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const screenUrl = response.notification.request.content.data?.url;
        // check if screen should be opened in the current tab
        const common = response.notification.request.content.data?.common;
        if (screenUrl) {
          if (common) {
            // remove the first word before the slash
            const [_, ...rest] = screenUrl?.split("/");
            console.log(
              "🚀 ~ file: handlePushResponse.tsx:29 ~ /${routeNam:",
              `/${routeName}/${rest.join("/")}`
            );
            // navigate to the screen of the current tab
            linkTo(
              routeName
                ? `/${routeName.toLowerCase()}/${rest.join("/")}`
                : `/${screenUrl}`
            );
          } else {
            linkTo(`/${screenUrl}`);
          }
          trackNotificationOpen({
            ...response.notification.request.content,
            routeName,
          });
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, [linkTo, routeName]);

  return null;
}
