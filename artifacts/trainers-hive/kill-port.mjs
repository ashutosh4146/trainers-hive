#!/usr/bin/env node
import { readFileSync, readdirSync, readlinkSync } from "fs";

const port = Number(process.env.PORT);
if (!port) process.exit(0);

const hexPort = port.toString(16).toUpperCase().padStart(4, "0");

function findInodesForPort(file) {
  const inodes = new Set();
  try {
    const lines = readFileSync(file, "utf8").trim().split("\n").slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const localAddr = parts[1];
      if (!localAddr) continue;
      const [, portHex] = localAddr.split(":");
      if (portHex?.toUpperCase() === hexPort) {
        inodes.add(parts[9]);
      }
    }
  } catch {}
  return inodes;
}

const inodes = new Set([
  ...findInodesForPort("/proc/net/tcp"),
  ...findInodesForPort("/proc/net/tcp6"),
]);

if (inodes.size === 0) process.exit(0);

try {
  for (const pid of readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        try {
          const link = readlinkSync(`/proc/${pid}/fd/${fd}`);
          const m = link.match(/socket:\[(\d+)\]/);
          if (m && inodes.has(m[1])) {
            process.kill(Number(pid), "SIGTERM");
          }
        } catch {}
      }
    } catch {}
  }
} catch {}

await new Promise((r) => setTimeout(r, 500));
