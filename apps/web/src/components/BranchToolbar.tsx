import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime";
import type { EnvironmentId, RuntimeMode, ThreadId } from "@t3tools/contracts";
import {
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  FolderGit2Icon,
  FolderGitIcon,
  FolderIcon,
  InfoIcon,
  LockIcon,
  LockOpenIcon,
  MonitorIcon,
  PenLineIcon,
} from "lucide-react";
import { memo, useMemo } from "react";

import { useComposerDraftStore, type DraftId } from "../composerDraftStore";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useStore } from "../store";
import { createProjectSelectorByRef, createThreadSelectorByRef } from "../storeSelectors";
import {
  type EnvMode,
  type EnvironmentOption,
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveEffectiveEnvMode,
  resolveLockedWorkspaceLabel,
} from "./BranchToolbar.logic";
import { BranchToolbarBranchSelector } from "./BranchToolbarBranchSelector";
import { BranchToolbarEnvironmentSelector } from "./BranchToolbarEnvironmentSelector";
import { BranchToolbarEnvModeSelector } from "./BranchToolbarEnvModeSelector";
import { Button } from "./ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { Separator } from "./ui/separator";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

interface BranchToolbarProps {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  draftId?: DraftId;
  onEnvModeChange: (mode: EnvMode) => void;
  effectiveEnvModeOverride?: EnvMode;
  activeThreadBranchOverride?: string | null;
  onActiveThreadBranchOverrideChange?: (branch: string | null) => void;
  envLocked: boolean;
  runtimeMode: RuntimeMode;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
  onCheckoutPullRequestRequest?: (reference: string) => void;
  onComposerFocusRequest?: () => void;
  availableEnvironments?: readonly EnvironmentOption[];
  onEnvironmentChange?: (environmentId: EnvironmentId) => void;
}

const runtimeModeConfig: Record<
  RuntimeMode,
  { label: string; description: string; icon: typeof LockIcon }
> = {
  "approval-required": {
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: LockIcon,
  },
  "auto-accept-edits": {
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  "full-access": {
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    icon: LockOpenIcon,
  },
};

const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];

const RuntimeModePicker = memo(function RuntimeModePicker({
  runtimeMode,
  onRuntimeModeChange,
}: {
  runtimeMode: RuntimeMode;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const runtimeModeOption = runtimeModeConfig[runtimeMode];
  const RuntimeModeIcon = runtimeModeOption.icon;

  return (
    <Select value={runtimeMode} onValueChange={(value) => onRuntimeModeChange(value!)}>
      <SelectTrigger
        variant="ghost"
        size="xs"
        className="h-6 max-w-36 gap-1.5 rounded-md px-1.5 text-sm font-medium text-muted-foreground/70 hover:bg-transparent hover:text-foreground/85 data-[popup-open]:bg-transparent data-[popup-open]:text-foreground/85 sm:max-w-none"
        aria-label="Runtime mode"
        title={runtimeModeOption.description}
      >
        <RuntimeModeIcon className="size-3.5 shrink-0" />
        <SelectValue>{runtimeModeOption.label}</SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false} className="w-56">
        {runtimeModeOptions.map((mode) => {
          const option = runtimeModeConfig[mode];
          const OptionIcon = option.icon;
          return (
            <SelectItem key={mode} value={mode} hideIndicator className="w-full !pe-4 !ps-2">
              <span className="grid w-full min-w-0 grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2">
                <span className="flex items-center justify-center">
                  {mode === runtimeMode ? <CheckIcon className="size-4" /> : null}
                </span>
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                  <OptionIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{option.label}</span>
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground/65 transition-colors data-[popup-open]:text-foreground"
                        aria-label={`${option.label} details`}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      />
                    }
                  >
                    <InfoIcon className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipPopup side="left" align="center" className="max-w-56">
                    {option.description}
                  </TooltipPopup>
                </Tooltip>
              </span>
            </SelectItem>
          );
        })}
      </SelectPopup>
    </Select>
  );
});

