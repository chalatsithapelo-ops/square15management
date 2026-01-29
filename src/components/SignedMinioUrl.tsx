import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";

function isMinioBackedUrl(url: string): boolean {
  return url.startsWith("/minio/") || url.includes("/minio/");
}

type SignedMinioLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  url: string;
};

export function SignedMinioLink({ url, children, ...rest }: SignedMinioLinkProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const signedUrlQuery = useQuery(
    trpc.getPresignedDownloadUrl.queryOptions(
      {
        token: token!,
        url,
      },
      {
        enabled: isMinioBackedUrl(url) && !!token,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1,
      }
    )
  );

  const effectiveUrl = signedUrlQuery.data?.url ?? url;

  // IMPORTANT: If we navigate to /minio/* in the same tab, TanStack Router may
  // treat it as an internal route and render the app's Not Found page.
  // Default to opening in a new tab unless the caller explicitly overrides.
  const target = rest.target ?? "_blank";
  const rel = rest.rel ?? "noopener noreferrer";

  return (
    <a href={effectiveUrl} {...rest} target={target} rel={rel}>
      {children}
    </a>
  );
}

type SignedMinioImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  url: string;
};

export function SignedMinioImage({ url, ...rest }: SignedMinioImageProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const signedUrlQuery = useQuery(
    trpc.getPresignedDownloadUrl.queryOptions(
      {
        token: token!,
        url,
      },
      {
        enabled: isMinioBackedUrl(url) && !!token,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1,
      }
    )
  );

  const effectiveUrl = signedUrlQuery.data?.url ?? url;

  return <img src={effectiveUrl} {...rest} />;
}
