import type {
  GitPullRequestCheck,
  GitPullRequestChecksResult,
  GitPullRequestComment,
  GitPullRequestCommit,
  GitPullRequestReview,
  GitPullRequestReviewComment,
  GitStatusResult,
} from "@t3tools/contracts";
import {
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  GitCommitIcon,
  InfoIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import ChatMarkdown from "./ChatMarkdown";
import {
  normalizePullRequestMarkdown,
  sortPullRequestChecks,
  summarizePullRequestChecks,
} from "./pullRequestChecks";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { cn } from "~/lib/utils";

type PullRequest = NonNullable<GitStatusResult["pr"] | GitPullRequestChecksResult["pullRequest"]>;

interface PullRequestChecksPanelProps {
  pullRequest: PullRequest | null;
  checks: ReadonlyArray<GitPullRequestCheck>;
  commits: ReadonlyArray<GitPullRequestCommit>;
  comments: ReadonlyArray<GitPullRequestComment>;
  reviews: ReadonlyArray<GitPullRequestReview>;
  reviewComments: ReadonlyArray<GitPullRequestReviewComment>;
  isLoading: boolean;
  isChecksLoading?: boolean;
  isActivityLoading?: boolean;
  loadError: string | null;
  cwd?: string | undefined;
}

type TimelineItem =
  | { kind: "commit"; id: string; at: string | null; commit: GitPullRequestCommit }
  | { kind: "review"; id: string; at: string | null; review: GitPullRequestReview }
  | { kind: "comment"; id: string; at: string | null; comment: GitPullRequestComment }
  | { kind: "thread"; id: string; at: string | null; thread: ReviewThread };

interface ReviewThread {
  id: string;
  rootComment: GitPullRequestReviewComment;
  replies: GitPullRequestReviewComment[];
  isResolved: boolean;
  isOutdated: boolean;
}

function EmptyState({
  className,
  title,
  description,
}: {
  className?: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn("flex h-full min-h-0 items-center justify-center px-6 text-center", className)}
    >
      <div className="max-w-72 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ExternalLink({
  href,
  children,
  className,
}: {
  href?: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
    >
      {children}
    </a>
  );
}

function PullRequestMarkdown({ text, cwd }: { text: string; cwd?: string | undefined }) {
  const normalizedText = useMemo(() => normalizePullRequestMarkdown(text), [text]);
  return <ChatMarkdown text={normalizedText} cwd={cwd} />;
}

function statusToneClassName(status: GitPullRequestCheck["status"]) {
  switch (status) {
    case "pending":
      return "text-amber-500";
    case "failed":
      return "text-destructive";
    case "passed":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
}

function CheckStatusIcon({ status }: { status: GitPullRequestCheck["status"] }) {
  const className = cn("size-4 shrink-0", statusToneClassName(status));

  switch (status) {
    case "pending":
      return <LoaderCircleIcon className={cn(className, "animate-spin")} />;
    case "failed":
      return <XIcon className={className} />;
    case "passed":
      return <CheckIcon className={className} />;
    case "cancelled":
      return <ClockIcon className={className} />;
    case "skipped":
      return <InfoIcon className={className} />;
    default:
      return <InfoIcon className={className} />;
  }
}

function formatRelativeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString([], { dateStyle: "medium" });
}

function EventTimestamp({ value }: { value: string | null | undefined }) {
  const relative = formatRelativeTimestamp(value);
  if (!relative) return null;
  const absolute = value
    ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : null;

  return absolute ? (
    <Tooltip>
      <TooltipTrigger>
        <span className="text-muted-foreground/80">{relative}</span>
      </TooltipTrigger>
      <TooltipPopup side="top" align="end" className="text-xs">
        {absolute}
      </TooltipPopup>
    </Tooltip>
  ) : (
    <span className="text-muted-foreground/80">{relative}</span>
  );
}

