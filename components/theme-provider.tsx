"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

/**
 * Theme Provider Component
 * Wraps the application with next-themes for light/dark mode support
 * Enables smooth theme transitions and persistent theme preference
 */
export function ThemeProvider(props: ThemeProviderProps) {
  return <NextThemesProvider {...props} />
}
