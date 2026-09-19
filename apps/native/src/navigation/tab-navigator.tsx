import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HouseIcon, ShoppingCartIcon, TagIcon, UserIcon } from "#/lib/icons";

import DiscoverStack from "./discover-stack";
import NewsStack from "./home-stack";
import SettingsStack from "./settings-stack";
import ShopStack from "./shop-stack";
import TabBar from "./tab-bar";

export default createBottomTabNavigator({
  tabBar: (props) => <TabBar {...props} />,
  implementation: "native",
  backBehavior: "history",
  screens: {
    Home: {
      linking: {
        path: "news",
        initialRouteName: "NewsHome",
      },
      screen: NewsStack,
      options: {
        tabBarIcon(props) {
          return (
            <HouseIcon
              color={props.color.toString()}
              size={props.size}
              weight="regular"
            />
          );
        },
      },
    },
    Discover: {
      linking: {
        path: "discover",
        initialRouteName: "DiscoverHome",
      },
      screen: DiscoverStack,
      options: {
        tabBarIcon(props) {
          return (
            <TagIcon
              color={props.color.toString()}
              size={props.size}
              weight="regular"
            />
          );
        },
      },
    },
    Shop: {
      linking: {
        path: "shop",
        initialRouteName: "ShopHome",
      },
      screen: ShopStack,
      options: {
        tabBarIcon(props) {
          return (
            <ShoppingCartIcon
              color={props.color.toString()}
              size={props.size}
              weight="regular"
            />
          );
        },
      },
    },
    Me: {
      linking: {
        path: "settings",
        initialRouteName: "SettingsHome",
      },
      screen: SettingsStack,
      options: {
        headerShown: false,
        title: "Me",
        tabBarIcon(props) {
          return (
            <UserIcon
              color={props.color.toString()}
              focused={props.focused}
              // size={props.size}
              weight="regular"
            />
          );
        },
      },
    },
  },
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    /**
     * Suspend a tab's React tree while it is off screen.
     *
     * Every tab holds live lists, carousels and ad slots, and without this
     * they keep re-rendering behind whichever tab is in front — Discover's
     * carousels animate while you are reading news, and vice versa.
     */
    freezeOnBlur: true,
    animation: "none",
    tabBarStyle: {
      backgroundColor: "red",
      borderTopWidth: 0,
      elevation: 0, // Android
      shadowOpacity: 0, // iOS
    },
  },
  initialRouteName: "Home",
});
