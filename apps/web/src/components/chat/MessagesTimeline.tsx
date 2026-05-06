import { type EnvironmentId, type MessageId, type TurnId } from "@t3tools/contracts";
import {
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { deriveTimelineEntries, formatElapsed } from "../../session-logic";
import { type TurnDiffSummary } from "../../types";
import { summarizeTurnDiffStats } from "../../lib/turnDiffTree";
import ChatMarkdown from "../ChatMarkdown";
import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  EyeIcon,
  GlobeIcon,
  HammerIcon,
  ImageIcon,
  type LucideIcon,
  SearchIcon,
  SquarePenIcon,
  TerminalIcon,
  Undo2Icon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { LoadingDots } from "../ui/loading-dots";
import { buildExpandedImagePreview, ExpandedImagePreview } from "./ExpandedImagePreview";
import { ProposedPlanCard } from "./ProposedPlanCard";
import { ChangedFilesTree } from "./ChangedFilesTree";
import { DiffStatLabel, hasNonZeroStat } from "./DiffStatLabel";
import { MessageCopyButton } from "./MessageCopyButton";
import { ProjectFavicon } from "../ProjectFavicon";
import {
  computeStableMessagesTimelineRows,
  deriveMessagesTimelineRows,
  resolveAssistantMessageCopyState,
  type StableMessagesTimelineRowsState,
  type MessagesTimelineRow,
} from "./MessagesTimeline.logic";
import { TerminalContextInlineChip } from "./TerminalContextInlineChip";
import {
  deriveDisplayedUserMessageState,
  type ParsedTerminalContextEntry,
} from "~/lib/terminalContext";
import { cn } from "~/lib/utils";
import { useUiStateStore } from "~/uiStateStore";
import { type TimestampFormat } from "@t3tools/contracts/settings";
import { formatTimestamp } from "../../timestampFormat";

import {
  buildInlineTerminalContextText,
  formatInlineTerminalContextLabel,
  textContainsInlineTerminalContextLabels,
} from "./userMessageTerminalContexts";
import { formatWorkspaceRelativePath } from "../../filePathDisplay";
import {
  getToolActivityPresentation,
  type ToolActivityIconKind,
  type ToolActivityPresentation,
} from "./toolActivityPresentation";

// ---------------------------------------------------------------------------
// Context — shared state consumed by every row component via useContext.
// Propagates through LegendList's memo boundaries for shared callbacks and
// non-row-scoped state. `nowIso` is intentionally excluded — self-ticking
// components (WorkingTimer, LiveElapsed) handle it.
// ---------------------------------------------------------------------------

interface TimelineRowSharedState {
  activeTurnInProgress: boolean;
  activeTurnId: TurnId | null | undefined;
  isWorking: boolean;
  isRevertingCheckpoint: boolean;
  completionSummary: string | null;
  timestampFormat: TimestampFormat;
  routeThreadKey: string;
  markdownCwd: string | undefined;
  resolvedTheme: "light" | "dark";
  workspaceRoot: string | undefined;
  activeThreadEnvironmentId: EnvironmentId;
  onRevertUserMessage: (messageId: MessageId) => void;
  onImageExpand: (preview: ExpandedImagePreview) => void;
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
}

const TimelineRowCtx = createContext<TimelineRowSharedState>(null!);

// ---------------------------------------------------------------------------
// Props (public API)
// ---------------------------------------------------------------------------

interface MessagesTimelineProps {
  isWorking: boolean;
  activeTurnInProgress: boolean;
  activeTurnId?: TurnId | null;
  activeTurnStartedAt: string | null;
  listRef: React.RefObject<LegendListRef | null>;
  timelineEntries: ReturnType<typeof deriveTimelineEntries>;
  completionDividerBeforeEntryId: string | null;
  completionSummary: string | null;
  turnDiffSummaryByAssistantMessageId: Map<MessageId, TurnDiffSummary>;
  routeThreadKey: string;
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
  revertTurnCountByUserMessageId: Map<MessageId, number>;
  onRevertUserMessage: (messageId: MessageId) => void;
  isRevertingCheckpoint: boolean;
  onImageExpand: (preview: ExpandedImagePreview) => void;
  activeThreadEnvironmentId: EnvironmentId;
  markdownCwd: string | undefined;
  resolvedTheme: "light" | "dark";
  timestampFormat: TimestampFormat;
  workspaceRoot: string | undefined;
  activeProjectName?: string | null;
  activeProjectCwd?: string | null;
  onIsAtEndChange: (isAtEnd: boolean) => void;
}

const SCROLL_BOTTOM_THRESHOLD_PX = 8;

// ---------------------------------------------------------------------------
// MessagesTimeline — list owner
// ---------------------------------------------------------------------------

export const MessagesTimeline = memo(function MessagesTimeline({
  isWorking,
  activeTurnInProgress,
  activeTurnId,
  activeTurnStartedAt,
  listRef,
  timelineEntries,
  completionDividerBeforeEntryId,
  completionSummary,
  turnDiffSummaryByAssistantMessageId,
  routeThreadKey,
  onOpenTurnDiff,
  revertTurnCountByUserMessageId,
  onRevertUserMessage,
  isRevertingCheckpoint,
  onImageExpand,
  activeThreadEnvironmentId,
  markdownCwd,
  resolvedTheme,
  timestampFormat,
  workspaceRoot,
  activeProjectName,
  activeProjectCwd,
  onIsAtEndChange,
}: MessagesTimelineProps) {
  const rawRows = useMemo(
    () =>
      deriveMessagesTimelineRows({
        timelineEntries,
        completionDividerBeforeEntryId,
        isWorking,
        activeTurnStartedAt,
        turnDiffSummaryByAssistantMessageId,
        revertTurnCountByUserMessageId,
      }),
    [
      timelineEntries,
      completionDividerBeforeEntryId,
      isWorking,
      activeTurnStartedAt,
      turnDiffSummaryByAssistantMessageId,
      revertTurnCountByUserMessageId,
    ],
  );
  const rows = useStableRows(rawRows);

  const handleScroll = useCallback(() => {
    const state = listRef.current?.getState?.();
    if (state) {
      const scrollOffset = Math.max(0, Number.isFinite(state.scroll) ? state.scroll : 0);
      const contentSize = Math.max(
        0,
        Number.isFinite(state.contentLength) ? state.contentLength : 0,
      );
      const viewportSize = Math.max(
        0,
        Number.isFinite(state.scrollLength) ? state.scrollLength : 0,
      );
      const maxScrollOffset = Math.max(0, contentSize - viewportSize);
      const normalizedScrollOffset = Math.min(maxScrollOffset, scrollOffset);
      const distanceFromBottom = Math.max(0, contentSize - viewportSize - normalizedScrollOffset);
      const isAtBottom = state.isAtEnd || distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;

      onIsAtEndChange(isAtBottom);
    }
  }, [listRef, onIsAtEndChange]);

  const previousRowCountRef = useRef(rows.length);
  useEffect(() => {
    const previousRowCount = previousRowCountRef.current;
    previousRowCountRef.current = rows.length;

    if (previousRowCount > 0 || rows.length === 0) {
      return;
    }

    onIsAtEndChange(true);
    const frameId = window.requestAnimationFrame(() => {
      void listRef.current?.scrollToEnd?.({ animated: false });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [listRef, onIsAtEndChange, rows.length]);

  // Memoised context value — only changes on state transitions, NOT on
  // every streaming chunk. Callbacks from ChatView are useCallback-stable.
  const sharedState = useMemo<TimelineRowSharedState>(
    () => ({
      activeTurnInProgress,
      activeTurnId: activeTurnId ?? null,
      isWorking,
      isRevertingCheckpoint,
      completionSummary,
      timestampFormat,
      routeThreadKey,
      markdownCwd,
      resolvedTheme,
      workspaceRoot,
      activeThreadEnvironmentId,
      onRevertUserMessage,
      onImageExpand,
      onOpenTurnDiff,
    }),
    [
      activeTurnInProgress,
      activeTurnId,
      isWorking,
      isRevertingCheckpoint,
      completionSummary,
      timestampFormat,
      routeThreadKey,
      markdownCwd,
      resolvedTheme,
      workspaceRoot,
      activeThreadEnvironmentId,
      onRevertUserMessage,
      onImageExpand,
      onOpenTurnDiff,
    ],
  );

  // Stable renderItem — no closure deps. Row components read shared state
  // from TimelineRowCtx, which propagates through LegendList's memo.
  const renderItem = useCallback(
    ({ item }: { item: MessagesTimelineRow }) => (
      <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden" data-timeline-root="true">
        <TimelineRowContent row={item} />
      </div>
    ),
    [],
  );

  if (rows.length === 0 && !isWorking) {
    return (
      <EmptyChatProjectState
        environmentId={activeThreadEnvironmentId}
        projectName={activeProjectName ?? null}
        projectCwd={activeProjectCwd ?? null}
      />
    );
  }

  return (
    <TimelineRowCtx.Provider value={sharedState}>
      <LegendList<MessagesTimelineRow>
        ref={listRef}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={90}
        initialScrollAtEnd
        maintainScrollAtEnd
        maintainScrollAtEndThreshold={0.1}
        maintainVisibleContentPosition
        onScroll={handleScroll}
        className="h-full overflow-x-hidden overscroll-y-contain px-3 sm:px-5"
        ListHeaderComponent={<div className="h-3 sm:h-4" />}
        ListFooterComponent={<div className="h-3 sm:h-4" />}
      />
    </TimelineRowCtx.Provider>
  );
});

function EmptyChatProjectState({
  environmentId,
  projectName,
  projectCwd,
}: {
  environmentId: EnvironmentId;
  projectName?: string | null;
  projectCwd?: string | null;
}) {
  const displayName = projectName?.trim() || "this project";

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 pb-12 text-center">
      <div className="flex max-w-xl animate-in fade-in-0 zoom-in-95 duration-300 flex-col items-center">
        <div className="group relative mb-5 size-12 overflow-hidden rounded-[14px] bg-foreground/[0.03] ring-1 ring-foreground/[0.055] shadow-[0_18px_50px_color-mix(in_oklab,var(--foreground)_8%,transparent)] transition-transform duration-300 hover:scale-105">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
          />
          {projectCwd ? (
            <ProjectFavicon
              environmentId={environmentId}
              cwd={projectCwd}
              className="size-full rounded-[inherit] text-muted-foreground/55"
            />
          ) : (
            <div className="size-full rounded-[inherit] bg-muted/60" />
          )}
        </div>

        <div>
          <h2 className="text-pretty font-medium text-2xl text-foreground tracking-normal sm:text-3xl">
            What should we work on in {displayName}?
          </h2>
        </div>
      </div>
    </div>
  );
}

function keyExtractor(item: MessagesTimelineRow) {
  return item.id;
}

// ---------------------------------------------------------------------------
// TimelineRowContent — the actual row component
// ---------------------------------------------------------------------------

type TimelineEntry = ReturnType<typeof deriveTimelineEntries>[number];
type TimelineMessage = Extract<TimelineEntry, { kind: "message" }>["message"];
type TimelineWorkEntry = Extract<MessagesTimelineRow, { kind: "work" }>["entry"];
type TimelineRow = MessagesTimelineRow;

function TimelineRowContent({ row }: { row: TimelineRow }) {
  const ctx = use(TimelineRowCtx);

  return (
    <div
      className={cn(
        "pb-4",
        row.kind === "message" && row.message.role === "assistant" ? "group/assistant" : null,
      )}
      data-timeline-row-id={row.id}
      data-timeline-row-kind={row.kind}
      data-message-id={row.kind === "message" ? row.message.id : undefined}
      data-message-role={row.kind === "message" ? row.message.role : undefined}
    >
      {row.kind === "work" && <InlineWorkEntryRow workEntry={row.entry} />}

      {row.kind === "message" &&
        row.message.role === "user" &&
        (() => {
          const userImages = row.message.attachments ?? [];
          const displayedUserMessage = deriveDisplayedUserMessageState(row.message.text);
          const terminalContexts = displayedUserMessage.contexts;
          const canRevertAgentWork = typeof row.revertTurnCount === "number";
          return (
            <div className="group flex flex-col items-end gap-1">
              <div
                className="chat-user-message-bubble relative flex w-auto max-w-[min(42rem,78%)] flex-col gap-3 bg-[color:var(--color-message-user-bubble)] px-3 py-2 text-sm leading-6 text-[color:var(--color-message-user-bubble-foreground)]"
                title={formatTimestamp(row.message.createdAt, ctx.timestampFormat)}
              >
                {userImages.length > 0 && (
                  <div className="mb-2 grid max-w-[420px] grid-cols-2 gap-2">
                    {userImages.map(
                      (image: NonNullable<TimelineMessage["attachments"]>[number]) => (
                        <div
                          key={image.id}
                          className="overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--color-message-user-bubble-foreground)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--color-message-user-bubble-foreground)_10%,transparent)]"
                        >
                          {image.previewUrl ? (
                            <button
                              type="button"
                              className="h-full w-full cursor-zoom-in"
                              aria-label={`Preview ${image.name}`}
                              onClick={() => {
                                const preview = buildExpandedImagePreview(userImages, image.id);
                                if (!preview) return;
                                ctx.onImageExpand(preview);
                              }}
                            >
                              <img
                                src={image.previewUrl}
                                alt={image.name}
                                className="block h-auto max-h-[220px] w-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="flex min-h-[72px] items-center justify-center px-2 py-3 text-center text-[11px] text-[color:color-mix(in_oklab,var(--color-message-user-bubble-foreground)_76%,transparent)]">
                              {image.name}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {(displayedUserMessage.visibleText.trim().length > 0 ||
                  terminalContexts.length > 0) && (
                  <UserMessageBody
                    text={displayedUserMessage.visibleText}
                    terminalContexts={terminalContexts}
                  />
                )}
              </div>
              {(displayedUserMessage.copyText || canRevertAgentWork) && (
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
                  {displayedUserMessage.copyText && (
                    <MessageCopyButton
                      text={displayedUserMessage.copyText}
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                    />
                  )}
                  {canRevertAgentWork && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={ctx.isRevertingCheckpoint || ctx.isWorking}
                      onClick={() => ctx.onRevertUserMessage(row.message.id)}
                      title="Revert to this message"
                      className="text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                    >
                      <Undo2Icon className="size-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {row.kind === "message" &&
        row.message.role === "assistant" &&
        (() => {
          const messageText = row.message.text || (row.message.streaming ? "" : "(empty response)");
          const assistantTurnStillInProgress =
            ctx.activeTurnInProgress &&
            ctx.activeTurnId !== null &&
            ctx.activeTurnId !== undefined &&
            row.message.turnId === ctx.activeTurnId;
          const assistantCopyState = resolveAssistantMessageCopyState({
            text: row.message.text ?? null,
            showCopyButton: row.showAssistantCopyButton,
            streaming: row.message.streaming || assistantTurnStillInProgress,
          });
          return (
            <>
              {row.showCompletionDivider && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                    {ctx.completionSummary ? `Response • ${ctx.completionSummary}` : "Response"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="min-w-0 px-1 py-0.5">
                <ChatMarkdown
                  text={messageText}
                  cwd={ctx.markdownCwd}
                  isStreaming={Boolean(row.message.streaming)}
                />
                <AssistantChangedFilesSection
                  turnSummary={row.assistantTurnDiffSummary}
                  routeThreadKey={ctx.routeThreadKey}
                  resolvedTheme={ctx.resolvedTheme}
                  onOpenTurnDiff={ctx.onOpenTurnDiff}
                />
                {assistantCopyState.visible ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover/assistant:opacity-100">
                      <MessageCopyButton
                        text={assistantCopyState.text ?? ""}
                        size="icon-xs"
                        variant="outline"
                        className="border-border/50 bg-background/35 text-muted-foreground/45 shadow-none hover:border-border/70 hover:bg-background/55 hover:text-muted-foreground/70"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          );
        })()}

      {row.kind === "proposed-plan" && (
        <div className="min-w-0 px-1 py-0.5">
          <ProposedPlanCard
            planMarkdown={row.proposedPlan.planMarkdown}
            environmentId={ctx.activeThreadEnvironmentId}
            cwd={ctx.markdownCwd}
            workspaceRoot={ctx.workspaceRoot}
          />
        </div>
      )}

      {row.kind === "working" && <AssistantActivityFooter startedAt={row.createdAt} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Self-ticking components — bypass LegendList memoisation entirely.
// Each owns a `nowMs` state value consumed in the render output so the
// React Compiler cannot elide the re-render as a no-op.
// ---------------------------------------------------------------------------

const InlineWorkEntryRow = memo(function InlineWorkEntryRow({
  workEntry,
}: {
  workEntry: TimelineWorkEntry;
}) {
  const { workspaceRoot } = use(TimelineRowCtx);
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const presentation = useMemo(() => getToolActivityPresentation(workEntry), [workEntry]);
  const canExpand = presentation.details.length > 0;
  const ActivityIcon = toolActivityIcon(presentation.iconKind);
  const toneClass = toolActivityToneClass(presentation);

  const handleToggle = useCallback(() => {
    if (!canExpand) return;
    preserveScrollAnchor(buttonRef.current, () => setIsExpanded((value) => !value));
  }, [canExpand]);

  return (
    <div className={cn("group w-full py-0 text-sm leading-5", toneClass)}>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 text-left align-top",
          canExpand ? "hover:text-foreground/88" : "cursor-default",
        )}
        disabled={!canExpand}
        aria-expanded={canExpand ? isExpanded : undefined}
        onClick={handleToggle}
      >
        <ActivityIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span className="min-w-0 flex-1">
          <ToolActivitySummary presentation={presentation} workspaceRoot={workspaceRoot} />
        </span>
        {canExpand && (
          <span
            className={cn(
              "shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100",
              isExpanded && "opacity-100",
            )}
          >
            {isExpanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </span>
        )}
      </button>
      {canExpand && isExpanded && (
        <div className="mt-2 space-y-2 pl-5">
          {presentation.details.map((detail) => (
            <ToolActivityDetail key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>
      )}
    </div>
  );
});

function ToolActivitySummary({
  presentation,
  workspaceRoot,
}: {
  presentation: ToolActivityPresentation;
  workspaceRoot: string | undefined;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span className="shrink-0">{presentation.verb}</span>
      {presentation.target && (
        <ToolActivityTarget
          value={presentation.target}
          kind={presentation.targetKind}
          workspaceRoot={workspaceRoot}
        />
      )}
    </span>
  );
}

function ToolActivityTarget({
  value,
  kind,
  workspaceRoot,
}: {
  value: string;
  kind: ToolActivityPresentation["targetKind"];
  workspaceRoot: string | undefined;
}) {
  if (kind === "code") {
    return (
      <span
        title={value}
        className="inline-block min-w-0 max-w-[min(28rem,62vw)] truncate align-bottom font-mono text-[0.95em] text-foreground/84"
      >
        {value}
      </span>
    );
  }

  const displayValue = kind === "path" ? formatWorkspaceRelativePath(value, workspaceRoot) : value;

  return (
    <span
      title={displayValue}
      className={cn(
        "inline-block min-w-0 max-w-[min(24rem,58vw)] truncate align-bottom",
        kind === "path" ? "font-mono text-[color:var(--color-chat-file-accent)]" : "",
      )}
    >
      {displayValue}
    </span>
  );
}

function ToolActivityDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">
        {label}
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/35 px-3 py-2 font-mono text-[11px] leading-5 text-foreground/80">
        {value}
      </pre>
    </div>
  );
}

/** Subscribes directly to the UI state store for expand/collapse state,
 *  so toggling re-renders only this component — not the entire list. */
const AssistantChangedFilesSection = memo(function AssistantChangedFilesSection({
  turnSummary,
  routeThreadKey,
  resolvedTheme,
  onOpenTurnDiff,
}: {
  turnSummary: TurnDiffSummary | undefined;
  routeThreadKey: string;
  resolvedTheme: "light" | "dark";
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
}) {
  if (!turnSummary) return null;
  const checkpointFiles = turnSummary.files;
  if (checkpointFiles.length === 0) return null;

  return (
    <AssistantChangedFilesSectionInner
      turnSummary={turnSummary}
      checkpointFiles={checkpointFiles}
      routeThreadKey={routeThreadKey}
      resolvedTheme={resolvedTheme}
      onOpenTurnDiff={onOpenTurnDiff}
    />
  );
});

/** Inner component that only mounts when there are actual changed files,
 *  so the store subscription is unconditional (no hooks after early return). */
function AssistantChangedFilesSectionInner({
  turnSummary,
  checkpointFiles,
  routeThreadKey,
  resolvedTheme,
  onOpenTurnDiff,
}: {
  turnSummary: TurnDiffSummary;
  checkpointFiles: TurnDiffSummary["files"];
  routeThreadKey: string;
  resolvedTheme: "light" | "dark";
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
}) {
  const allDirectoriesExpanded = useUiStateStore(
    (store) => store.threadChangedFilesExpandedById[routeThreadKey]?.[turnSummary.turnId] ?? true,
  );
  const setExpanded = useUiStateStore((store) => store.setThreadChangedFilesExpanded);
  const summaryStat = summarizeTurnDiffStats(checkpointFiles);
  const changedFileCountLabel = String(checkpointFiles.length);

  return (
    <div className="mt-2 rounded-lg border border-border/80 bg-card/45 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
          <span>Changed files ({changedFileCountLabel})</span>
          {hasNonZeroStat(summaryStat) && (
            <>
              <span className="mx-1">•</span>
              <DiffStatLabel additions={summaryStat.additions} deletions={summaryStat.deletions} />
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            data-scroll-anchor-ignore
            onClick={() => setExpanded(routeThreadKey, turnSummary.turnId, !allDirectoriesExpanded)}
          >
            {allDirectoriesExpanded ? "Collapse all" : "Expand all"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onOpenTurnDiff(turnSummary.turnId, checkpointFiles[0]?.path)}
          >
            View diff
          </Button>
        </div>
      </div>
      <ChangedFilesTree
        key={`changed-files-tree:${turnSummary.turnId}`}
        turnId={turnSummary.turnId}
        files={checkpointFiles}
        allDirectoriesExpanded={allDirectoriesExpanded}
        resolvedTheme={resolvedTheme}
        onOpenTurnDiff={onOpenTurnDiff}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaf components
// ---------------------------------------------------------------------------

const UserMessageTerminalContextInlineLabel = memo(
  function UserMessageTerminalContextInlineLabel(props: { context: ParsedTerminalContextEntry }) {
    const tooltipText =
      props.context.body.length > 0
        ? `${props.context.header}\n${props.context.body}`
        : props.context.header;

    return <TerminalContextInlineChip label={props.context.header} tooltipText={tooltipText} />;
  },
);

const UserMessageBody = memo(function UserMessageBody(props: {
  text: string;
  terminalContexts: ParsedTerminalContextEntry[];
}) {
  if (props.terminalContexts.length > 0) {
    const hasEmbeddedInlineLabels = textContainsInlineTerminalContextLabels(
      props.text,
      props.terminalContexts,
    );
    const inlinePrefix = buildInlineTerminalContextText(props.terminalContexts);
    const inlineNodes: ReactNode[] = [];

    if (hasEmbeddedInlineLabels) {
      let cursor = 0;

      for (const context of props.terminalContexts) {
        const label = formatInlineTerminalContextLabel(context.header);
        const matchIndex = props.text.indexOf(label, cursor);
        if (matchIndex === -1) {
          inlineNodes.length = 0;
          break;
        }
        if (matchIndex > cursor) {
          inlineNodes.push(
            <span key={`user-terminal-context-inline-before:${context.header}:${cursor}`}>
              {props.text.slice(cursor, matchIndex)}
            </span>,
          );
        }
        inlineNodes.push(
          <UserMessageTerminalContextInlineLabel
            key={`user-terminal-context-inline:${context.header}`}
            context={context}
          />,
        );
        cursor = matchIndex + label.length;
      }

      if (inlineNodes.length > 0) {
        if (cursor < props.text.length) {
          inlineNodes.push(
            <span key={`user-message-terminal-context-inline-rest:${cursor}`}>
              {props.text.slice(cursor)}
            </span>,
          );
        }

        return (
          <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-[color:var(--color-message-user-bubble-foreground)]">
            {inlineNodes}
          </div>
        );
      }
    }

    for (const context of props.terminalContexts) {
      inlineNodes.push(
        <UserMessageTerminalContextInlineLabel
          key={`user-terminal-context-inline:${context.header}`}
          context={context}
        />,
      );
      inlineNodes.push(
        <span key={`user-terminal-context-inline-space:${context.header}`} aria-hidden="true">
          {" "}
        </span>,
      );
    }

    if (props.text.length > 0) {
      inlineNodes.push(<span key="user-message-terminal-context-inline-text">{props.text}</span>);
    } else if (inlinePrefix.length === 0) {
      return null;
    }

    return (
      <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-[color:var(--color-message-user-bubble-foreground)]">
        {inlineNodes}
      </div>
    );
  }

  if (props.text.length === 0) {
    return null;
  }

  return (
    <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-[color:var(--color-message-user-bubble-foreground)]">
      {props.text}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Structural sharing — reuse old row references when data hasn't changed
// so LegendList (and React) can skip re-rendering unchanged items.
// ---------------------------------------------------------------------------

/** Returns a structurally-shared copy of `rows`: for each row whose content
 *  hasn't changed since last call, the previous object reference is reused. */
function useStableRows(rows: MessagesTimelineRow[]): MessagesTimelineRow[] {
  const prevState = useRef<StableMessagesTimelineRowsState>({
    byId: new Map<string, MessagesTimelineRow>(),
    result: [],
  });

  return useMemo(() => {
    const nextState = computeStableMessagesTimelineRows(rows, prevState.current);
    prevState.current = nextState;
    return nextState.result;
  }, [rows]);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function toolActivityIcon(kind: ToolActivityIconKind): LucideIcon {
  switch (kind) {
    case "terminal":
      return TerminalIcon;
    case "read":
      return EyeIcon;
    case "search":
      return SearchIcon;
    case "edit":
      return SquarePenIcon;
    case "web":
      return GlobeIcon;
    case "image":
      return ImageIcon;
    case "mcp":
      return WrenchIcon;
    case "subagent":
      return HammerIcon;
    case "thought":
      return BrainIcon;
    case "todo":
      return CheckIcon;
    case "error":
      return CircleAlertIcon;
    case "info":
      return CheckIcon;
  }
}

function toolActivityToneClass(presentation: Pick<ToolActivityPresentation, "tone">): string {
  if (presentation.tone === "error") return "text-rose-300/70 dark:text-rose-300/70";
  if (presentation.tone === "muted") return "text-muted-foreground/58";
  return "text-muted-foreground/78";
}

function findScrollableParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(`${style.overflowY}${style.overflow}`)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function preserveScrollAnchor(anchor: HTMLElement | null, update: () => void) {
  const scrollParent = findScrollableParent(anchor);
  const beforeTop = anchor?.getBoundingClientRect().top ?? null;
  update();
  if (!anchor || beforeTop === null) return;

  window.requestAnimationFrame(() => {
    const afterTop = anchor.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;
    if (delta === 0) return;
    if (scrollParent) {
      scrollParent.scrollTop += delta;
      return;
    }
    window.scrollBy({ top: delta });
  });
}

function AssistantActivityFooter({ startedAt }: { startedAt: string | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = startedAt ? formatElapsed(startedAt, new Date(nowMs).toISOString()) : null;

  return (
    <div className="mt-5 flex h-5 items-center gap-2 px-1 text-xs tracking-[0.01em] text-muted-foreground/80 tabular-nums">
      <LoadingDots className="shrink-0" />
      {elapsed ? <span>{elapsed}</span> : null}
    </div>
  );
}
