import { scopeProjectRef } from "@t3tools/client-runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { projectScriptCwd } from "@t3tools/shared/projectScripts";
import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ChatView from "../components/ChatView";
import { threadHasStarted } from "../components/ChatView.logic";
import { DiffWorkerPoolProvider } from "../components/DiffWorkerPoolProvider";
import { PullRequestChecksPanel } from "../components/PullRequestChecksPanel";
import { usePullRequestChecks } from "../components/usePullRequestChecks";
import { CheckCircleIcon, DiffIcon } from "lucide-react";
import { cn } from "~/lib/utils";

import {
  DiffPanelHeaderSkeleton,
  DiffPanelLoadingState,
  DiffPanelShell,
  type DiffPanelMode,
} from "../components/DiffPanelShell";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import { type DiffRouteSearch, parseDiffRouteSearch } from "../diffRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import { selectEnvironmentState, selectThreadExistsByRef, useStore } from "../store";
import { createProjectSelectorByRef, createThreadSelectorByRef } from "../storeSelectors";
import { resolveThreadRouteRef, buildThreadRouteParams } from "../threadRoutes";
import { RightPanelSheet } from "../components/RightPanelSheet";
import { SidebarInset } from "~/components/ui/sidebar";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = "chat_right_sidebar_width";
const RIGHT_SIDEBAR_ACTIVE_TAB_STORAGE_KEY = "chat_right_sidebar_active_tab";
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 400;
const RIGHT_SIDEBAR_MIN_WIDTH = 22 * 16;
const RIGHT_SIDEBAR_MAX_WIDTH = 36 * 16;
type ChatRightSidebarTab = "changes" | "checks";

const RIGHT_SIDEBAR_TABS: Array<{
  key: ChatRightSidebarTab;
  label: string;
  icon: typeof DiffIcon;
}> = [
  { key: "changes", label: "Changes", icon: DiffIcon },
  { key: "checks", label: "Checks", icon: CheckCircleIcon },
];

const DiffLoadingFallback = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffPanelShell mode={props.mode} header={<DiffPanelHeaderSkeleton />}>
      <DiffPanelLoadingState label="Loading diff viewer..." />
    </DiffPanelShell>
  );
};

const LazyDiffPanel = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffWorkerPoolProvider>
      <Suspense fallback={<DiffLoadingFallback mode={props.mode} />}>
        <DiffPanel mode={props.mode} />
      </Suspense>
    </DiffWorkerPoolProvider>
  );
};

