import { describe, expect, it } from "vitest";

import { normalizePullRequestMarkdown } from "./pullRequestChecks";

describe("normalizePullRequestMarkdown", () => {
  it("converts Vercel Agent request-review badge HTML into markdown", () => {
    const html = `<a href="https://vercel.com/vercel-agent/request-review?owner=Bluejay-io&repo=IHW-ERP&pr=190" rel="noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://agents-vade-review.vercel.sh/request-review-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://agents-vade-review.vercel.sh/request-review-light.svg"><img src="https://agents-vade-review.vercel.sh/request-review-light.svg" alt="Request Review"></picture></a>`;

    expect(normalizePullRequestMarkdown(html)).toBe(
      `[![Request Review](https://agents-vade-review.vercel.sh/request-review-light.svg)](https://vercel.com/vercel-agent/request-review?owner=Bluejay-io&repo=IHW-ERP&pr=190)`,
    );
  });

  it("does not convert unrelated raw HTML", () => {
    const html = `<a href="https://example.com"><img src="https://example.com/badge.svg" alt="Badge"></a>`;

    expect(normalizePullRequestMarkdown(html)).toBe(html);
  });
});
