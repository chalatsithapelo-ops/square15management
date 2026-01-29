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

  return (
    <a href={effectiveUrl} {...rest}>
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
