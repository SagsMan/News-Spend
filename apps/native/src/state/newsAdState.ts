import { proxy } from "valtio";

export const newsAdState = proxy<{
  open: boolean;
  // path: string; path to the news article
  path: string;
  setOpen: (open: boolean, path?: string) => void;
  toggleOpen: () => void;
}>({
  open: false,
  path: "",
  setOpen: (open: boolean, path?: string) => {
    newsAdState.open = open;
    if (open) {
      newsAdState.path = path ?? "";
    }
  },
  toggleOpen: () => {
    newsAdState.open = !newsAdState.open;
  },
});
