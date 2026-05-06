import { Schema } from "effect";
import { NonNegativeInt, PositiveInt, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;
const GIT_LIST_BRANCHES_MAX_LIMIT = 200;

// Domain Types

export const GitStackedAction = Schema.Literals([
  "commit",
  "push",
  "create_pr",
  "commit_push",
  "commit_push_pr",
]);
export type GitStackedAction = typeof GitStackedAction.Type;
export const GitActionProgressPhase = Schema.Literals(["branch", "commit", "push", "pr"]);
export type GitActionProgressPhase = typeof GitActionProgressPhase.Type;
export const GitActionProgressKind = Schema.Literals([
  "action_started",
  "phase_started",
  "hook_started",
  "hook_output",
  "hook_finished",
  "action_finished",
  "action_failed",
]);
export type GitActionProgressKind = typeof GitActionProgressKind.Type;
export const GitActionProgressStream = Schema.Literals(["stdout", "stderr"]);
export type GitActionProgressStream = typeof GitActionProgressStream.Type;
const GitCommitStepStatus = Schema.Literals([
  "created",
  "skipped_no_changes",
  "skipped_not_requested",
]);
const GitPushStepStatus = Schema.Literals([
  "pushed",
  "skipped_not_requested",
  "skipped_up_to_date",
]);
const GitBranchStepStatus = Schema.Literals(["created", "skipped_not_requested"]);
const GitPrStepStatus = Schema.Literals(["created", "opened_existing", "skipped_not_requested"]);
const GitStatusPrState = Schema.Literals(["open", "closed", "merged"]);
const GitPullRequestReference = TrimmedNonEmptyStringSchema;
const GitPullRequestState = Schema.Literals(["open", "closed", "merged"]);
const GitPreparePullRequestThreadMode = Schema.Literals(["local", "worktree"]);
export const GitHostingProviderKind = Schema.Literals(["github", "gitlab", "unknown"]);
export type GitHostingProviderKind = typeof GitHostingProviderKind.Type;
export const GitHostingProvider = Schema.Struct({
  kind: GitHostingProviderKind,
  name: TrimmedNonEmptyStringSchema,
  baseUrl: Schema.String,
});
export type GitHostingProvider = typeof GitHostingProvider.Type;
export const GitRunStackedActionToastRunAction = Schema.Struct({
  kind: GitStackedAction,
});
export type GitRunStackedActionToastRunAction = typeof GitRunStackedActionToastRunAction.Type;
const GitRunStackedActionToastCta = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("none"),
  }),
  Schema.Struct({
    kind: Schema.Literal("open_pr"),
    label: TrimmedNonEmptyStringSchema,
    url: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("run_action"),
    label: TrimmedNonEmptyStringSchema,
    action: GitRunStackedActionToastRunAction,
  }),
]);
export type GitRunStackedActionToastCta = typeof GitRunStackedActionToastCta.Type;
const GitRunStackedActionToast = Schema.Struct({
  title: TrimmedNonEmptyStringSchema,
  description: Schema.optional(TrimmedNonEmptyStringSchema),
  cta: GitRunStackedActionToastCta,
});
export type GitRunStackedActionToast = typeof GitRunStackedActionToast.Type;

export const GitBranch = Schema.Struct({
  name: TrimmedNonEmptyStringSchema,
  isRemote: Schema.optional(Schema.Boolean),
  remoteName: Schema.optional(TrimmedNonEmptyStringSchema),
  current: Schema.Boolean,
  isDefault: Schema.Boolean,
  worktreePath: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitBranch = typeof GitBranch.Type;

const GitWorktree = Schema.Struct({
  path: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
const GitResolvedPullRequest = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyStringSchema,
  url: Schema.String,
  baseBranch: TrimmedNonEmptyStringSchema,
  headBranch: TrimmedNonEmptyStringSchema,
  state: GitPullRequestState,
});
export type GitResolvedPullRequest = typeof GitResolvedPullRequest.Type;

// RPC Inputs

export const GitStatusInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitStatusInput = typeof GitStatusInput.Type;

export const GitPullInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitPullInput = typeof GitPullInput.Type;

export const GitRunStackedActionInput = Schema.Struct({
  actionId: TrimmedNonEmptyStringSchema,
  cwd: TrimmedNonEmptyStringSchema,
  action: GitStackedAction,
  commitMessage: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(10_000))),
  featureBranch: Schema.optional(Schema.Boolean),
  filePaths: Schema.optional(
    Schema.Array(TrimmedNonEmptyStringSchema).check(Schema.isMinLength(1)),
  ),
});
export type GitRunStackedActionInput = typeof GitRunStackedActionInput.Type;

