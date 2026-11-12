"use client";

import { useEffect } from "react";

export function LoginBridge() {
  useEffect(() => {
    const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (message: string) => void } }).ReactNativeWebView;
    bridge?.postMessage(window.location.href);
  }, []);
  return null;
}
