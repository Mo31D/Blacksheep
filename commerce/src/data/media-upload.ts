import type { D1DatabaseLike } from "./d1";
import type { R2BucketLike } from "./product-media";
import { createAdminSharedMediaAsset } from "./shared-media";
import { cleanupUnownedMediaUpload } from "./media-upload-cleanup";

interface ValidatedImageUpload {
  extension: string;
  bytes: Uint8Array;
  mimeType: string;
  checksumSha256: string;
  title?: string | null;
  altText?: string | null;
  context: string;
}

// All new image bytes belong to the library. Product/version associations
// are separate mutations; a failed attachment leaves a reusable library asset.
export async function uploadSharedMediaImage(
  db: D1DatabaseLike,
  bucket: R2BucketLike,
  upload: ValidatedImageUpload,
  actorEmail: string,
) {
  const assetId = "asset_" + crypto.randomUUID();
  const storageKey = "library/" + new Date().toISOString().slice(0, 7) +
    "/" + assetId + "." + upload.extension;
  try {
    await bucket.put(storageKey, upload.bytes, {
      httpMetadata: {
        contentType: upload.mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { assetId, checksumSha256: upload.checksumSha256, mediaLibrary: "shared" },
    });
    return await createAdminSharedMediaAsset(db, {
      assetId,
      storageKey,
      publicUrl: "/media/" + encodeURIComponent(assetId),
      mimeType: upload.mimeType,
      width: null,
      height: null,
      fileSize: upload.bytes.byteLength,
      checksumSha256: upload.checksumSha256,
      title: upload.title,
      altText: upload.altText,
      context: upload.context,
    }, actorEmail);
  } catch (cause) {
    await cleanupUnownedMediaUpload(db, bucket, storageKey);
    throw cause;
  }
}
