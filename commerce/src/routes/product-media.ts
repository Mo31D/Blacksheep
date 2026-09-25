
import type { D1DatabaseLike } from "../data/d1";
import {
  getR2MediaStorage,
  type R2BucketLike,
} from "../data/product-media";

export interface ProductMediaPublicEnv {
  DB?: D1DatabaseLike;
  PRODUCT_MEDIA?: R2BucketLike;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function handleProductMediaRequest(
  request: Request,
  env: ProductMediaPublicEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  if (!env.DB || !env.PRODUCT_MEDIA) {
    return json(
      { error: { code: "media_unavailable", message: "Media storage is unavailable." } },
      503,
    );
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/media\/([^/]+)$/);
  if (!match) {
    return json(
      { error: { code: "media_not_found", message: "Media not found." } },
      404,
    );
  }

  const mediaId = decodeURIComponent(match[1]);
  const media = await getR2MediaStorage(env.DB, mediaId);
  if (!media) {
    return json(
      { error: { code: "media_not_found", message: "Media not found." } },
      404,
    );
  }

  const object = await env.PRODUCT_MEDIA.get(media.storageKey);
  if (!object) {
    return json(
      { error: { code: "media_object_missing", message: "Media object is missing." } },
      404,
    );
  }

  const headers = new Headers();
  if (object.writeHttpMetadata) {
    object.writeHttpMetadata(headers);
  }
  headers.set(
    "content-type",
    headers.get("content-type") || media.mimeType || "application/octet-stream",
  );
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (media.checksumSha256) {
    headers.set("etag", '"' + media.checksumSha256 + '"');
  }

  return new Response(request.method === "HEAD" ? null : object.body, {
    status: 200,
    headers,
  });
}
