import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async <T>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const response = await fetch(url, options);
  return response.json() as T;
};
