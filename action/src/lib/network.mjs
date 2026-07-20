const MAX_ERROR_BODY_CHARS = 4096;

export class RequestTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} timed out after ${timeoutMs}ms.`);
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  fetchImpl,
  url,
  options,
  { timeoutMs, label = "HTTP request" },
) {
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function.");
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("request timeout must be a positive integer number of milliseconds.");
  }

  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new RequestTimeoutError(label, timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve(
        fetchImpl(url, {
          ...options,
          signal: controller.signal,
        }),
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readErrorBody(response) {
  let text = "";
  try {
    text = await response.text();
  } catch {
    return "";
  }
  const truncated = text.length > MAX_ERROR_BODY_CHARS;
  const bounded = truncated ? text.slice(0, MAX_ERROR_BODY_CHARS) : text;
  // Keep untrusted provider text on one log line. In particular, a response
  // body must not be able to inject a GitHub Actions workflow command by
  // placing `::command::` after a newline.
  const safe = bounded
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "�");
  return truncated ? `${safe}…[truncated]` : safe;
}

export async function readJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} returned invalid JSON.`, { cause: error });
  }
}
