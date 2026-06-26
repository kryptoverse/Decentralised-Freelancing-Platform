"use client";

import { Component, type ReactNode } from "react";

/**
 * Hard isolation boundary. ANY error thrown while rendering the 3D avatar
 * (WebGL context loss, bad GLB, runtime error in three, etc.) is caught here
 * and replaced with a tiny inert fallback. The rest of the app — chat
 * included — keeps running untouched.
 */
export class AvatarErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Log only; never rethrow.
    // eslint-disable-next-line no-console
    console.warn("[avatar] disabled after render error:", error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-500">
            Character unavailable
          </div>
        )
      );
    }
    return this.props.children;
  }
}
