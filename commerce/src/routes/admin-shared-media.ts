import type { D1DatabaseLike } from "../data/d1";
import type { R2BucketLike } from "../data/product-media";
import { readSharedMediaImageUpload } from "../http/image-upload";
import { uploadSharedMediaImage } from "../data/media-upload";
import { json, error, readProductJson } from "../http/admin-json";
import {
  listAdminSharedMedia,
  getAdminSharedMediaUsage,
  updateAdminSharedMediaAsset,
  archiveAdminSharedMediaAsset,
  restoreAdminSharedMediaAsset,
  claimSharedMediaObjectDeletion,
  recordSharedMediaDeleteFailure,
  finalizeSharedMediaObjectDeletion,
  sharedMediaDeleteEligibility,
} from "../data/shared-media";

export interface SharedMediaDependencies {
  listAdminSharedMediaFn: typeof listAdminSharedMedia;
  getAdminSharedMediaUsageFn: typeof getAdminSharedMediaUsage;
  updateAdminSharedMediaAssetFn: typeof updateAdminSharedMediaAsset;
  archiveAdminSharedMediaAssetFn: typeof archiveAdminSharedMediaAsset;
  restoreAdminSharedMediaAssetFn: typeof restoreAdminSharedMediaAsset;
  claimSharedMediaObjectDeletionFn: typeof claimSharedMediaObjectDeletion;
  recordSharedMediaDeleteFailureFn: typeof recordSharedMediaDeleteFailure;
  finalizeSharedMediaObjectDeletionFn: typeof finalizeSharedMediaObjectDeletion;
  sharedMediaDeleteEligibilityFn: typeof sharedMediaDeleteEligibility;
}

export const sharedMediaDefaults: SharedMediaDependencies = {
  listAdminSharedMediaFn: listAdminSharedMedia,
  getAdminSharedMediaUsageFn: getAdminSharedMediaUsage,
  updateAdminSharedMediaAssetFn: updateAdminSharedMediaAsset,
  archiveAdminSharedMediaAssetFn: archiveAdminSharedMediaAsset,
  restoreAdminSharedMediaAssetFn: restoreAdminSharedMediaAsset,
  claimSharedMediaObjectDeletionFn: claimSharedMediaObjectDeletion,
  recordSharedMediaDeleteFailureFn: recordSharedMediaDeleteFailure,
  finalizeSharedMediaObjectDeletionFn: finalizeSharedMediaObjectDeletion,
  sharedMediaDeleteEligibilityFn: sharedMediaDeleteEligibility,
};

export function sharedMediaMutationError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message : "shared_media_failed";
  const notFound = new Set(["shared_media_not_found"]);
  const conflicts = new Set([
    "shared_media_not_available",
    "shared_media_not_restorable",
    "shared_media_delete_blocked",
  ]);
  const messages: Record<string, string> = {
    shared_media_multipart_required: "Image upload must use multipart form data.",
    shared_media_file_required: "Choose an image to upload.",
    shared_media_file_empty: "The selected image is empty.",
    shared_media_file_too_large: "Image must be 8 MB or smaller.",
    shared_media_type_invalid: "Use a JPEG, PNG or WebP image.",
    shared_media_signature_invalid: "The file content does not match its image type.",
    shared_media_title_too_long: "Image title must be 160 characters or fewer.",
    shared_media_alt_text_too_long: "Alt text must be 240 characters or fewer.",
    shared_media_context_invalid: "Choose a valid image use.",
    shared_media_storage_invalid: "Image storage details are invalid.",
    shared_media_file_size_invalid: "Image size is invalid.",
    shared_media_not_found: "Image not found.",
    shared_media_not_available: "That image is archived. Restore it before reusing it.",
    shared_media_not_restorable: "That image cannot be restored.",
    shared_media_delete_blocked: "This image is still referenced and cannot be permanently removed.",
    shared_media_reference_invalid: "Image reference is invalid.",
    shared_media_surface_invalid: "Image destination is invalid.",
  };
  const status = notFound.has(code) ? 404 : conflicts.has(code) ? 409 : 400;
  return error(code, status, messages[code] ?? "Unable to update Media Library.");
}

