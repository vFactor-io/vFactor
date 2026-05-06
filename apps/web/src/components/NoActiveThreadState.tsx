import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime";
import { DEFAULT_RUNTIME_MODE } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useComposerDraftStore } from "../composerDraftStore";
import { isElectron } from "../env";
import { useSettings } from "../hooks/useSettings";
import { deriveLogicalProjectKeyFromSettings, getProjectOrderKey } from "../logicalProject";
import { newDraftId, newThreadId } from "../lib/utils";
import { selectProjectsAcrossEnvironments, useStore } from "../store";
import { useUiStateStore } from "../uiStateStore";
import { orderItemsByPreferredIds } from "./Sidebar.logic";
import { Spinner } from "./ui/spinner";
import { SidebarInset, SidebarTrigger, useSidebar } from "./ui/sidebar";
import { cn } from "~/lib/utils";

export function NoActiveThreadState() {
  const navigate = useNavigate();
  const { open: leftSidebarOpen } = useSidebar();
  const projectOrder = useUiStateStore((store) => store.projectOrder);
  const projects = useStore(useShallow((store) => selectProjectsAcrossEnvironments(store)));
  const projectGroupingSettings = useSettings((settings) => ({
    sidebarProjectGroupingMode: settings.sidebarProjectGroupingMode,
    sidebarProjectGroupingOverrides: settings.sidebarProjectGroupingOverrides,
  }));
  const orderedProjects = useMemo(
    () =>
      orderItemsByPreferredIds({
        items: projects,
        preferredIds: projectOrder,
        getId: getProjectOrderKey,
      }),
    [projectOrder, projects],
  );
  const defaultProject = orderedProjects[0] ?? null;

  useEffect(() => {
    if (!defaultProject) {
      return;
    }

    const projectRef = scopeProjectRef(defaultProject.environmentId, defaultProject.id);
    const logicalProjectKey =
      deriveLogicalProjectKeyFromSettings(defaultProject, projectGroupingSettings) ||
      scopedProjectKey(projectRef);
    const draftStore = useComposerDraftStore.getState();
    const existingDraft = draftStore.getDraftSessionByLogicalProjectKey(logicalProjectKey);
    const draftId = existingDraft?.draftId ?? newDraftId();

    if (!existingDraft) {
      draftStore.setLogicalProjectDraftThreadId(logicalProjectKey, projectRef, draftId, {
        threadId: newThreadId(),
        createdAt: new Date().toISOString(),
        envMode: "local",
        runtimeMode: DEFAULT_RUNTIME_MODE,
      });
      draftStore.applyStickyState(draftId);
    }

    void navigate({
      to: "/draft/$draftId",
      params: { draftId },
      replace: true,
    });
  }, [defaultProject, navigate, projectGroupingSettings]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "border-b border-sidebar-border/70 px-3 sm:px-5",
            isElectron
              ? cn(
                  "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)]",
                  !leftSidebarOpen && "!pl-[90px] wco:!pl-[calc(env(titlebar-area-x)+1em)]",
                  "wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]",
                )
              : "py-2 sm:py-3",
          )}
        >
          {!isElectron ? (
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
            </div>
          ) : null}
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground/70">
            <Spinner className="size-5" />
            <p className="text-sm">Opening chat...</p>
          </div>
        </main>
      </div>
    </SidebarInset>
  );
}