interface MobileRunContextSelectorProps {
  envLocked: boolean;
  envModeLocked: boolean;
  environmentId: EnvironmentId;
  availableEnvironments: readonly EnvironmentOption[] | undefined;
  showEnvironmentPicker: boolean;
  onEnvironmentChange: ((environmentId: EnvironmentId) => void) | undefined;
  effectiveEnvMode: EnvMode;
  activeWorktreePath: string | null;
  onEnvModeChange: (mode: EnvMode) => void;
}

const MobileRunContextSelector = memo(function MobileRunContextSelector({
  envLocked,
  envModeLocked,
  environmentId,
  availableEnvironments,
  showEnvironmentPicker,
  onEnvironmentChange,
  effectiveEnvMode,
  activeWorktreePath,
  onEnvModeChange,
}: MobileRunContextSelectorProps) {
  const activeEnvironment = useMemo(
    () => availableEnvironments?.find((env) => env.environmentId === environmentId) ?? null,
    [availableEnvironments, environmentId],
  );
  const environmentLabel = activeEnvironment?.label ?? "Run on";
  const EnvironmentIcon = activeEnvironment?.isPrimary ? MonitorIcon : CloudIcon;
  const WorkspaceIcon =
    effectiveEnvMode === "worktree"
      ? FolderGit2Icon
      : activeWorktreePath
        ? FolderGitIcon
        : FolderIcon;
  const workspaceLabel = envModeLocked
    ? resolveLockedWorkspaceLabel(activeWorktreePath)
    : effectiveEnvMode === "worktree"
      ? resolveEnvModeLabel("worktree")
      : resolveCurrentWorkspaceLabel(activeWorktreePath);

  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="xs" />}
        className="min-w-0 max-w-[48%] flex-1 justify-start text-muted-foreground/70 hover:text-foreground/80 md:hidden"
      >
        {showEnvironmentPicker ? (
          <>
            <EnvironmentIcon className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{environmentLabel}</span>
          </>
        ) : (
          <>
            <WorkspaceIcon className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{workspaceLabel}</span>
          </>
        )}
        <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
      </MenuTrigger>
      <MenuPopup align="start" side="top" className="w-64">
        {showEnvironmentPicker && availableEnvironments && onEnvironmentChange ? (
          <>
            <MenuGroup>
              <MenuGroupLabel>Run on</MenuGroupLabel>
              <MenuRadioGroup
                value={environmentId}
                onValueChange={(value) => onEnvironmentChange(value as EnvironmentId)}
              >
                {availableEnvironments.map((env) => {
                  const Icon = env.isPrimary ? MonitorIcon : CloudIcon;
                  return (
                    <MenuRadioItem
                      key={env.environmentId}
                      disabled={envLocked}
                      value={env.environmentId}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon className="size-3" />
                        <span className="min-w-0 truncate">{env.label}</span>
                      </span>
                    </MenuRadioItem>
                  );
                })}
              </MenuRadioGroup>
            </MenuGroup>
            <MenuSeparator />
          </>
        ) : null}
        <MenuGroup>
          <MenuGroupLabel>Workspace</MenuGroupLabel>
          <MenuRadioGroup
            value={effectiveEnvMode}
            onValueChange={(value) => onEnvModeChange(value as EnvMode)}
          >
            <MenuRadioItem disabled={envModeLocked} value="local">
              <span className="flex min-w-0 items-center gap-1.5">
                {activeWorktreePath ? (
                  <FolderGitIcon className="size-3" />
                ) : (
                  <FolderIcon className="size-3" />
                )}
                <span className="min-w-0 truncate">
                  {resolveCurrentWorkspaceLabel(activeWorktreePath)}
                </span>
              </span>
            </MenuRadioItem>
            <MenuRadioItem disabled={envModeLocked} value="worktree">
              <span className="flex min-w-0 items-center gap-1.5">
                <FolderGit2Icon className="size-3" />
                <span className="min-w-0 truncate">{resolveEnvModeLabel("worktree")}</span>
              </span>
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
});

