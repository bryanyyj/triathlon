import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { getSyncedDates, saveGarminDay } from "./garminStore.js";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "garmin", "sync.py");
const ALWAYS_REFRESH_DAYS = 3; // recent days keep changing as the watch uploads

const state = { syncing: false, done: 0, total: 0, error: null, errorCode: null };

/** The Python inside the `uv tool install` environment created by `npm run garmin:setup`. */
function pythonPath() {
  if (process.env.GARMIN_PYTHON) return process.env.GARMIN_PYTHON;
  return process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "uv", "tools", "garmin-mcp", "Scripts", "python.exe")
    : path.join(os.homedir(), ".local", "share", "uv", "tools", "garmin-mcp", "bin", "python");
}

function tokenFile() {
  const dir = (process.env.GARMINTOKENS || "~/.garminconnect").replace(/^~/, os.homedir());
  return path.join(dir, "garmin_tokens.json");
}

export function getGarminState() {
  return {
    installed: fs.existsSync(pythonPath()),
    signedIn: fs.existsSync(tokenFile()),
    ...state,
  };
}

function localDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Newest first: recent days always, older ones only if never fetched. */
function datesToFetch(days) {
  const synced = getSyncedDates();
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = localDate(date);
    if (i < ALWAYS_REFRESH_DAYS || !synced.has(key)) dates.push(key);
  }
  return dates;
}

/** Starts a sync in the background; progress is read through getGarminState(). */
export function startGarminSync(days) {
  if (state.syncing) return;
  const current = getGarminState();
  if (!current.installed) {
    Object.assign(state, { error: "Garmin tools are not installed. Run: npm run garmin:setup", errorCode: "not_installed" });
    return;
  }

  const dates = datesToFetch(days);
  Object.assign(state, { syncing: true, done: 0, total: dates.length, error: null, errorCode: null });

  const child = spawn(pythonPath(), [SCRIPT, ...dates], { windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-2000);
  });

  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // library chatter, not one of our messages
    }
    if (message.error) {
      Object.assign(state, { error: message.message, errorCode: message.error });
    } else if (message.date) {
      // A partial fetch must not overwrite values saved by an earlier, complete one.
      saveGarminDay(message.date, message.data, { merge: message.failures.length > 0 });
      state.done += 1;
    }
  });

  child.on("error", (error) => {
    Object.assign(state, { syncing: false, error: `Could not start Garmin sync: ${error.message}` });
  });

  child.on("close", (code) => {
    state.syncing = false;
    if (code !== 0 && !state.error) {
      console.warn("Garmin sync failed:", stderr);
      state.error = `Garmin sync failed (exit ${code}). See the backend log.`;
    }
  });
}