export const GitListBranchesInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  query: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(256))),
  cursor: Schema.optional(NonNegativeInt),
  limit: Schema.optional(
    PositiveInt.check(Schema.isLessThanOrEqualTo(GIT_LIST_BRANCHES_MAX_LIMIT)),
  ),
});
export type GitListBranchesInput = typeof GitListBranchesInput.Type;

export const GitCreateWorktreeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  newBranch: Schema.optional(TrimmedNonEmptyStringSchema),
  path: Schema.NullOr(TrimmedNonEmptyStringSchema),
});
export type GitCreateWorktreeInput = typeof GitCreateWorktreeInput.Type;

export const GitPullRequestRefInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  reference: GitPullRequestReference,
});
export type GitPullRequestRefInput = typeof GitPullRequestRefInput.Type;

export const GitPreparePullRequestThreadInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  reference: GitPullRequestReference,
  mode: GitPreparePullRequestThreadMode,
  threadId: Schema.optional(ThreadId),
});
export type GitPreparePullRequestThreadInput = typeof GitPreparePullRequestThreadInput.Type;

export const GitRemoveWorktreeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: TrimmedNonEmptyStringSchema,
  force: Schema.optional(Schema.Boolean),
});
export type GitRemoveWorktreeInput = typeof GitRemoveWorktreeInput.Type;

export const GitCreateBranchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  checkout: Schema.optional(Schema.Boolean),
});
export type GitCreateBranchInput = typeof GitCreateBranchInput.Type;

export const GitCreateBranchResult = Schema.Struct({
  branch: TrimmedNonEmptyStringSchema,
});
export type GitCreateBranchResult = typeof GitCreateBranchResult.Type;

export const GitCheckoutInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
export type GitCheckoutInput = typeof GitCheckoutInput.Type;

export const GitInitInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitInitInput = typeof GitInitInput.Type;

// RPC Results

const GitStatusPr = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyStringSchema,
  description: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  url: Schema.String,
  baseBranch: TrimmedNonEmptyStringSchema,
  headBranch: TrimmedNonEmptyStringSchema,
  state: GitStatusPrState,
  checksStatus: Schema.optional(Schema.Literals(["none", "pending", "passed", "failed"])),
  checksError: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  failedChecksCount: Schema.optional(NonNegativeInt),
  failedCheckNames: Schema.optional(Schema.Array(TrimmedNonEmptyStringSchema)),
  pendingChecksCount: Schema.optional(NonNegativeInt),
  passedChecksCount: Schema.optional(NonNegativeInt),
});

const GitStatusLocalShape = {
  isRepo: Schema.Boolean,
  hostingProvider: Schema.optional(GitHostingProvider),
  hasOriginRemote: Schema.Boolean,
  isDefaultBranch: Schema.Boolean,
  branch: Schema.NullOr(TrimmedNonEmptyStringSchema),
  hasWorkingTreeChanges: Schema.Boolean,
  workingTree: Schema.Struct({
    files: Schema.Array(
      Schema.Struct({
        path: TrimmedNonEmptyStringSchema,
        insertions: NonNegativeInt,
        deletions: NonNegativeInt,
      }),
    ),
    insertions: NonNegativeInt,
    deletions: NonNegativeInt,
  }),
};

const GitStatusRemoteShape = {
  hasUpstream: Schema.Boolean,
  aheadCount: NonNegativeInt,
  behindCount: NonNegativeInt,
  pr: Schema.NullOr(GitStatusPr),
};

export const GitStatusLocalResult = Schema.Struct(GitStatusLocalShape);
export type GitStatusLocalResult = typeof GitStatusLocalResult.Type;

export const GitStatusRemoteResult = Schema.Struct(GitStatusRemoteShape);
export type GitStatusRemoteResult = typeof GitStatusRemoteResult.Type;

export const GitStatusResult = Schema.Struct({
  ...GitStatusLocalShape,
  ...GitStatusRemoteShape,
});
export type GitStatusResult = typeof GitStatusResult.Type;

export const GitStatusStreamEvent = Schema.Union([
  Schema.TaggedStruct("snapshot", {
    local: GitStatusLocalResult,
    remote: Schema.NullOr(GitStatusRemoteResult),
  }),
  Schema.TaggedStruct("localUpdated", {
    local: GitStatusLocalResult,
  }),
  Schema.TaggedStruct("remoteUpdated", {
    remote: Schema.NullOr(GitStatusRemoteResult),
  }),
]);
export type GitStatusStreamEvent = typeof GitStatusStreamEvent.Type;

