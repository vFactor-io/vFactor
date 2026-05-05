import { describe, expect, it } from "vitest";
import type { WorkLogEntry } from "../../session-logic";
import { getToolActivityPresentation } from "./toolActivityPresentation";

function entry(overrides: Partial<WorkLogEntry>): WorkLogEntry {
  return {
    id: "work-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    label: "Ran command",
    tone: "tool",
    ...overrides,
  };
}

describe("getToolActivityPresentation", () => {
  it("classifies shell commands as ran activity", () => {
    expect(
      getToolActivityPresentation(entry({ itemType: "command_execution", command: "bun lint" })),
    ).toMatchObject({
      iconKind: "terminal",
      verb: "Ran",
      target: "bun lint",
      targetKind: "code",
    });
  });

  it("classifies read commands as read activity", () => {
    expect(
      getToolActivityPresentation(
        entry({
          itemType: "command_execution",
          command: "sed -n '1,120p' apps/web/src/components/chat/MessagesTimeline.tsx",
        }),
      ),
    ).toMatchObject({
      iconKind: "read",
      verb: "Read",
      target: "MessagesTimeline.tsx",
      targetKind: "path",
    });
  });

  it("classifies search commands as searched activity", () => {
    expect(
      getToolActivityPresentation(
        entry({ itemType: "command_execution", command: "rg MessagesTimeline apps/web/src" }),
      ),
    ).toMatchObject({
      iconKind: "search",
      verb: "Searched",
      target: "MessagesTimeline",
    });
  });

  it("classifies changed files as edited activity", () => {
    expect(
      getToolActivityPresentation(
        entry({
          itemType: "file_change",
          changedFiles: ["apps/web/src/components/chat/MessagesTimeline.tsx"],
        }),
      ),
    ).toMatchObject({
      iconKind: "edit",
      verb: "Edited",
      target: "apps/web/src/components/chat/MessagesTimeline.tsx",
    });
  });

  it("uses compact labels for mcp, dynamic, subagent, web, and image tools", () => {
    expect(
      getToolActivityPresentation(
        entry({ itemType: "mcp_tool_call", toolTitle: "linear.createIssue" }),
      ),
    ).toMatchObject({ iconKind: "mcp", verb: "Called", target: "Linear.createIssue" });
    expect(
      getToolActivityPresentation(entry({ itemType: "dynamic_tool_call", toolTitle: "TodoWrite" })),
    ).toMatchObject({ iconKind: "todo", verb: "Updated", target: "todos" });
    expect(
      getToolActivityPresentation(
        entry({ itemType: "collab_agent_tool_call", detail: "Explore chat rendering" }),
      ),
    ).toMatchObject({ iconKind: "subagent", verb: "Started", target: "Explore chat rendering" });
    expect(
      getToolActivityPresentation(entry({ itemType: "web_search", detail: "Nucleus tool rows" })),
    ).toMatchObject({ iconKind: "web", verb: "Searched", target: "Nucleus tool rows" });
    expect(
      getToolActivityPresentation(entry({ itemType: "image_view", detail: "/tmp/screenshot.png" })),
    ).toMatchObject({ iconKind: "image", verb: "Image", target: "screenshot.png" });
  });

  it("renders thinking entries as expandable thought rows", () => {
    expect(
      getToolActivityPresentation(
        entry({ label: "thinking", detail: "Inspecting repository state", tone: "thinking" }),
      ),
    ).toMatchObject({
      iconKind: "thought",
      verb: "Thinking",
      target: "Inspecting repository state",
      tone: "muted",
      details: [{ label: "Details", value: "Inspecting repository state" }],
    });
  });
});
