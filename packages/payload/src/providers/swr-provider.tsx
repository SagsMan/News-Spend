"use client";
import { SWRConfig } from "swr";

import { fetcher } from "../lib/utils";
export const SWRProvider = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
);