const ChecksPanelContent = (props: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  enabled: boolean;
}) => {
  const checks = usePullRequestChecks({
    environmentId: props.environmentId,
    cwd: props.cwd,
    enabled: props.enabled,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-sidebar-border/70 bg-background">
      <PullRequestChecksPanel
        pullRequest={checks.pullRequest}
        checks={checks.checks}
        commits={checks.commits}
        comments={checks.comments}
        reviews={checks.reviews}
        reviewComments={checks.reviewComments}
        isLoading={checks.isLoading}
        isChecksLoading={checks.isChecksLoading}
        isActivityLoading={checks.isActivityLoading}
        loadError={checks.loadError}
        cwd={props.cwd ?? undefined}
      />
    </div>
  );
};

const ChatRightPanelHeader = (props: {
  activeTab: ChatRightSidebarTab;
  onSelectTab: (tab: ChatRightSidebarTab) => void;
}) => {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border/70 px-3">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {RIGHT_SIDEBAR_TABS.map(({ key, label, icon: Icon }) => {
          const isActive = props.activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => props.onSelectTab(key)}
              className={cn(
                "group relative inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs leading-none transition-colors",
                isActive
                  ? "text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              {isActive ? <span className="absolute inset-0 rounded-md bg-accent" /> : null}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="size-3.5 shrink-0" />
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ChatRightPanelContent = (props: {
  activeTab: ChatRightSidebarTab;
  checksCwd: string | null;
  environmentId: EnvironmentId | null;
  mode: "sidebar" | "sheet";
  onSelectTab: (tab: ChatRightSidebarTab) => void;
  renderDiffContent: boolean;
}) => {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      <ChatRightPanelHeader activeTab={props.activeTab} onSelectTab={props.onSelectTab} />
      {props.activeTab === "changes" ? (
        props.renderDiffContent ? (
          <LazyDiffPanel mode={props.mode} />
        ) : null
      ) : (
        <ChecksPanelContent
          environmentId={props.environmentId}
          cwd={props.checksCwd}
          enabled={props.activeTab === "checks"}
        />
      )}
    </div>
  );
};

const ChatRightInlineSidebar = (props: {
  open: boolean;
  activeTab: ChatRightSidebarTab;
  checksCwd: string | null;
  environmentId: EnvironmentId | null;
  onSelectTab: (tab: ChatRightSidebarTab) => void;
  renderDiffContent: boolean;
}) => {
  const { open, activeTab, checksCwd, environmentId, onSelectTab, renderDiffContent } = props;
  const resizeStateRef = useRef<{
    pointerId: number;
    startWidth: number;
    startX: number;
  } | null>(null);
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") {
      return RIGHT_SIDEBAR_DEFAULT_WIDTH;
    }
    const storedWidth = Number(window.localStorage.getItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY));
    if (!Number.isFinite(storedWidth)) {
      return RIGHT_SIDEBAR_DEFAULT_WIDTH;
    }
    return Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, storedWidth));
  });
  const clampWidth = useCallback((nextWidth: number) => {
    return Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, nextWidth));
  }, []);
  const persistWidth = useCallback((nextWidth: number) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
    }
  }, []);
  const stopResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }
      resizeStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      persistWidth(width);
    },
    [persistWidth, width],
  );

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      resizeStateRef.current = {
        pointerId: event.pointerId,
        startWidth: width,
        startX: event.clientX,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const handleResizeMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      setWidth(clampWidth(resizeState.startWidth + resizeState.startX - event.clientX));
    },
    [clampWidth],
  );

  if (!open) {
    return null;
  }

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-sidebar-border/70 bg-background text-foreground"
      style={{ width } satisfies CSSProperties}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize right sidebar"
        onPointerCancel={stopResize}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={stopResize}
        className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors hover:bg-sidebar-border/90" />
      </div>
      <ChatRightPanelContent
        activeTab={activeTab}
        checksCwd={checksCwd}
        environmentId={environmentId}
        mode="sidebar"
        onSelectTab={onSelectTab}
        renderDiffContent={renderDiffContent}
      />
    </aside>
  );
};

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const threadRef = Route.useParams({
    select: (params) => resolveThreadRouteRef(params),
  });
  const search = Route.useSearch();
  const bootstrapComplete = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).bootstrapComplete,
  );
  const serverThread = useStore(useMemo(() => createThreadSelectorByRef(threadRef), [threadRef]));
  const activeProjectRef = serverThread
    ? scopeProjectRef(serverThread.environmentId, serverThread.projectId)
    : null;
  const activeProject = useStore(
    useMemo(() => createProjectSelectorByRef(activeProjectRef), [activeProjectRef]),
  );
  const threadExists = useStore((store) => selectThreadExistsByRef(store, threadRef));
  const environmentHasServerThreads = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).threadIds.length > 0,
  );
  const draftThreadExists = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) !== null : false,
  );
  const draftThread = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) : null,
  );
  const environmentHasDraftThreads = useComposerDraftStore((store) => {
    if (!threadRef) {
      return false;
    }
    return store.hasDraftThreadsInEnvironment(threadRef.environmentId);
  });
  const routeThreadExists = threadExists || draftThreadExists;
  const serverThreadStarted = threadHasStarted(serverThread);
  const environmentHasAnyThreads = environmentHasServerThreads || environmentHasDraftThreads;
  const diffOpen = search.diff === "1";
  const checksCwd = activeProject
    ? projectScriptCwd({
        project: { cwd: activeProject.cwd },
        worktreePath: serverThread?.worktreePath ?? null,
      })
    : null;
  const shouldUseDiffSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const currentThreadKey = threadRef ? `${threadRef.environmentId}:${threadRef.threadId}` : null;
  const [activeRightSidebarTab, setActiveRightSidebarTabState] = useState<ChatRightSidebarTab>(
    () => {
      if (typeof window === "undefined") {
        return "changes";
      }
      const storedTab = window.localStorage.getItem(RIGHT_SIDEBAR_ACTIVE_TAB_STORAGE_KEY);
      return storedTab === "checks" ? "checks" : "changes";
    },
  );
  const setActiveRightSidebarTab = useCallback((tab: ChatRightSidebarTab) => {
    setActiveRightSidebarTabState(tab);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RIGHT_SIDEBAR_ACTIVE_TAB_STORAGE_KEY, tab);
    }
  }, []);
  const [diffPanelMountState, setDiffPanelMountState] = useState(() => ({
    threadKey: currentThreadKey,
    hasOpenedDiff: diffOpen,
  }));
  const hasOpenedDiff =
    diffPanelMountState.threadKey === currentThreadKey
      ? diffPanelMountState.hasOpenedDiff
      : diffOpen;
  const markDiffOpened = useCallback(() => {
    setDiffPanelMountState((previous) => {
      if (previous.threadKey === currentThreadKey && previous.hasOpenedDiff) {
        return previous;
      }
      return {
        threadKey: currentThreadKey,
        hasOpenedDiff: true,
      };
    });
    setActiveRightSidebarTab("changes");
  }, [currentThreadKey, setActiveRightSidebarTab]);
  const closeDiff = useCallback(() => {
    if (!threadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: { diff: undefined },
    });
  }, [navigate, threadRef]);
  useEffect(() => {
    if (!threadRef || !bootstrapComplete) {
      return;
    }

    if (!routeThreadExists && environmentHasAnyThreads) {
      void navigate({ to: "/", replace: true });
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread?.promotedTo) {
      return;
    }
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread?.promotedTo, serverThreadStarted, threadRef]);

  if (!threadRef || !bootstrapComplete || !routeThreadExists) {
    return null;
  }

  const shouldRenderDiffContent = diffOpen || hasOpenedDiff;

  if (!shouldUseDiffSheet) {
    return (
      <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          onDiffPanelOpen={markDiffOpened}
          routeKind="server"
          rightSidebar={
            <ChatRightInlineSidebar
              open={diffOpen}
              activeTab={activeRightSidebarTab}
              checksCwd={checksCwd}
              environmentId={threadRef.environmentId}
              onSelectTab={setActiveRightSidebarTab}
              renderDiffContent={shouldRenderDiffContent}
            />
          }
        />
      </SidebarInset>
    );
  }

  return (
    <>
      <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          onDiffPanelOpen={markDiffOpened}
          routeKind="server"
        />
      </SidebarInset>
      <RightPanelSheet open={diffOpen} onClose={closeDiff}>
        <ChatRightPanelContent
          activeTab={activeRightSidebarTab}
          checksCwd={checksCwd}
          environmentId={threadRef.environmentId}
          mode="sheet"
          onSelectTab={setActiveRightSidebarTab}
          renderDiffContent={shouldRenderDiffContent}
        />
      </RightPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (search) => parseDiffRouteSearch(search),
  search: {
    middlewares: [retainSearchParams<DiffRouteSearch>(["diff"])],
  },
  component: ChatThreadRouteView,
});
