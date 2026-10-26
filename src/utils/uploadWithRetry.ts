// Shared helper for uploading a file to a presigned MinIO URL.
//
// Uses XMLHttpRequest instead of fetch() because on mobile browsers
// (Android Chrome/WebView especially) fetch() with a large File body
// is significantly less reliable — it often surfaces "Failed to fetch"
// before the request even leaves the device (tab throttling, memory
// pressure, HTTP/2 stream reset). XHR streams from disk, reports
// upload progress, and survives backgrounding much better.
//
// Retries transient network failures with linear backoff.

export interface UploadWithRetryOptions {
  /** Max attempts including the first try. Defaults to 8. */
  maxAttempts?: number;
  /** Base delay in ms between retries (linear backoff, capped at 6 s). Defaults to 800. */
  baseDelayMs?: number;
  /** Per-attempt timeout in ms. Defaults to 10 minutes to accommodate large files on slow mobile networks. */
  timeoutMs?: number;
  /** Optional callback fired when a retry is about to start. */
  onRetry?: (attempt: number, maxAttempts: number, err: unknown) => void;
  /** Optional progress callback (0-100). */
  onProgress?: (percent: number) => void;
}

class PermanentUploadError extends Error {}

function putViaXhr(
  presignedUrl: string,
  file: File,
  timeoutMs: number,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl, true);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const bodyPreview = (xhr.responseText || "").slice(0, 200);
      const err = new Error(
        `Upload failed for ${file.name}: HTTP ${xhr.status} ${xhr.statusText}${bodyPreview ? ` \u2014 ${bodyPreview}` : ""}`,
      );
      // 4xx = permanent (auth / signature / validation) — don't retry.
      if (xhr.status >= 400 && xhr.status < 500) {
        reject(new PermanentUploadError(err.message));
        return;
      }
      reject(err);
    };

    xhr.onerror = () => {
      reject(new Error(`Network error uploading ${file.name}`));
    };
    xhr.ontimeout = () => {
      reject(new Error(`Upload timed out for ${file.name} after ${Math.round(timeoutMs / 1000)}s`));
    };
    xhr.onabort = () => {
      reject(new Error(`Upload aborted for ${file.name}`));
    };

    try {
      xhr.send(file);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  options: UploadWithRetryOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 8;
  const baseDelayMs = options.baseDelayMs ?? 800;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000; // 10 minutes

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await putViaXhr(presignedUrl, file, timeoutMs, options.onProgress);
      return; // success
    } catch (err) {
      lastError = err;
      if (err instanceof PermanentUploadError) {
        throw err;
      }
      if (attempt < maxAttempts) {
        options.onRetry?.(attempt, maxAttempts, err);
        // Linear backoff capped at 6 s so the last attempts don't sit idle
        // for 12+ s on flaky SA mobile connections.
        const delay = Math.min(6000, baseDelayMs * attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to upload ${file.name} after ${maxAttempts} attempts`);
}
