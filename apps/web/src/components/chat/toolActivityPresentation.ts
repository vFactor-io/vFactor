import type { WorkLogEntry } from "../../session-logic";

export type ToolActivityIconKind =
  | "terminal"
  | "read"
  | "search"
  | "edit"
  | "web"
  | "image"
  | "mcp"
  | "subagent"
  | "thought"
  | "todo"
  | "info"
  | "error";

export interface ToolActivityDetailBlock {
  label: string;
  value: string;
}

export interface ToolActivityPresentation {
  iconKind: ToolActivityIconKind;
  verb: string;
  target?: string | undefined;
  targetKind?: "path" | "code" | "text" | undefined;
  details: ToolActivityDetailBlock[];
  tone: "default" | "muted" | "error";
}

const COMPLETION_WORDING = /\s+(?:complete|completed)\s*$/i;

export function normalizeToolActivityLabel(value: string): string {
  return value.replace(COMPLETION_WORDING, "").trim();
}

function trim(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function baseName(path: string): string {
  const segments = path.split(/[\\/]/);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]?.trim();
    if (segment) return segment;
  }
  return path;
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return value;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function truncate(value: string, maxLength = 58): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getCommandReadTarget(command: string): string | null {
  const sedMatch = command.match(/(?:^|\s)sed\s+-n\s+['"]?\d+\s*,\s*\d+p['"]?\s+(.+)$/);
  if (sedMatch?.[1]) return stripOuterQuotes(sedMatch[1]);

  const catMatch = command.match(/(?:^|\s)cat\s+(.+)$/);
  if (catMatch?.[1]) return stripOuterQuotes(catMatch[1]);

  return null;
}

function getCommandSearchTarget(command: string): string | null {
  const rgMatch = command.match(/(?:^|\s)(?:rg|grep)\s+(?:-[^\s]+\s+)*(?:(['"])(.+?)\1|([^\s|]+))/);
  if (rgMatch) return rgMatch[2] ?? rgMatch[3] ?? "workspace";

  const findMatch = command.match(/(?:^|\s)find\s+(?:(['"])(.+?)\1|([^\s|]+))/);
  if (findMatch) return findMatch[2] ?? findMatch[3] ?? "workspace";

  const lsMatch = command.match(/(?:^|\s)ls(?:\s+(.+))?$/);
  if (lsMatch) return stripOuterQuotes(lsMatch[1] ?? "workspace");

  return null;
}

function inferDynamicToolKind(label: string): ToolActivityIconKind | null {
  const normalized = label.toLowerCase();
  if (normalized.includes("read")) return "read";
  if (
    normalized.includes("grep") ||
    normalized.includes("glob") ||
    normalized.includes("search") ||
    normalized.includes("list")
  ) {
    return "search";
  }
  if (normalized.includes("todo")) return "todo";
  if (normalized.includes("edit") || normalized.includes("write") || normalized.includes("patch")) {
    return "edit";
  }
  if (
    normalized.includes("bash") ||
    normalized.includes("command") ||
    normalized.includes("exec")
  ) {
    return "terminal";
  }
  if (normalized.includes("web") || normalized.includes("fetch")) return "web";
  return null;
}

function makeDetails(entry: WorkLogEntry): ToolActivityDetailBlock[] {
  const details: ToolActivityDetailBlock[] = [];
  if (trim(entry.command)) details.push({ label: "Command", value: entry.command!.trim() });
  if (trim(entry.rawCommand))
    details.push({ label: "Raw command", value: entry.rawCommand!.trim() });
  if (trim(entry.detail)) details.push({ label: "Details", value: entry.detail!.trim() });
  if ((entry.changedFiles?.length ?? 0) > 0) {
    details.push({ label: "Changed files", value: entry.changedFiles!.join("\n") });
  }
  return details;
}

export function getToolActivityPresentation(entry: WorkLogEntry): ToolActivityPresentation {
  const details = makeDetails(entry);
  const label = capitalize(normalizeToolActivityLabel(entry.toolTitle ?? entry.label));
  const detail = trim(entry.detail);
  const command = trim(entry.command);
  const changedFiles = entry.changedFiles ?? [];
  const tone = entry.tone === "error" ? "error" : entry.tone === "thinking" ? "muted" : "default";

  if (entry.requestKind === "file-change" || entry.itemType === "file_change") {
    return {
      iconKind: "edit",
      verb: "Edited",
      target: changedFiles.length === 1 ? changedFiles[0]! : `${changedFiles.length || 1} files`,
      targetKind: "path",
      details,
      tone,
    };
  }

  if (changedFiles.length > 0 && !command) {
    return {
      iconKind: "edit",
      verb: "Edited",
      target: changedFiles.length === 1 ? changedFiles[0]! : `${changedFiles.length} files`,
      targetKind: "path",
      details,
      tone,
    };
  }

  if (entry.requestKind === "command" || entry.itemType === "command_execution" || command) {
    if (command) {
      const readTarget = getCommandReadTarget(command);
      if (readTarget) {
        return {
          iconKind: "read",
          verb: "Read",
          target: baseName(readTarget),
          targetKind: "path",
          details,
          tone,
        };
      }

      const searchTarget = getCommandSearchTarget(command);
      if (searchTarget) {
        return {
          iconKind: "search",
          verb: "Searched",
          target: searchTarget === "workspace" ? searchTarget : baseName(searchTarget),
          targetKind: searchTarget === "workspace" ? "text" : "path",
          details,
          tone,
        };
      }
    }

    return {
      iconKind: "terminal",
      verb: "Ran",
      target: command ? truncate(command) : detail ? truncate(detail) : label,
      targetKind: "code",
      details,
      tone,
    };
  }

  if (entry.itemType === "web_search") {
    return {
      iconKind: "web",
      verb: "Searched",
      target: detail ?? label,
      targetKind: "text",
      details,
      tone,
    };
  }

  if (entry.itemType === "image_view") {
    return {
      iconKind: "image",
      verb: "Image",
      target: detail ? baseName(detail) : label,
      targetKind: "path",
      details,
      tone,
    };
  }

  if (entry.itemType === "mcp_tool_call") {
    return {
      iconKind: "mcp",
      verb: "Called",
      target: label,
      targetKind: "code",
      details,
      tone,
    };
  }

  if (entry.itemType === "collab_agent_tool_call") {
    return {
      iconKind: "subagent",
      verb: "Started",
      target: detail ? truncate(detail) : "subagent work",
      targetKind: "text",
      details,
      tone,
    };
  }

  if (entry.itemType === "dynamic_tool_call") {
    const kind = inferDynamicToolKind(label);
    if (kind === "read") {
      return {
        iconKind: "read",
        verb: "Read",
        target: detail ?? label,
        targetKind: "path",
        details,
        tone,
      };
    }
    if (kind === "search") {
      return {
        iconKind: "search",
        verb: "Searched",
        target: detail ?? label,
        targetKind: "text",
        details,
        tone,
      };
    }
    if (kind === "edit") {
      return {
        iconKind: "edit",
        verb: "Edited",
        target: detail ?? label,
        targetKind: "path",
        details,
        tone,
      };
    }
    if (kind === "terminal") {
      return {
        iconKind: "terminal",
        verb: "Ran",
        target: detail ?? label,
        targetKind: "code",
        details,
        tone,
      };
    }
    if (kind === "web") {
      return {
        iconKind: "web",
        verb: "Fetched",
        target: detail ?? label,
        targetKind: "text",
        details,
        tone,
      };
    }
    if (kind === "todo") {
      return {
        iconKind: "todo",
        verb: label.toLowerCase().includes("write") ? "Updated" : "Read",
        target: "todos",
        targetKind: "text",
        details,
        tone,
      };
    }

    return {
      iconKind: "info",
      verb: "Used",
      target: label,
      targetKind: "code",
      details,
      tone,
    };
  }

  if (entry.tone === "thinking") {
    return {
      iconKind: "thought",
      verb: label || "Thinking",
      target: detail ? truncate(detail) : undefined,
      targetKind: "text",
      details,
      tone,
    };
  }

  return {
    iconKind: entry.tone === "error" ? "error" : "info",
    verb: label,
    target: detail ? truncate(detail) : undefined,
    targetKind: "text",
    details,
    tone,
  };
}