function ChecksBlock({
  pullRequest,
  checks,
  isLoading,
}: {
  pullRequest: PullRequest;
  checks: ReadonlyArray<GitPullRequestCheck>;
  isLoading: boolean;
}) {
  const sorted = useMemo(() => sortPullRequestChecks(checks), [checks]);
  const summary = summarizePullRequestChecks(pullRequest, checks);
  const [isOpen, setIsOpen] = useState(summary.tone === "failed" || summary.tone === "waiting");

  useEffect(() => {
    if (summary.tone === "failed" || summary.tone === "waiting") {
      setIsOpen(true);
    }
  }, [summary.tone]);

  if (sorted.length === 0 && summary.totalCount === 0 && !isLoading) {
    return null;
  }

  const summaryIcon =
    summary.tone === "failed" ? (
      <XIcon className="size-4 shrink-0 text-destructive" />
    ) : summary.tone === "waiting" ? (
      <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-amber-500" />
    ) : summary.tone === "passed" ? (
      <CheckIcon className="size-4 shrink-0 text-emerald-500" />
    ) : (
      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
    );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="flex w-full items-center gap-2 py-1.5 text-left transition-colors"
        disabled={sorted.length === 0}
      >
        {isLoading && sorted.length === 0 && summary.totalCount === 0 ? (
          <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          summaryIcon
        )}
        <div
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            summary.tone === "failed" && "text-destructive",
            summary.tone === "waiting" && "text-amber-500",
            summary.tone === "passed" && "text-emerald-500",
          )}
        >
          {isLoading && sorted.length === 0 && summary.totalCount === 0
            ? "Loading checks"
            : summary.label}
        </div>
        {sorted.length > 0 ? (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1.5">
          {sorted.map((check) => (
            <li key={check.id} className="flex min-w-0 items-center gap-2 text-sm">
              <CheckStatusIcon status={check.status} />
              <ExternalLink
                href={check.detailsUrl}
                className="truncate text-foreground hover:underline"
              >
                {check.name}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function groupReviewThreads(
  reviewComments: ReadonlyArray<GitPullRequestReviewComment>,
): ReviewThread[] {
  const groups = new Map<string, GitPullRequestReviewComment[]>();
  for (const comment of reviewComments) {
    const existing = groups.get(comment.threadId) ?? [];
    existing.push(comment);
    groups.set(comment.threadId, existing);
  }

  return Array.from(groups.entries()).flatMap(([threadId, comments]) => {
    const sorted = comments.toSorted(
      (left, right) =>
        Date.parse(left.publishedAt ?? left.createdAt ?? "") -
        Date.parse(right.publishedAt ?? right.createdAt ?? ""),
    );
    const rootComment = sorted.find((comment) => !comment.replyToId) ?? sorted[0];
    if (!rootComment) return [];
    return [
      {
        id: threadId,
        rootComment,
        replies: sorted.filter((comment) => comment.id !== rootComment.id),
        isResolved: rootComment.isResolved,
        isOutdated: rootComment.isOutdated,
      },
    ];
  });
}

function buildTimeline(
  commits: ReadonlyArray<GitPullRequestCommit>,
  reviews: ReadonlyArray<GitPullRequestReview>,
  comments: ReadonlyArray<GitPullRequestComment>,
  reviewComments: ReadonlyArray<GitPullRequestReviewComment>,
): TimelineItem[] {
  const reviewIds = new Set(reviews.map((review) => review.id));
  const threads = groupReviewThreads(reviewComments).filter(
    (thread) =>
      !thread.rootComment.pullRequestReviewId ||
      !reviewIds.has(thread.rootComment.pullRequestReviewId),
  );
  const items: TimelineItem[] = [
    ...commits.map((commit) => ({
      kind: "commit" as const,
      id: commit.oid,
      at: commit.committedDate ?? commit.authoredDate ?? null,
      commit,
    })),
    ...reviews.map((review) => ({
      kind: "review" as const,
      id: review.id,
      at: review.submittedAt ?? null,
      review,
    })),
    ...comments.map((comment) => ({
      kind: "comment" as const,
      id: comment.id,
      at: comment.createdAt ?? null,
      comment,
    })),
    ...threads.map((thread) => ({
      kind: "thread" as const,
      id: thread.id,
      at: thread.rootComment.publishedAt ?? thread.rootComment.createdAt ?? null,
      thread,
    })),
  ];

  return items.toSorted((left, right) => Date.parse(left.at ?? "") - Date.parse(right.at ?? ""));
}

function TimelineAvatar({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-sidebar-border/70 bg-background text-muted-foreground">
      {children}
    </div>
  );
}

function Avatar({
  src,
  fallback,
  alt,
}: {
  src?: string | null | undefined;
  fallback: ReactNode;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => setHasError(false), [src]);

  return (
    <div className="size-5 shrink-0 overflow-hidden rounded-full border border-sidebar-border/60 bg-card">
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center">{fallback}</div>
      )}
    </div>
  );
}

function TimelineFrame({
  avatar,
  header,
  children,
}: {
  avatar: ReactNode;
  header: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="relative pl-9">
      <div className="absolute left-0 top-0 z-10 ring-2 ring-background">{avatar}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-h-5 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
          {header}
        </div>
        {children}
      </div>
    </li>
  );
}

function Timeline({ items, cwd }: { items: TimelineItem[]; cwd?: string | undefined }) {
  return (
    <ol className="relative space-y-3">
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-3 top-2 w-px bg-sidebar-border/50"
      />
      {items.map((item) => {
        if (item.kind === "commit") {
          return (
            <TimelineFrame
              key={`commit:${item.id}`}
              avatar={
                <TimelineAvatar>
                  <GitCommitIcon className="size-3.5" />
                </TimelineAvatar>
              }
              header={
                <>
                  <span className="truncate font-medium text-foreground">
                    {item.commit.authorLogin ?? item.commit.authorName ?? "Someone"}
                  </span>
                  <span>pushed a commit</span>
                  <span className="text-muted-foreground/60">·</span>
                  <EventTimestamp value={item.at} />
                </>
              }
            >
              <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-background/45 px-2.5 py-1.5 text-xs">
                <GitCommitIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <ExternalLink
                  href={item.commit.url}
                  className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                >
                  {item.commit.messageHeadline}
                </ExternalLink>
                <ExternalLink
                  href={item.commit.url}
                  className="rounded-md border border-sidebar-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground hover:text-foreground"
                >
                  {item.commit.abbreviatedOid}
                </ExternalLink>
              </div>
            </TimelineFrame>
          );
        }

        if (item.kind === "review") {
          return (
            <TimelineFrame
              key={`review:${item.id}`}
              avatar={
                <Avatar
                  src={item.review.authorAvatarUrl}
                  alt={`${item.review.authorLogin} avatar`}
                  fallback={<InfoIcon className="size-3.5" />}
                />
              }
              header={
                <>
                  <span className="truncate font-medium text-foreground">
                    {item.review.authorLogin}
                  </span>
                  <span>
                    {item.review.state === "APPROVED"
                      ? "approved"
                      : item.review.state === "CHANGES_REQUESTED"
                        ? "requested changes"
                        : "reviewed"}
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <EventTimestamp value={item.at} />
                </>
              }
            >
              {item.review.body ? (
                <div className="rounded-xl border border-sidebar-border/60 bg-background/55 px-3 py-2.5 text-xs text-muted-foreground">
                  <PullRequestMarkdown text={item.review.body} cwd={cwd} />
                </div>
              ) : null}
            </TimelineFrame>
          );
        }

        if (item.kind === "comment") {
          return (
            <TimelineFrame
              key={`comment:${item.id}`}
              avatar={
                <Avatar
                  src={item.comment.authorAvatarUrl}
                  alt={`${item.comment.authorLogin} avatar`}
                  fallback={<InfoIcon className="size-3.5" />}
                />
              }
              header={
                <>
                  <span className="truncate font-medium text-foreground">
                    {item.comment.authorLogin}
                  </span>
                  <span>commented</span>
                  <span className="text-muted-foreground/60">·</span>
                  <EventTimestamp value={item.at} />
                </>
              }
            >
              {item.comment.body ? (
                <div className="rounded-xl border border-sidebar-border/60 bg-background/55 px-3 py-2.5 text-xs text-muted-foreground">
                  <PullRequestMarkdown text={item.comment.body} cwd={cwd} />
                </div>
              ) : null}
            </TimelineFrame>
          );
        }

        return (
          <TimelineFrame
            key={`thread:${item.id}`}
            avatar={
              <Avatar
                src={item.thread.rootComment.authorAvatarUrl}
                alt={`${item.thread.rootComment.authorLogin} avatar`}
                fallback={<InfoIcon className="size-3.5" />}
              />
            }
            header={
              <>
                <span className="truncate font-medium text-foreground">
                  {item.thread.rootComment.authorLogin}
                </span>
                <span>commented on</span>
                <span className="max-w-44 truncate font-medium text-muted-foreground">
                  {item.thread.rootComment.path ?? "a file"}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <EventTimestamp value={item.at} />
              </>
            }
          >
            <div
              className={cn(
                "rounded-lg border border-sidebar-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground",
                (item.thread.isResolved || item.thread.isOutdated) && "opacity-80",
              )}
            >
              {item.thread.rootComment.body ? (
                <PullRequestMarkdown text={item.thread.rootComment.body} cwd={cwd} />
              ) : null}
              {item.thread.replies.length > 0 ? (
                <div className="mt-2 space-y-2 border-l border-sidebar-border/50 pl-3">
                  {item.thread.replies.map((reply) => (
                    <div key={reply.id}>
                      <div className="text-xs font-medium text-foreground">{reply.authorLogin}</div>
                      {reply.body ? <PullRequestMarkdown text={reply.body} cwd={cwd} /> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </TimelineFrame>
        );
      })}
    </ol>
  );
}

export function PullRequestChecksPanel({
  pullRequest,
  checks,
  commits,
  comments,
  reviews,
  reviewComments,
  isLoading,
  isChecksLoading = isLoading,
  isActivityLoading = false,
  loadError,
  cwd,
}: PullRequestChecksPanelProps) {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const normalizedChecks = Array.isArray(checks) ? checks : [];
  const timelineItems = useMemo(
    () => buildTimeline(commits, reviews, comments, reviewComments),
    [comments, commits, reviewComments, reviews],
  );
  const checksSummary = summarizePullRequestChecks(pullRequest, normalizedChecks);
  const shouldShowWaitingForChecks =
    normalizedChecks.length === 0 && checksSummary.tone === "waiting";

  if (!pullRequest || pullRequest.state !== "open") {
    return (
      <EmptyState
        title="No open pull request"
        description="Open a pull request on this branch to view checks here."
      />
    );
  }

  const hasAnyActivity =
    normalizedChecks.length > 0 ||
    timelineItems.length > 0 ||
    Boolean(loadError) ||
    shouldShowWaitingForChecks ||
    isChecksLoading ||
    isActivityLoading;
  const hasChecksSignal =
    normalizedChecks.length > 0 || checksSummary.totalCount > 0 || shouldShowWaitingForChecks;
  const emptyTitle = hasChecksSignal ? "No conversation yet" : "No activity yet";
  const emptyDescription = hasChecksSignal
    ? "Checks are visible here; reviews and comments will appear below when GitHub publishes them."
    : "This pull request has not published checks, reviews, or comments yet.";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 py-3">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{pullRequest.title}</h2>
          {pullRequest.description ? (
            <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ChevronRightIcon
                  className={cn(
                    "size-3 shrink-0 transition-transform",
                    isDescriptionOpen && "rotate-90",
                  )}
                />
                <span>Description</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1">
                <div className="text-xs leading-5 text-muted-foreground [&_h1]:!text-sm [&_h2]:!text-sm [&_h3]:!text-xs [&_p]:my-0 [&_p+p]:mt-1.5 [&_pre]:text-[11px] [&_code]:text-[11px]">
                  <PullRequestMarkdown text={pullRequest.description} cwd={cwd} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>

        {loadError ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        <ChecksBlock
          pullRequest={pullRequest}
          checks={normalizedChecks}
          isLoading={isChecksLoading}
        />

        {timelineItems.length > 0 || isActivityLoading ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-muted-foreground/72 uppercase">
              <span>Conversation</span>
              {isActivityLoading ? (
                <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            {timelineItems.length > 0 ? (
              <Timeline items={timelineItems} cwd={cwd} />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/50 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
                <span>Loading reviews and comments...</span>
              </div>
            )}
          </div>
        ) : null}

        {!hasAnyActivity && !loadError ? (
          <EmptyState
            className="h-auto min-h-40 py-10"
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : null}
      </div>
    </div>
  );
}
