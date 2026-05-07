import { useQuery } from "@tanstack/react-query";
import type {
  EnvironmentId,
  GitPullRequestChecksResult,
  GitStatusResult,
} from "@t3tools/contracts";

import { readEnvironmentApi } from "../environmentApi";
import { useGitStatus } from "../lib/gitStatusState";

const PULL_REQUEST_CHECKS_POLL_INTERVAL_MS = 5_000;

type PullRequest = NonNullable<GitStatusResult["pr"] | GitPullRequestChecksResult["pullRequest"]>;

function hasPendingPullRequestChecks(pullRequest: PullRequest | null | undefined): boolean {
  return (
    pullRequest?.checksStatus === "pending" ||
    (pullRequest?.pendingChecksCount !== undefined && pullRequest.pendingChecksCount > 0)
  );
}

export function usePullRequestChecks(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  enabled?: boolean;
}) {
  const enabled = input.enabled ?? true;
  const gitStatus = useGitStatus({ environmentId: input.environmentId, cwd: input.cwd });
  const openPullRequest = gitStatus.data?.pr?.state === "open" ? gitStatus.data.pr : null;
  const queryEnabled =
    enabled && input.environmentId !== null && input.cwd !== null && openPullRequest !== null;

  const checksQuery = useQuery({
    queryKey: [
      "git",
      "pull-request-checks",
      "checks",
      input.environmentId,
      input.cwd,
      openPullRequest?.number,
    ],
    enabled: queryEnabled,
    refetchInterval: (query) =>
      hasPendingPullRequestChecks(query.state.data?.pullRequest ?? openPullRequest)
        ? PULL_REQUEST_CHECKS_POLL_INTERVAL_MS
        : false,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!input.environmentId || !input.cwd) {
        throw new Error("Cannot load pull request checks without an environment and cwd.");
      }
      const api = readEnvironmentApi(input.environmentId);
      if (!api) {
        throw new Error(`Environment API not found for environment ${input.environmentId}.`);
      }
      return api.git.getPullRequestChecks({
        cwd: input.cwd,
        includeActivity: false,
      });
    },
  });
  const currentPullRequest = checksQuery.data?.pullRequest ?? openPullRequest;
  const shouldLoadActivity = queryEnabled && !hasPendingPullRequestChecks(currentPullRequest);
  const activityQuery = useQuery({
    queryKey: [
      "git",
      "pull-request-checks",
      "activity",
      input.environmentId,
      input.cwd,
      currentPullRequest?.number,
    ],
    enabled: shouldLoadActivity,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!input.environmentId || !input.cwd) {
        throw new Error("Cannot load pull request activity without an environment and cwd.");
      }
      const api = readEnvironmentApi(input.environmentId);
      if (!api) {
        throw new Error(`Environment API not found for environment ${input.environmentId}.`);
      }
      return api.git.getPullRequestChecks({
        cwd: input.cwd,
        includeActivity: true,
      });
    },
  });

  return {
    pullRequest: currentPullRequest,
    checks: checksQuery.data?.checks ?? [],
    commits: activityQuery.data?.commits ?? [],
    comments: activityQuery.data?.comments ?? [],
    reviews: activityQuery.data?.reviews ?? [],
    reviewComments: activityQuery.data?.reviewComments ?? [],
    isChecksLoading: checksQuery.isLoading || (checksQuery.isFetching && !checksQuery.data),
    isActivityLoading:
      activityQuery.isFetching &&
      !activityQuery.data &&
      !hasPendingPullRequestChecks(currentPullRequest),
    isLoading:
      checksQuery.isLoading ||
      (checksQuery.isFetching && !checksQuery.data) ||
      (activityQuery.isFetching &&
        !activityQuery.data &&
        !hasPendingPullRequestChecks(currentPullRequest)),
    loadError:
      checksQuery.data?.error ??
      activityQuery.data?.activityError ??
      (checksQuery.error instanceof Error ? checksQuery.error.message : null) ??
      (activityQuery.error instanceof Error ? activityQuery.error.message : null),
  };
}