export const BranchToolbar = memo(function BranchToolbar({
  environmentId,
  threadId,
  draftId,
  onEnvModeChange,
  effectiveEnvModeOverride,
  activeThreadBranchOverride,
  onActiveThreadBranchOverrideChange,
  envLocked,
  runtimeMode,
  onRuntimeModeChange,
  onCheckoutPullRequestRequest,
  onComposerFocusRequest,
  availableEnvironments,
  onEnvironmentChange,
}: BranchToolbarProps) {
  const threadRef = useMemo(
    () => scopeThreadRef(environmentId, threadId),
    [environmentId, threadId],
  );
  const serverThreadSelector = useMemo(() => createThreadSelectorByRef(threadRef), [threadRef]);
  const serverThread = useStore(serverThreadSelector);
  const draftThread = useComposerDraftStore((store) =>
    draftId ? store.getDraftSession(draftId) : store.getDraftThreadByRef(threadRef),
  );
  const activeProjectRef = serverThread
    ? scopeProjectRef(serverThread.environmentId, serverThread.projectId)
    : draftThread
      ? scopeProjectRef(draftThread.environmentId, draftThread.projectId)
      : null;
  const activeProjectSelector = useMemo(
    () => createProjectSelectorByRef(activeProjectRef),
    [activeProjectRef],
  );
  const activeProject = useStore(activeProjectSelector);
  const hasActiveThread = serverThread !== undefined || draftThread !== null;
  const activeWorktreePath = serverThread?.worktreePath ?? draftThread?.worktreePath ?? null;
  const effectiveEnvMode =
    effectiveEnvModeOverride ??
    resolveEffectiveEnvMode({
      activeWorktreePath,
      hasServerThread: serverThread !== undefined,
      draftThreadEnvMode: draftThread?.envMode,
    });
  const envModeLocked = envLocked || (serverThread !== undefined && activeWorktreePath !== null);

  const showEnvironmentPicker = Boolean(
    availableEnvironments && availableEnvironments.length > 1 && onEnvironmentChange,
  );
  const isMobile = useIsMobile();

  if (!hasActiveThread || !activeProject) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2.5 pb-3 pt-1 sm:px-3">
      {isMobile ? (
        <MobileRunContextSelector
          envLocked={envLocked}
          envModeLocked={envModeLocked}
          environmentId={environmentId}
          availableEnvironments={availableEnvironments}
          showEnvironmentPicker={showEnvironmentPicker}
          onEnvironmentChange={onEnvironmentChange}
          effectiveEnvMode={effectiveEnvMode}
          activeWorktreePath={activeWorktreePath}
          onEnvModeChange={onEnvModeChange}
        />
      ) : (
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          {showEnvironmentPicker && availableEnvironments && onEnvironmentChange && (
            <>
              <BranchToolbarEnvironmentSelector
                envLocked={envLocked}
                environmentId={environmentId}
                availableEnvironments={availableEnvironments}
                onEnvironmentChange={onEnvironmentChange}
              />
              <Separator orientation="vertical" className="mx-0.5 h-3.5!" />
            </>
          )}
          <BranchToolbarEnvModeSelector
            envLocked={envModeLocked}
            effectiveEnvMode={effectiveEnvMode}
            activeWorktreePath={activeWorktreePath}
            onEnvModeChange={onEnvModeChange}
          />
        </div>
      )}

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 md:flex-none">
        <RuntimeModePicker runtimeMode={runtimeMode} onRuntimeModeChange={onRuntimeModeChange} />
        <BranchToolbarBranchSelector
          className="min-w-0 flex-1 justify-end md:flex-none"
          environmentId={environmentId}
          threadId={threadId}
          {...(draftId ? { draftId } : {})}
          envLocked={envLocked}
          {...(effectiveEnvModeOverride ? { effectiveEnvModeOverride } : {})}
          {...(activeThreadBranchOverride !== undefined ? { activeThreadBranchOverride } : {})}
          {...(onActiveThreadBranchOverrideChange ? { onActiveThreadBranchOverrideChange } : {})}
          {...(onCheckoutPullRequestRequest ? { onCheckoutPullRequestRequest } : {})}
          {...(onComposerFocusRequest ? { onComposerFocusRequest } : {})}
        />
      </div>
    </div>
  );
});
