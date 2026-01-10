import { Client } from "minio";
import { env } from "./env";
import { getBaseUrl } from "./utils/base-url";

let _minioBaseUrl: string | null = null;
let _minioClient: Client | null = null;

function getMinioBaseUrl(): string {
  if (_minioBaseUrl === null) {
    _minioBaseUrl = getBaseUrl({ port: 9000 });
  }
  return _minioBaseUrl;
}

function getMinioClient(): Client {
  if (_minioClient === null) {
    // Use internal URL for connecting from the app container
    const baseUrl = getInternalMinioBaseUrl();
    const urlObj = new URL(baseUrl);
    _minioClient = new Client({
      endPoint: urlObj.hostname,
      port: parseInt(urlObj.port || '9000', 10),
      useSSL: baseUrl.startsWith("https://"),
      accessKey: "admin",
      secretKey: env.ADMIN_PASSWORD,
    });
  }
  return _minioClient;
}

export function getInternalMinioBaseUrl(): string {
  // Check multiple indicators that we're running in Docker
  const isDocker = 
    // Check if Prisma's DATABASE_URL uses Docker service name
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@postgres')) ||
    // Check for Docker-specific files
    (typeof process !== 'undefined' && (() => {
      try {
        const fs = require('fs');
        return fs.existsSync('/.dockerenv');
      } catch {
        return false;
      }
    })()) ||
    // Check if HOSTNAME suggests Docker
    (process.env.HOSTNAME && (
      process.env.HOSTNAME.includes('app') || 
      process.env.HOSTNAME.length === 12 // Docker container IDs are 12 chars
    )) ||
    // Check for Docker-specific environment variables
    process.env.DOCKER_CONTAINER === 'true';
  
  if (isDocker) {
    // Use internal Docker service name
    return 'http://minio:9000';
  }
  
  // For local development, use localhost
  return 'http://localhost:9000';
}

export function getInternalMinioUrl(externalUrl: string): string {
  const externalBaseUrl = getMinioBaseUrl();
  const internalBaseUrl = getInternalMinioBaseUrl();
  
  // Replace the external base URL with the internal one
  if (externalUrl.startsWith(externalBaseUrl)) {
    return externalUrl.replace(externalBaseUrl, internalBaseUrl);
  }
  
  // If it doesn't match the expected pattern, return as-is
  return externalUrl;
}

// Create a string-like object that lazily gets the base URL
const minioBaseUrlHandler = {
  get(_target: any, prop: string | symbol) {
    const url = getMinioBaseUrl();
    
    // Handle Symbol.toPrimitive for proper string coercion
    if (prop === Symbol.toPrimitive) {
      return (hint: string) => {
        if (hint === "string" || hint === "default") {
          return url;
        }
        return url;
      };
    }
    
    // Handle toString
    if (prop === "toString" || prop === "valueOf") {
      return () => url;
    }
    
    // Handle string methods and properties
    const value = (url as any)[prop];
    if (typeof value === "function") {
      return value.bind(url);
    }
    return value;
  },
};

export const minioBaseUrl = new Proxy({} as string, minioBaseUrlHandler);

// For minioClient, create a proxy that lazily gets the client
export const minioClient = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getMinioClient();
    const value = client[prop as keyof Client];
    // If it's a function, bind it to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