export const GitListBranchesResult = Schema.Struct({
  branches: Schema.Array(GitBranch),
  isRepo: Schema.Boolean,
  hasOriginRemote: Schema.Boolean,
  nextCursor: NonNegativeInt.pipe(Schema.NullOr),
  totalCount: NonNegativeInt,
});
export type GitListBranchesResult = typeof GitListBranchesResult.Type;

export const GitCreateWorktreeResult = Schema.Struct({
  worktree: GitWorktree,
});
export type GitCreateWorktreeResult = typeof GitCreateWorktreeResult.Type;

export const GitResolvePullRequestResult = Schema.Struct({
  pullRequest: GitResolvedPullRequest,
});
export type GitResolvePullRequestResult = typeof GitResolvePullRequestResult.Type;

export const GitPreparePullRequestThreadResult = Schema.Struct({
  pullRequest: GitResolvedPullRequest,
  branch: TrimmedNonEmptyStringSchema,
  worktreePath: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitPreparePullRequestThreadResult = typeof GitPreparePullRequestThreadResult.Type;

export const GitPullRequestChecksInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  includeActivity: Schema.optional(Schema.Boolean),
});
export type GitPullRequestChecksInput = typeof GitPullRequestChecksInput.Type;

export const GitPullRequestCheckStatus = Schema.Literals([
  "pending",
  "passed",
  "failed",
  "cancelled",
  "skipped",
]);
export type GitPullRequestCheckStatus = typeof GitPullRequestCheckStatus.Type;

export const GitPullRequestCheck = Schema.Struct({
  id: TrimmedNonEmptyStringSchema,
  name: TrimmedNonEmptyStringSchema,
  workflowName: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  description: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  event: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  status: GitPullRequestCheckStatus,
  startedAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  completedAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  detailsUrl: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  errorText: Schema.optional(Schema.String),
  errorCopyText: Schema.optional(Schema.String),
  hasFailureDetails: Schema.Boolean,
});
export type GitPullRequestCheck = typeof GitPullRequestCheck.Type;

export const GitPullRequestReviewState = Schema.Literals([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
  "UNKNOWN",
]);
export type GitPullRequestReviewState = typeof GitPullRequestReviewState.Type;

export const GitPullRequestReview = Schema.Struct({
  id: TrimmedNonEmptyStringSchema,
  authorLogin: TrimmedNonEmptyStringSchema,
  authorAvatarUrl: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorAssociation: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  body: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  state: GitPullRequestReviewState,
  submittedAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  commitOid: Schema.optional(Schema.String.pipe(Schema.NullOr)),
});
export type GitPullRequestReview = typeof GitPullRequestReview.Type;

export const GitPullRequestComment = Schema.Struct({
  id: TrimmedNonEmptyStringSchema,
  authorLogin: TrimmedNonEmptyStringSchema,
  authorAvatarUrl: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorAssociation: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  body: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  createdAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  url: Schema.optional(Schema.String.pipe(Schema.NullOr)),
});
export type GitPullRequestComment = typeof GitPullRequestComment.Type;

export const GitPullRequestCommit = Schema.Struct({
  oid: TrimmedNonEmptyStringSchema,
  abbreviatedOid: TrimmedNonEmptyStringSchema,
  messageHeadline: TrimmedNonEmptyStringSchema,
  messageBody: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authoredDate: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  committedDate: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  url: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorName: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorEmail: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorLogin: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorAvatarUrl: Schema.optional(Schema.String.pipe(Schema.NullOr)),
});
export type GitPullRequestCommit = typeof GitPullRequestCommit.Type;

export const GitPullRequestReviewComment = Schema.Struct({
  id: TrimmedNonEmptyStringSchema,
  threadId: TrimmedNonEmptyStringSchema,
  pullRequestReviewId: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  authorLogin: TrimmedNonEmptyStringSchema,
  authorAvatarUrl: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  body: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  path: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  state: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  createdAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  publishedAt: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  url: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  diffHunk: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  line: Schema.optional(NonNegativeInt.pipe(Schema.NullOr)),
  startLine: Schema.optional(NonNegativeInt.pipe(Schema.NullOr)),
  originalLine: Schema.optional(NonNegativeInt.pipe(Schema.NullOr)),
  originalStartLine: Schema.optional(NonNegativeInt.pipe(Schema.NullOr)),
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  replyToId: Schema.optional(Schema.String.pipe(Schema.NullOr)),
});
export type GitPullRequestReviewComment = typeof GitPullRequestReviewComment.Type;

