import { spawn } from "node:child_process";

const commands = [
  { label: "bundle", args: ["run", "dev:bundle"] },
  { label: "electron", args: ["run", "dev:electron"] },
];

const children = new Set();
let shuttingDown = false;

function spawnCommand(command) {
  const child = spawn("bun", command.args, {
    cwd: new URL("..", import.meta.url),
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  children.add(child);

  child.once("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) {
      return;
    }

    const exitCode = signal ? 1 : (code ?? 0);
    console.error(`[desktop-dev] ${command.label} exited unexpectedly.`);
    void shutdown(exitCode);
  });

  child.once("error", (error) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[desktop-dev] Failed to start ${command.label}: ${error.message}`);
      void shutdown(1);
    }
  });
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    child.kill("SIGTERM");
  }

  await new Promise((resolve) => setTimeout(resolve, 750));

  for (const child of children) {
    child.kill("SIGKILL");
  }

  process.exit(exitCode);
}

for (const command of commands) {
  spawnCommand(command);
}

process.once("SIGINT", () => {
  void shutdown(130);
});
process.once("SIGTERM", () => {
  void shutdown(143);
});
