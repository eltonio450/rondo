import { isAbsolute, win32 } from "node:path";

const CONTROL_OR_GIT_FORBIDDEN_RE = /[\x00-\x20\x7f~^:?*[\\]/;
const CONTROL_RE = /[\x00-\x1f\x7f]/;
const REPO_PART_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IDEMPOTENCY_KEY_RE = /^[a-f0-9]{64}$/;

export function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

export function assertValidAgentId(value, label = "agentId") {
  assertNonEmptyString(value, label);
  if (value !== value.trim() || CONTROL_RE.test(value)) {
    throw new Error(`${label} must be a trimmed string without control characters.`);
  }
  return value;
}

export function assertValidBranchName(value, label = "branchName") {
  assertNonEmptyString(value, label);
  if (
    value !== value.trim() ||
    value === "@" ||
    value.startsWith("-") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.endsWith(".") ||
    value.includes("..") ||
    value.includes("@{") ||
    value.includes("//") ||
    CONTROL_OR_GIT_FORBIDDEN_RE.test(value) ||
    value.split("/").some((part) => part.startsWith(".") || part.endsWith(".lock"))
  ) {
    throw new Error(`${label} is not a valid Git branch name: ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertValidBranchPrefix(value) {
  assertNonEmptyString(value, "branch-prefix");
  if (!value.endsWith("/")) {
    throw new Error(`branch-prefix must end with "/".`);
  }
  // Validate the prefix by appending a known-valid slug.
  assertValidBranchName(`${value}ticket`, "branch-prefix");
  return value;
}

export function assertValidRelativeDirectory(value, label = "tickets-dir") {
  assertNonEmptyString(value, label);
  if (
    value !== value.trim() ||
    CONTROL_RE.test(value) ||
    isAbsolute(value) ||
    win32.isAbsolute(value)
  ) {
    throw new Error(`${label} must be a directory relative to the repository root.`);
  }
  const parts = value.split(/[\\/]+/);
  if (parts.includes("..")) {
    throw new Error(`${label} must not escape the repository root.`);
  }
  return value;
}

export function assertValidModel(value, label = "model") {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value !== value.trim() ||
    value.length > 256 ||
    CONTROL_RE.test(value)
  ) {
    throw new Error(`${label} must be a valid model identifier.`);
  }
  return value;
}

export function assertValidRepoFullName(value, label = "repoFullName") {
  assertNonEmptyString(value, label);
  const parts = value.split("/");
  if (parts.length !== 2 || parts.some((part) => !REPO_PART_RE.test(part))) {
    throw new Error(`${label} must have the form "owner/repo".`);
  }
  return value;
}

export function assertValidIdempotencyKey(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !IDEMPOTENCY_KEY_RE.test(value)) {
    throw new Error("idempotencyKey must be a lowercase SHA-256 hex digest.");
  }
  return value;
}

export function assertPositiveInteger(value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function validateHttpEndpoint(value, { allowInsecure = false } = {}) {
  if (typeof allowInsecure !== "boolean") {
    throw new Error("http-allow-insecure must be a boolean.");
  }
  assertNonEmptyString(value, "http-url");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("http-url must be a valid absolute URL.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("http-url must not contain embedded credentials.");
  }
  if (parsed.protocol !== "https:" && !(allowInsecure && parsed.protocol === "http:")) {
    throw new Error(
      parsed.protocol === "http:"
        ? "http-url must use HTTPS unless http-allow-insecure is true."
        : "http-url must use the HTTPS protocol.",
    );
  }
  return parsed.toString();
}