export const GitPullRequestChecksResult = Schema.Struct({
  pullRequest: GitStatusPr.pipe(Schema.NullOr),
  checks: Schema.Array(GitPullRequestCheck),
  commits: Schema.Array(GitPullRequestCommit),
  reviews: Schema.Array(GitPullRequestReview),
  comments: Schema.Array(GitPullRequestComment),
  reviewComments: Schema.Array(GitPullRequestReviewComment),
  pullRequestNumber: PositiveInt.pipe(Schema.NullOr),
  error: Schema.optional(Schema.String.pipe(Schema.NullOr)),
  activityIncluded: Schema.optional(Schema.Boolean),
  activityError: Schema.optional(Schema.String.pipe(Schema.NullOr)),
});
export type GitPullRequestChecksResult = typeof GitPullRequestChecksResult.Type;

export const GitCheckoutResult = Schema.Struct({
  branch: Schema.NullOr(TrimmedNonEmptyStringSchema),
});
export type GitCheckoutResult = typeof GitCheckoutResult.Type;

export const GitRunStackedActionResult = Schema.Struct({
  action: GitStackedAction,
  branch: Schema.Struct({
    status: GitBranchStepStatus,
    name: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
  commit: Schema.Struct({
    status: GitCommitStepStatus,
    commitSha: Schema.optional(TrimmedNonEmptyStringSchema),
    subject: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
  push: Schema.Struct({
    status: GitPushStepStatus,
    branch: Schema.optional(TrimmedNonEmptyStringSchema),
    upstreamBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    setUpstream: Schema.optional(Schema.Boolean),
  }),
  pr: Schema.Struct({
    status: GitPrStepStatus,
    url: Schema.optional(Schema.String),
    number: Schema.optional(PositiveInt),
    baseBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    headBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    title: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
  toast: GitRunStackedActionToast,
});
export type GitRunStackedActionResult = typeof GitRunStackedActionResult.Type;

export const GitPullResult = Schema.Struct({
  status: Schema.Literals(["pulled", "skipped_up_to_date"]),
  branch: TrimmedNonEmptyStringSchema,
  upstreamBranch: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitPullResult = typeof GitPullResult.Type;

// RPC / domain errors
export class GitCommandError extends Schema.TaggedErrorClass<GitCommandError>()("GitCommandError", {
  operation: Schema.String,
  command: Schema.String,
  cwd: Schema.String,
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message(): string {
    return `Git command failed in ${this.operation}: ${this.command} (${this.cwd}) - ${this.detail}`;
  }
}

export class GitHubCliError extends Schema.TaggedErrorClass<GitHubCliError>()("GitHubCliError", {
  operation: Schema.String,
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message(): string {
    return `GitHub CLI failed in ${this.operation}: ${this.detail}`;
  }
}

export class TextGenerationError extends Schema.TaggedErrorClass<TextGenerationError>()(
  "TextGenerationError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Text generation failed in ${this.operation}: ${this.detail}`;
  }
}

export class GitManagerError extends Schema.TaggedErrorClass<GitManagerError>()("GitManagerError", {
  operation: Schema.String,
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message(): string {
    return `Git manager failed in ${this.operation}: ${this.detail}`;
  }
}

export const GitManagerServiceError = Schema.Union([
  GitManagerError,
  GitCommandError,
  GitHubCliError,
  TextGenerationError,
]);
export type GitManagerServiceError = typeof GitManagerServiceError.Type;

const GitActionProgressBase = Schema.Struct({
  actionId: TrimmedNonEmptyStringSchema,
  cwd: TrimmedNonEmptyStringSchema,
  action: GitStackedAction,
});

const GitActionStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_started"),
  phases: Schema.Array(GitActionProgressPhase),
});
const GitActionPhaseStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("phase_started"),
  phase: GitActionProgressPhase,
  label: TrimmedNonEmptyStringSchema,
});
const GitActionHookStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_started"),
  hookName: TrimmedNonEmptyStringSchema,
});
const GitActionHookOutputEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_output"),
  hookName: Schema.NullOr(TrimmedNonEmptyStringSchema),
  stream: GitActionProgressStream,
  text: TrimmedNonEmptyStringSchema,
});
const GitActionHookFinishedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_finished"),
  hookName: TrimmedNonEmptyStringSchema,
  exitCode: Schema.NullOr(Schema.Int),
  durationMs: Schema.NullOr(NonNegativeInt),
});
const GitActionFinishedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_finished"),
  result: GitRunStackedActionResult,
});
const GitActionFailedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_failed"),
  phase: Schema.NullOr(GitActionProgressPhase),
  message: TrimmedNonEmptyStringSchema,
});

export const GitActionProgressEvent = Schema.Union([
  GitActionStartedEvent,
  GitActionPhaseStartedEvent,
  GitActionHookStartedEvent,
  GitActionHookOutputEvent,
  GitActionHookFinishedEvent,
  GitActionFinishedEvent,
  GitActionFailedEvent,
]);
export type GitActionProgressEvent = typeof GitActionProgressEvent.Type;
