import { createContext, useContext } from "react";

const TabBarHeightContext = createContext<number>(0);

export const TabBarHeightProvider = TabBarHeightContext.Provider;

export function useTabBarHeight(): number {
  return useContext(TabBarHeightContext);
}
