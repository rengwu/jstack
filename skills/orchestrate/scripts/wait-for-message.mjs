#!/usr/bin/env node
// Wait until a mail file holds more than --after messages, then print the new ones.
// Usage: node wait-for-message.mjs --file PATH [--after N] [--timeout SECONDS]
// --after defaults to the current count. Exit 0 with the new messages, 2 on timeout.
import { readFileSync, watchFile, unwatchFile } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { file: { type: "string" }, after: { type: "string" }, timeout: { type: "string" } },
});
if (!values.file) {
  console.error("Usage: node wait-for-message.mjs --file PATH [--after N] [--timeout SECONDS]");
  process.exit(1);
}

function messages() {
  let text = "";
  try { text = readFileSync(values.file, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return text.split(/^(?=## )/m).filter((part) => part.startsWith("## "));
}

const after = values.after === undefined ? messages().length : Number(values.after);
if (!Number.isInteger(after) || after < 0) {
  console.error("--after must be a whole number.");
  process.exit(1);
}

function check() {
  const all = messages();
  if (all.length <= after) return;
  unwatchFile(values.file);
  process.stdout.write(`${all.length} messages\n\n${all.slice(after).join("")}`);
  process.exit(0);
}

watchFile(values.file, { interval: 1000 }, check);
check();
if (values.timeout) {
  setTimeout(() => {
    console.error(`No new message after ${values.timeout} s.`);
    process.exit(2);
  }, Number(values.timeout) * 1000);
}
