import { db } from "~/server/db";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";

// Separate caches for PM and Contractor logos
let cachedPMLogoBuffer: Buffer | null = null;
let pmLogoLastFetchTime = 0;
let cachedContractorLogoBuffer: Buffer | null = null;
let contractorLogoLastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function loadLogo(settingKey: string, cacheName: 'pm' | 'contractor'): Promise<Buffer | null> {
  const now = Date.now();
  
  // Check appropriate cache
  if (cacheName === 'pm') {
    if (cachedPMLogoBuffer && (now - pmLogoLastFetchTime) < CACHE_DURATION) {
      return cachedPMLogoBuffer;
    }
  } else {
    if (cachedContractorLogoBuffer && (now - contractorLogoLastFetchTime) < CACHE_DURATION) {
      return cachedContractorLogoBuffer;
    }
  }

  try {
    // Get logo URL from database
    const setting = await db.systemSettings.findUnique({
      where: { key: settingKey },
    });

    if (!setting?.value) {
      console.warn(`${settingKey} not found in system settings`);
      return null;
    }

    console.log(`Loading ${cacheName} logo from: ${setting.value}`);
    
    // Use centralized image fetching utility with validation
    const buffer = await fetchImageAsBuffer(setting.value);
    
    if (buffer) {
      // Update appropriate cache
      if (cacheName === 'pm') {
        cachedPMLogoBuffer = buffer;
        pmLogoLastFetchTime = now;
      } else {
        cachedContractorLogoBuffer = buffer;
        contractorLogoLastFetchTime = now;
      }
      console.log(`Successfully loaded and cached ${cacheName} logo (${buffer.length} bytes)`);
      return buffer;
    } else {
      console.error(`Failed to load ${cacheName} logo from: ${setting.value}`);
      return null;
    }
  } catch (error) {
    console.error(`Error loading ${cacheName} logo:`, error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
    }
    return null;
  }
}

export async function getCompanyLogo(): Promise<Buffer | null> {
  try {
    return await loadLogo('company_logo_url', 'pm');
  } catch (error) {
    console.error("Unexpected error in getCompanyLogo:", error);
    return null;
  }
}

// Clear logo caches (useful after uploads)
export function clearLogoCache(type?: 'pm' | 'contractor' | 'all') {
  if (!type || type === 'all' || type === 'pm') {
    cachedPMLogoBuffer = null;
    pmLogoLastFetchTime = 0;
    console.log('Cleared PM logo cache');
  }
  if (!type || type === 'all' || type === 'contractor') {
    cachedContractorLogoBuffer = null;
    contractorLogoLastFetchTime = 0;
    console.log('Cleared contractor logo cache');
  }
}

// Get Property Manager logo specifically (always from company_logo_url)
export async function getPropertyManagerLogo(): Promise<Buffer | null> {
  return getCompanyLogo(); // PM logo is stored in company_logo_url
}

// Get Contractor logo specifically
export async function getContractorLogo(): Promise<Buffer | null> {
  try {
    const buffer = await loadLogo('contractor_logo_url', 'contractor');
    if (buffer) {
      return buffer;
    }
    // Fallback to company logo if contractor logo not found
    console.warn("Contractor logo not found, falling back to PM logo");
    return await getCompanyLogo();
  } catch (error) {
    console.error("Error loading contractor logo:", error);
    return await getCompanyLogo(); // Fallback to company logo
  }
}
