import { useQuery } from "@tanstack/react-query";
import type { EnvironmentId } from "@t3tools/contracts";

import { readEnvironmentApi } from "../environmentApi";
import { useGitStatus } from "../lib/gitStatusState";

const PULL_REQUEST_CHECKS_POLL_INTERVAL_MS = 5_000;

export function usePullRequestChecks(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  enabled?: boolean;
}) {
  const enabled = input.enabled ?? true;
  const gitStatus = useGitStatus({ environmentId: input.environmentId, cwd: input.cwd });
  const openPullRequest = gitStatus.data?.pr?.state === "open" ? gitStatus.data.pr : null;
  const shouldPoll =
    openPullRequest?.checksStatus === "pending" ||
    (openPullRequest?.pendingChecksCount !== undefined && openPullRequest.pendingChecksCount > 0);

  const query = useQuery({
    queryKey: [
      "git",
      "pull-request-checks",
      input.environmentId,
      input.cwd,
      openPullRequest?.number,
    ],
    enabled:
      enabled && input.environmentId !== null && input.cwd !== null && openPullRequest !== null,
    refetchInterval: shouldPoll ? PULL_REQUEST_CHECKS_POLL_INTERVAL_MS : false,
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
        includeActivity: true,
      });
    },
  });

  return {
    pullRequest: query.data?.pullRequest ?? openPullRequest,
    checks: query.data?.checks ?? [],
    commits: query.data?.commits ?? [],
    comments: query.data?.comments ?? [],
    reviews: query.data?.reviews ?? [],
    reviewComments: query.data?.reviewComments ?? [],
    isLoading: query.isLoading || (query.isFetching && !query.data),
    loadError:
      query.data?.error ??
      query.data?.activityError ??
      (query.error instanceof Error ? query.error.message : null),
  };
}
