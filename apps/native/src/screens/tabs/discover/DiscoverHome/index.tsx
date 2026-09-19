import { useNavigation } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Tabs } from "react-native-collapsible-tab";
import { PartnerAdDialog } from "#/components/discover/PartnerAdDialog";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { useConnectBrand } from "#/hooks/discover/useConnectBrand";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";
import { PlayCircleIcon, SketchLogoIcon } from "#/lib/icons";

import { AllTab, AppTab, BooksTab, GamesTab, SurveyTab } from "./components";
import { AnimatedTabBar } from "./components/animated-tab-bar";
import { TabBarHeightProvider } from "./components/tab-bar-height-context";

function DiscoverHeader() {
  const navigation = useNavigation("DiscoverHome");
  const { onOpen, onCountdownComplete } = useConnectBrand();

  return (
    <View className="flex-row gap-3 bg-white px-2 py-3">
      <PartnerAdDialog
        asChild
        onCountdownComplete={onCountdownComplete}
        onOpen={onOpen}
      >
        <Button className="flex-1">
          <SketchLogoIcon color="white" size={20} weight="bold" />
          <Button.Label>Connect Brands</Button.Label>
        </Button>
      </PartnerAdDialog>

      <Button
        className="flex-1"
        onPress={() => navigation.navigate("PlayLottery")}
      >
        <PlayCircleIcon color="white" size={20} weight="bold" />
        <Button.Label>Giveaway</Button.Label>
      </Button>
    </View>
  );
}

function DiscoverHome() {
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const handleTabBarLayout = useCallback((height: number) => {
    setTabBarHeight(height);
  }, []);

  // The tab shell (header buttons, tab bar) is interactive on first render;
  // individual tabs manage their own loading states.
  useMarkInteractive(true);

  return (
    <Screen statusBarStyle="light">
      <TabBarHeightProvider value={tabBarHeight}>
        <Tabs.Container
          containerStyle={{ flex: 1 }}
          headerBackgroundColor="#ffffff"
          initialTabName="all"
          lazy
          renderHeader={DiscoverHeader}
          renderTabBar={(props) => (
            <AnimatedTabBar
              activeLabelClassName="font-semibold text-sm"
              inactiveLabelClassName="text-xs font-medium"
              onLayout={handleTabBarLayout}
              tabClassName="pb-1"
              {...props}
            />
          )}
          revealHeaderOnScroll
        >
          <Tabs.Tab label="All" name="all">
            <AllTab />
          </Tabs.Tab>
          <Tabs.Tab label="Apps" name="apps">
            <AppTab />
          </Tabs.Tab>
          <Tabs.Tab label="Games" name="games">
            <GamesTab />
          </Tabs.Tab>
          <Tabs.Tab label="Books" name="books">
            <BooksTab />
          </Tabs.Tab>
          <Tabs.Tab label="Surveys" name="surveys">
            <SurveyTab />
          </Tabs.Tab>
        </Tabs.Container>
      </TabBarHeightProvider>
    </Screen>
  );
}

export default DiscoverHome;
