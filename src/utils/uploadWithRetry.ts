// Shared helper for uploading a file to a presigned MinIO URL with retry on
// transient network failures. Mobile clients on LTE frequently get a
// "Failed to fetch" mid-PUT — a simple retry almost always succeeds.
//
// Usage:
//   await uploadToPresignedUrl(presignedUrl, file);
// Throws Error on permanent failure (4xx, or exhausted retries).

export interface UploadWithRetryOptions {
  /** Max attempts including the first try. Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in ms between retries (linear backoff). Defaults to 1000. */
  baseDelayMs?: number;
  /** Optional callback fired when a retry is about to start. */
  onRetry?: (attempt: number, maxAttempts: number, err: unknown) => void;
}

export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  options: UploadWithRetryOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const err = new Error(
          `Upload failed for ${file.name}: HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`,
        );
        // 4xx is permanent (auth / signature / validation) — don't retry.
        if (response.status >= 400 && response.status < 500) {
          throw err;
        }
        throw err;
      }
      return; // success
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isPermanent4xx = /HTTP 4\d\d/.test(msg);
      const isTransient =
        !isPermanent4xx &&
        (msg.includes("Failed to fetch") ||
          msg.includes("NetworkError") ||
          msg.toLowerCase().includes("network") ||
          msg.includes("ECONN") ||
          msg.includes("timeout") ||
          msg.includes("HTTP 5"));

      if (attempt < maxAttempts && isTransient) {
        options.onRetry?.(attempt, maxAttempts, err);
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to upload ${file.name} after ${maxAttempts} attempts`);
}
