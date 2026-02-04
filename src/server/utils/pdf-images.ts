import { minioClient, getInternalMinioUrl } from "~/server/minio";
import { getBaseUrl } from "~/server/utils/base-url";
import sharp from "sharp";

function parseBucketAndObjectFromUrl(inputUrl: string): { bucketName: string; objectName: string } | null {
  const trimmed = inputUrl.trim();

  // Relative nginx proxy format: `/minio/<bucket>/<object>`
  if (trimmed.startsWith("/minio/")) {
    const parts = trimmed.split("/").filter(Boolean);
    // parts: ["minio", "bucket", "path", ...]
    if (parts.length < 3) return null;
    return {
      bucketName: parts[1]!,
      objectName: parts.slice(2).join("/"),
    };
  }

  // Absolute URL formats
  if (/^https?:\/\//i.test(trimmed)) {
    const urlObj = new URL(trimmed);
    const pathParts = urlObj.pathname.split("/").filter((p) => p);
    const effectiveParts = pathParts[0] === "minio" ? pathParts.slice(1) : pathParts;
    if (effectiveParts.length < 2) return null;
    return {
      bucketName: effectiveParts[0]!,
      objectName: effectiveParts.slice(1).join("/"),
    };
  }

  return null;
}

function toAbsoluteUrl(inputUrl: string): string {
  if (/^https?:\/\//i.test(inputUrl)) return inputUrl;

  // Common in this app: stored as relative nginx proxy paths like `/minio/<bucket>/<object>`
  if (inputUrl.startsWith("/")) {
    return `${getBaseUrl().replace(/\/$/, "")}${inputUrl}`;
  }

  return inputUrl;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function normalizeImageForPdfKit(buffer: Buffer, contentType: string | null): Promise<Buffer> {
  // pdfkit supports JPEG and PNG. Convert other formats (WebP, GIF, etc.) to PNG.
  const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

  if (isJPEG || isPNG) return buffer;

  const lowerType = (contentType || "").toLowerCase();
  const looksLikeImage = lowerType.startsWith("image/") || lowerType === "application/octet-stream" || lowerType === "";
  if (!looksLikeImage) return buffer;

  try {
    return await sharp(buffer, { animated: true }).png().toBuffer();
  } catch (error) {
    console.warn("[fetchImageAsBuffer] Image conversion failed; using original buffer:", error instanceof Error ? error.message : error);
    return buffer;
  }
}

/**
 * Fetch an image from a URL and return as Buffer with validation.
 * Supports both internal Docker URLs and external URLs.
 * Validates image format (JPEG, PNG, WebP, and other common formats).
 * Falls back to presigned URLs if direct access fails.
 * 
 * @param url - The URL of the image to fetch
 * @returns Buffer containing the image data, or null if fetch/validation fails
 */
export async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const rawUrl = url.trim();
    const absoluteUrl = toAbsoluteUrl(rawUrl);
    console.log(`[fetchImageAsBuffer] Starting fetch for: ${rawUrl}`);
    if (absoluteUrl !== rawUrl) {
      console.log(`[fetchImageAsBuffer] Normalized to absolute URL: ${absoluteUrl}`);
    }
    
    // Try internal URL first (for Docker environment)
    const internalUrl = getInternalMinioUrl(absoluteUrl);
    console.log(`[fetchImageAsBuffer] Internal URL: ${internalUrl}`);
    
    let response: Response | null = null;
    let buffer: Buffer | null = null;
    
    // Try internal URL first
    try {
      console.log(`[fetchImageAsBuffer] Attempting internal URL fetch...`);
      const internalResponse = await fetchWithTimeout(internalUrl, 10_000);
      
      if (internalResponse.ok) {
        const arrayBuffer = await internalResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        response = internalResponse;
        console.log(`[fetchImageAsBuffer] ✓ Successfully loaded from internal URL (${buffer.length} bytes)`);
      } else {
        console.warn(`[fetchImageAsBuffer] Internal URL failed: ${internalResponse.status} ${internalResponse.statusText}`);
      }
    } catch (internalError) {
      console.warn(`[fetchImageAsBuffer] Internal URL error:`, internalError instanceof Error ? internalError.message : internalError);
    }
    
    // If internal URL fails, try the original external URL
    if (!buffer) {
      if (!/^https?:\/\//i.test(absoluteUrl)) {
        console.warn(`[fetchImageAsBuffer] Skipping external fetch (not an absolute URL): ${absoluteUrl}`);
      } else {
        console.log(`[fetchImageAsBuffer] Attempting external URL fetch: ${absoluteUrl}`);
        try {
          const externalResponse = await fetchWithTimeout(absoluteUrl, 10_000);
        
          if (externalResponse.ok) {
            const arrayBuffer = await externalResponse.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            response = externalResponse;
            console.log(`[fetchImageAsBuffer] ✓ Successfully loaded from external URL (${buffer.length} bytes)`);
          } else {
            console.warn(`[fetchImageAsBuffer] External URL failed: ${externalResponse.status} ${externalResponse.statusText}`);
          }
        } catch (externalError) {
          console.warn(`[fetchImageAsBuffer] External URL error:`, externalError instanceof Error ? externalError.message : externalError);
        }
      }
    }
    
    // If both direct URLs fail, try generating a presigned GET URL
    if (!buffer) {
      console.log(`[fetchImageAsBuffer] Direct URLs failed, attempting presigned URL...`);
      try {
        const parsed = parseBucketAndObjectFromUrl(rawUrl) ?? parseBucketAndObjectFromUrl(absoluteUrl);

        if (parsed) {
          const { bucketName, objectName } = parsed;

          console.log(`[fetchImageAsBuffer] Generating presigned URL for bucket: ${bucketName}, object: ${objectName}`);
          
          // Generate presigned GET URL (expires in 5 minutes)
          const presignedUrl = await minioClient.presignedGetObject(bucketName, objectName, 5 * 60);
          console.log(`[fetchImageAsBuffer] Generated presigned URL: ${presignedUrl.substring(0, 100)}...`);
          
          // Try to fetch using presigned URL
          const presignedResponse = await fetchWithTimeout(presignedUrl, 10_000);
          
          if (presignedResponse.ok) {
            const arrayBuffer = await presignedResponse.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            response = presignedResponse;
            console.log(`[fetchImageAsBuffer] ✓ Successfully loaded from presigned URL (${buffer.length} bytes)`);
          } else {
            console.error(`[fetchImageAsBuffer] Presigned URL failed: ${presignedResponse.status} ${presignedResponse.statusText}`);
          }
        } else {
          console.error(`[fetchImageAsBuffer] Could not parse bucket and object name from URL: ${rawUrl}`);
        }
      } catch (presignedError) {
        console.error(`[fetchImageAsBuffer] Presigned URL error:`, presignedError instanceof Error ? presignedError.message : presignedError);
      }
    }
    
    // If all attempts failed, return null
    if (!buffer) {
      console.error(`[fetchImageAsBuffer] ✗ All fetch attempts failed for: ${rawUrl}`);
      return null;
    }

    // Convert to a pdfkit-compatible format if needed
    buffer = await normalizeImageForPdfKit(buffer, response?.headers.get("content-type") ?? null);
    
    // Validate buffer
    if (buffer.length === 0) {
      console.error(`[fetchImageAsBuffer] Invalid buffer: empty`);
      return null;
    }
    
    // Validate image format by checking magic bytes
    // JPEG: FF D8 FF
    // PNG: 89 50 4E 47
    // WebP: 52 49 46 46 (RIFF) followed by WEBP
    // GIF: 47 49 46 38
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebP = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && 
                   buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    
    if (!isJPEG && !isPNG && !isWebP && !isGIF) {
      // Log warning but don't reject - pdfkit might still be able to handle it
      console.warn(`[fetchImageAsBuffer] ⚠ Unrecognized image format. First bytes: ${buffer.slice(0, 12).toString('hex')}`);
      console.warn(`[fetchImageAsBuffer] Content-Type: ${response?.headers.get('content-type')}`);
      console.warn(`[fetchImageAsBuffer] Attempting to use anyway - pdfkit may still accept it`);
      
      // Only reject if it's clearly not an image (e.g., HTML error page)
      const bufferStart = buffer.toString('utf8', 0, Math.min(100, buffer.length)).toLowerCase();
      if (bufferStart.includes('<!doctype') || bufferStart.includes('<html')) {
        console.error(`[fetchImageAsBuffer] ✗ Buffer appears to be HTML, not an image`);
        return null;
      }
      
      // Return buffer anyway and let pdfkit decide if it can handle it
      return buffer;
    }
    
    const format = isJPEG ? 'JPEG' : isPNG ? 'PNG' : isWebP ? 'WebP' : 'GIF';
    console.log(`[fetchImageAsBuffer] ✓ Validated image format: ${format}`);
    
    return buffer;
  } catch (error) {
    console.error(`[fetchImageAsBuffer] ✗ Error fetching image from ${url.trim()}:`, error);
    if (error instanceof Error) {
      console.error(`[fetchImageAsBuffer] Error details:`, {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}