// Internal sub-handler: the Admin composition root owns origin/authentication/DB guards.
// null means this route area did not handle the path/method; no independent router.
export async function handleAdminSharedMediaRequest(
  request: Request,
  env: { DB: D1DatabaseLike; PRODUCT_MEDIA?: R2BucketLike },
  identity: { email: string },
  deps: SharedMediaDependencies = sharedMediaDefaults,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/admin/api/media" && request.method === "GET") {
    try {
      const assets = await deps.listAdminSharedMediaFn(env.DB, {
        includeArchived: url.searchParams.get("includeArchived") === "1",
        context: url.searchParams.get("context") ?? undefined,
        search: url.searchParams.get("q") ?? "",
      });
      return json({ assets });
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  const usageMatch = url.pathname.match(/^\/admin\/api\/media\/([^/]+)\/usage$/);
  if (usageMatch && request.method === "GET") {
    try {
      return json(await deps.getAdminSharedMediaUsageFn(env.DB, decodeURIComponent(usageMatch[1])));
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  if (url.pathname === "/admin/api/media" && request.method === "POST") {
    if (!env.PRODUCT_MEDIA) {
      return error(
        "shared_media_storage_unavailable",
        503,
        "Media storage is not configured.",
      );
    }
    try {
      const upload = await readSharedMediaImageUpload(request);
      const asset = await uploadSharedMediaImage(env.DB, env.PRODUCT_MEDIA, upload, identity.email);
      return json({ asset }, 201);
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  const sharedMediaMatch = url.pathname.match(/^\/admin\/api\/media\/([^/]+)$/);
  if (sharedMediaMatch && request.method === "PATCH") {
    try {
      const raw = await readProductJson(request);
      const asset = await deps.updateAdminSharedMediaAssetFn(
        env.DB,
        decodeURIComponent(sharedMediaMatch[1]),
        raw,
        identity.email,
      );
      return json({ asset });
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  const sharedMediaArchiveMatch = url.pathname.match(
    /^\/admin\/api\/media\/([^/]+)\/archive$/,
  );
  if (sharedMediaArchiveMatch && request.method === "POST") {
    try {
      const asset = await deps.archiveAdminSharedMediaAssetFn(
        env.DB,
        decodeURIComponent(sharedMediaArchiveMatch[1]),
        identity.email,
      );
      return json({ asset });
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  const sharedMediaRestoreMatch = url.pathname.match(
    /^\/admin\/api\/media\/([^/]+)\/restore$/,
  );
  if (sharedMediaRestoreMatch && request.method === "POST") {
    try {
      const asset = await deps.restoreAdminSharedMediaAssetFn(
        env.DB,
        decodeURIComponent(sharedMediaRestoreMatch[1]),
        identity.email,
      );
      return json({ asset });
    } catch (cause) {
      return sharedMediaMutationError(cause);
    }
  }

  if (sharedMediaMatch && request.method === "DELETE") {
    if (!env.PRODUCT_MEDIA) {
      return error(
        "shared_media_storage_unavailable",
        503,
        "Media storage is not configured.",
      );
    }
    const assetId = decodeURIComponent(sharedMediaMatch[1]);
    try {
      const claim = await deps.claimSharedMediaObjectDeletionFn(
        env.DB,
        assetId,
        identity.email,
      );
      if (claim.alreadyDeleted) {
        return json({ ok: true, alreadyDeleted: true });
      }

      try {
        await env.PRODUCT_MEDIA.delete(claim.storageKey);
      } catch (storageCause) {
        if (claim.claimToken) {
          try {
            await deps.recordSharedMediaDeleteFailureFn(
              env.DB,
              assetId,
              claim.claimToken,
              storageCause,
            );
          } catch {
            // The claim itself remains durable; retrying DELETE is safe.
          }
        }
        return error(
          "shared_media_delete_retry",
          503,
          "Storage deletion did not complete. Nothing was marked deleted; retry permanent delete.",
        );
      }

      try {
        await deps.finalizeSharedMediaObjectDeletionFn(env.DB, claim, identity.email);
      } catch {
        return error(
          "shared_media_delete_finalize_pending",
          503,
          "The file was removed from storage, but metadata finalization is pending. Retry permanent delete to finish safely.",
        );
      }
      return json({ ok: true, retryable: false });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "shared_media_delete_blocked") {
        try {
          const eligibility = await deps.sharedMediaDeleteEligibilityFn(env.DB, assetId);
          return json(
            {
              error: {
                code: "shared_media_delete_blocked",
                message:
                  "Archive is safe, but permanent deletion is blocked while this image is referenced.",
                blockers: eligibility.blockers,
              },
            },
            409,
          );
        } catch {
          return sharedMediaMutationError(cause);
        }
      }
      if (cause instanceof Error && cause.message === "shared_media_delete_claim_failed") {
        return error(
          "shared_media_delete_retry",
          503,
          "Could not obtain a safe deletion claim. Retry permanent delete.",
        );
      }
      return sharedMediaMutationError(cause);
    }
  }

  return null;
}
