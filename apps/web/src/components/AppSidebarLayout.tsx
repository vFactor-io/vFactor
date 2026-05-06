import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import ThreadSidebar from "./Sidebar";
import { Sidebar, SidebarProvider, SidebarRail, useSidebar } from "./ui/sidebar";
import {
  clearShortcutModifierState,
  syncShortcutModifierStateFromKeyboardEvent,
} from "../shortcutModifierState";

const THREAD_SIDEBAR_WIDTH_STORAGE_KEY = "chat_thread_sidebar_width";
const THREAD_SIDEBAR_MIN_WIDTH = 13 * 16;
const THREAD_MAIN_CONTENT_MIN_WIDTH = 40 * 16;
const COLLAPSED_HOVER_TRIGGER_WIDTH = 12;

function CollapsedSidebarHoverPreview() {
  const { open, isMobile } = useSidebar();
  const [isHoverPreviewOpen, setIsHoverPreviewOpen] = useState(false);

  useEffect(() => {
    if (open && isHoverPreviewOpen) {
      setIsHoverPreviewOpen(false);
    }
  }, [isHoverPreviewOpen, open]);

  useEffect(() => {
    if (open || !isHoverPreviewOpen) {
      return;
    }

    const handleWindowMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null && event.clientX <= 0) {
        setIsHoverPreviewOpen(false);
      }
    };

    window.addEventListener("mouseout", handleWindowMouseOut);
    return () => window.removeEventListener("mouseout", handleWindowMouseOut);
  }, [isHoverPreviewOpen, open]);

  if (open || isMobile) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-y-0 left-0 z-20 hidden md:block"
        style={{ width: COLLAPSED_HOVER_TRIGGER_WIDTH }}
        onMouseEnter={() => setIsHoverPreviewOpen(true)}
      />
      {isHoverPreviewOpen ? (
        <div
          className="fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[10px_0_24px_rgba(0,0,0,0.16)] md:flex"
          style={{ width: `var(--sidebar-width)` }}
          onMouseEnter={() => setIsHoverPreviewOpen(true)}
          onMouseLeave={() => setIsHoverPreviewOpen(false)}
        >
          <ThreadSidebar />
        </div>
      ) : null}
    </>
  );
}

function SettingsSidebarOpenSync() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");
  const { open, setOpen } = useSidebar();
  const rememberedOpenRef = useRef<boolean | null>(null);
  const wasSettingsRouteRef = useRef(false);

  useEffect(() => {
    if (isSettingsRoute) {
      if (!wasSettingsRouteRef.current) {
        rememberedOpenRef.current = open;
        wasSettingsRouteRef.current = true;
      }

      if (!open) {
        void setOpen(true);
      }

      return;
    }

    if (!wasSettingsRouteRef.current) {
      return;
    }

    const rememberedOpen = rememberedOpenRef.current;
    rememberedOpenRef.current = null;
    wasSettingsRouteRef.current = false;

    if (rememberedOpen !== null && open !== rememberedOpen) {
      void setOpen(rememberedOpen);
    }
  }, [isSettingsRoute, open, setOpen]);

  return null;
}

export function AppSidebarLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      syncShortcutModifierStateFromKeyboardEvent(event);
    };
    const onWindowKeyUp = (event: KeyboardEvent) => {
      syncShortcutModifierStateFromKeyboardEvent(event);
    };
    const onWindowBlur = () => {
      clearShortcutModifierState();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    window.addEventListener("keyup", onWindowKeyUp, true);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
      window.removeEventListener("keyup", onWindowKeyUp, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action === "open-settings") {
        void navigate({ to: "/settings" });
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigate]);

  return (
    <SidebarProvider className="h-dvh! min-h-0!" defaultOpen>
      <SettingsSidebarOpenSync />
      <Sidebar
        animate={false}
        side="left"
        collapsible="offcanvas"
        className="bg-sidebar text-sidebar-foreground"
        resizable={{
          minWidth: THREAD_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: ({ nextWidth, wrapper }) =>
            wrapper.clientWidth - nextWidth >= THREAD_MAIN_CONTENT_MIN_WIDTH,
          storageKey: THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        <ThreadSidebar />
        <SidebarRail />
      </Sidebar>
      <CollapsedSidebarHoverPreview />
      {children}
    </SidebarProvider>
  );
}
