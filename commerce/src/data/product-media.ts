
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

const q = (...parts: string[]) => parts.join(" ");

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function expectedVersion(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("product_expected_version_invalid");
  }
  return number;
}

function textValue(
  value: unknown,
  name: string,
  max: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error("product_media_" + name + "_too_long");
  return result || null;
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

async function verifyProductToken(
  db: D1DatabaseLike,
  productId: string,
  version: number,
  token: string,
): Promise<void> {
  const row = await db
    .prepare(
      "SELECT id FROM products WHERE id = ? AND version = ? AND updated_at = ? LIMIT 1",
    )
    .bind(productId, version, token)
    .first<{ id: string }>();
  if (!row) throw new Error("product_version_conflict");
}

function auditStatement(
  db: D1DatabaseLike,
  input: {
    productId: string;
    eventType: string;
    actorEmail: string;
    before: unknown;
    after: unknown;
    reason: string;
    resultVersion: number;
    token: string;
  },
): D1PreparedStatementLike {
  return db
    .prepare(
      q(
        "INSERT INTO product_audit_events (",
        "id, product_id, variant_id, event_type, actor_type, actor_id,",
        "request_id, idempotency_key, before_json, after_json, reason, created_at",
        ") SELECT ?, ?, NULL, ?, 'ADMIN', ?, NULL, NULL, ?, ?, ?, ?",
        "FROM products WHERE id = ? AND version = ? AND updated_at = ?",
      ),
    )
    .bind(
      uid("pae"),
      input.productId,
      input.eventType,
      input.actorEmail,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      input.reason,
      input.token,
      input.productId,
      input.resultVersion,
      input.token,
    );
}

export interface R2ObjectBodyLike {
  body: BodyInit | ReadableStream<Uint8Array>;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  writeHttpMetadata?(headers: Headers): void;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(key: string): Promise<void>;
}

export interface AddProductMediaInput {
  expectedVersion: unknown;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  fileSize: number;
  checksumSha256: string;
  altText?: unknown;
}

export async function addAdminProductMedia(
  db: D1DatabaseLike,
  productId: string,
  raw: AddProductMediaInput,
  actorEmail: string,
): Promise<{ mediaId: string }> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      q(
        "SELECT id, version, current_draft_version_id AS draftVersionId",
        "FROM products WHERE id = ? LIMIT 1",
      ),
    )
    .bind(productId)
    .first<{ id: string; version: number; draftVersionId: string | null }>();

  if (!current) throw new Error("product_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");
  if (!current.draftVersionId) throw new Error("product_media_requires_draft");

  const altText = textValue(raw.altText, "alt_text", 240);
  const positionRow = await db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition, COUNT(*) AS count FROM product_version_media WHERE product_version_id = ?",
    )
    .bind(current.draftVersionId)
    .first<{ nextPosition: number; count: number }>();
  const position = Number(positionRow?.nextPosition ?? 0);
  const isPrimary = Number(positionRow?.count ?? 0) === 0;

  const token = now();
  const resultVersion = expected + 1;
  const mediaId = uid("med");

  await db.batch([
    db
      .prepare(
        "UPDATE products SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(token, productId, expected),
    db
      .prepare(
        q(
          "INSERT INTO product_media (",
          "id, product_id, variant_id, storage_provider, storage_key, public_url,",
          "mime_type, width, height, file_size, checksum_sha256, created_by,",
          "created_at, deleted_at",
          ") SELECT ?, ?, NULL, 'R2', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL",
          "FROM products WHERE id = ? AND version = ? AND updated_at = ?",
        ),
      )
      .bind(
        mediaId,
        productId,
        raw.storageKey,
        raw.publicUrl,
        raw.mimeType,
        raw.width ?? null,
        raw.height ?? null,
        raw.fileSize,
        raw.checksumSha256,
        actorEmail,
        token,
        productId,
        resultVersion,
        token,
      ),
    db
      .prepare(
        q(
          "INSERT INTO product_version_media (",
          "product_version_id, media_id, position, is_primary, alt_text, display_fit",
          ") SELECT ?, ?, ?, ?, ?, 'CONTAIN'",
          "FROM products WHERE id = ? AND version = ? AND updated_at = ?",
        ),
      )
      .bind(
        current.draftVersionId,
        mediaId,
        position,
        isPrimary ? 1 : 0,
        altText,
        productId,
        resultVersion,
        token,
      ),
    auditStatement(db, {
      productId,
      eventType: "PRODUCT_MEDIA_ADDED",
      actorEmail,
      before: null,
      after: {
        mediaId,
        position,
        isPrimary,
        altText,
        mimeType: raw.mimeType,
        fileSize: raw.fileSize,
      },
      reason: "Owner uploaded product image",
      resultVersion,
      token,
    }),
  ]);

  await verifyProductToken(db, productId, resultVersion, token);
  return { mediaId };
}

export interface UpdateProductMediaInput {
  expectedVersion: unknown;
  altText?: unknown;
  isPrimary?: unknown;
}

export async function updateAdminProductMedia(
  db: D1DatabaseLike,
  productId: string,
  mediaId: string,
  raw: UpdateProductMediaInput,
  actorEmail: string,
): Promise<void> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      q(
        "SELECT p.version, p.current_draft_version_id AS draftVersionId,",
        "pvm.alt_text AS altText, pvm.is_primary AS isPrimary",
        "FROM products p",
        "JOIN product_version_media pvm",
        "ON pvm.product_version_id = p.current_draft_version_id",
        "JOIN product_media pm ON pm.id = pvm.media_id AND pm.product_id = p.id",
        "WHERE p.id = ? AND pvm.media_id = ? AND pm.deleted_at IS NULL LIMIT 1",
      ),
    )
    .bind(productId, mediaId)
    .first<{
      version: number;
      draftVersionId: string;
      altText: string | null;
      isPrimary: number;
    }>();

  if (!current) throw new Error("product_media_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");

  const altText =
    raw.altText === undefined
      ? current.altText
      : textValue(raw.altText, "alt_text", 240);
  const isPrimary =
    raw.isPrimary === undefined
      ? Number(current.isPrimary) === 1
      : raw.isPrimary === true
        ? true
        : raw.isPrimary === false
          ? false
          : (() => {
              throw new Error("product_media_primary_invalid");
            })();

  if (!isPrimary && Number(current.isPrimary) === 1) {
    const count = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM product_version_media WHERE product_version_id = ?",
      )
      .bind(current.draftVersionId)
      .first<{ count: number }>();
    if (Number(count?.count ?? 0) > 0) {
      throw new Error("product_media_primary_required");
    }
  }

  const token = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE products SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(token, productId, expected),
  ];

  if (isPrimary) {
    statements.push(
      db
        .prepare(
          q(
            "UPDATE product_version_media SET is_primary = 0",
            "WHERE product_version_id = ? AND media_id <> ?",
            "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          current.draftVersionId,
          mediaId,
          productId,
          resultVersion,
          token,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        q(
          "UPDATE product_version_media SET alt_text = ?, is_primary = ?",
          "WHERE product_version_id = ? AND media_id = ?",
          "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
        ),
      )
      .bind(
        altText,
        isPrimary ? 1 : 0,
        current.draftVersionId,
        mediaId,
        productId,
        resultVersion,
        token,
      ),
  );

  statements.push(
    auditStatement(db, {
      productId,
      eventType: "PRODUCT_MEDIA_UPDATED",
      actorEmail,
      before: {
        mediaId,
        altText: current.altText,
        isPrimary: Number(current.isPrimary) === 1,
      },
      after: { mediaId, altText, isPrimary },
      reason: "Owner updated product image metadata",
      resultVersion,
      token,
    }),
  );

  await db.batch(statements);
  await verifyProductToken(db, productId, resultVersion, token);
}

export interface ReorderProductMediaInput {
  expectedVersion: unknown;
  mediaIds: unknown;
}

export async function reorderAdminProductMedia(
  db: D1DatabaseLike,
  productId: string,
  raw: ReorderProductMediaInput,
  actorEmail: string,
): Promise<void> {
  const expected = expectedVersion(raw.expectedVersion);
  if (!Array.isArray(raw.mediaIds)) throw new Error("product_media_order_invalid");
  const mediaIds = raw.mediaIds.map((value) => String(value));
  if (new Set(mediaIds).size !== mediaIds.length) {
    throw new Error("product_media_order_invalid");
  }

  const current = await db
    .prepare(
      "SELECT version, current_draft_version_id AS draftVersionId FROM products WHERE id = ? LIMIT 1",
    )
    .bind(productId)
    .first<{ version: number; draftVersionId: string | null }>();

  if (!current) throw new Error("product_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");
  if (!current.draftVersionId) throw new Error("product_media_requires_draft");

  const existing = await allRows<{ mediaId: string; position: number }>(
    db
      .prepare(
        "SELECT media_id AS mediaId, position FROM product_version_media WHERE product_version_id = ? ORDER BY position",
      )
      .bind(current.draftVersionId),
  );
  const existingIds = existing.map((row) => row.mediaId);
  if (
    existingIds.length !== mediaIds.length ||
    existingIds.some((id) => !mediaIds.includes(id))
  ) {
    throw new Error("product_media_order_mismatch");
  }

  const token = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE products SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(token, productId, expected),
  ];

  mediaIds.forEach((mediaId, index) => {
    statements.push(
      db
        .prepare(
          q(
            "UPDATE product_version_media SET position = ?",
            "WHERE product_version_id = ? AND media_id = ?",
            "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          index,
          current.draftVersionId,
          mediaId,
          productId,
          resultVersion,
          token,
        ),
    );
  });

  statements.push(
    auditStatement(db, {
      productId,
      eventType: "PRODUCT_MEDIA_REORDERED",
      actorEmail,
      before: { mediaIds: existingIds },
      after: { mediaIds },
      reason: "Owner reordered product gallery",
      resultVersion,
      token,
    }),
  );

  await db.batch(statements);
  await verifyProductToken(db, productId, resultVersion, token);
}

export interface RemoveProductMediaInput {
  expectedVersion: unknown;
}

export async function removeAdminProductMedia(
  db: D1DatabaseLike,
  productId: string,
  mediaId: string,
  raw: RemoveProductMediaInput,
  actorEmail: string,
): Promise<{
  storageProvider: string;
  storageKey: string;
  shouldDeleteObject: boolean;
}> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      q(
        "SELECT p.version, p.current_draft_version_id AS draftVersionId,",
        "pm.storage_provider AS storageProvider, pm.storage_key AS storageKey,",
        "pvm.position, pvm.is_primary AS isPrimary, pvm.alt_text AS altText",
        "FROM products p",
        "JOIN product_version_media pvm",
        "ON pvm.product_version_id = p.current_draft_version_id",
        "JOIN product_media pm ON pm.id = pvm.media_id AND pm.product_id = p.id",
        "WHERE p.id = ? AND pvm.media_id = ? AND pm.deleted_at IS NULL LIMIT 1",
      ),
    )
    .bind(productId, mediaId)
    .first<{
      version: number;
      draftVersionId: string;
      storageProvider: string;
      storageKey: string;
      position: number;
      isPrimary: number;
      altText: string | null;
    }>();

  if (!current) throw new Error("product_media_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");

  const replacement = Number(current.isPrimary) === 1
    ? await db
        .prepare(
          "SELECT media_id AS mediaId FROM product_version_media WHERE product_version_id = ? AND media_id <> ? ORDER BY position LIMIT 1",
        )
        .bind(current.draftVersionId, mediaId)
        .first<{ mediaId: string }>()
    : null;

  const token = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE products SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(token, productId, expected),
    db
      .prepare(
        q(
          "DELETE FROM product_version_media",
          "WHERE product_version_id = ? AND media_id = ?",
          "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
        ),
      )
      .bind(
        current.draftVersionId,
        mediaId,
        productId,
        resultVersion,
        token,
      ),
  ];

  if (replacement?.mediaId) {
    statements.push(
      db
        .prepare(
          q(
            "UPDATE product_version_media SET is_primary = 1",
            "WHERE product_version_id = ? AND media_id = ?",
            "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          current.draftVersionId,
          replacement.mediaId,
          productId,
          resultVersion,
          token,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        q(
          "UPDATE product_media SET deleted_at = ?",
          "WHERE id = ? AND NOT EXISTS (",
          "SELECT 1 FROM product_version_media WHERE media_id = ?",
          ") AND EXISTS (",
          "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?",
          ")",
        ),
      )
      .bind(
        token,
        mediaId,
        mediaId,
        productId,
        resultVersion,
        token,
      ),
  );

  statements.push(
    auditStatement(db, {
      productId,
      eventType: "PRODUCT_MEDIA_REMOVED",
      actorEmail,
      before: {
        mediaId,
        position: current.position,
        isPrimary: Number(current.isPrimary) === 1,
        altText: current.altText,
      },
      after: {
        removedFromDraft: true,
        replacementPrimaryMediaId: replacement?.mediaId ?? null,
      },
      reason: "Owner removed product image from draft gallery",
      resultVersion,
      token,
    }),
  );

  await db.batch(statements);
  await verifyProductToken(db, productId, resultVersion, token);

  const mediaRow = await db
    .prepare(
      "SELECT deleted_at AS deletedAt FROM product_media WHERE id = ? LIMIT 1",
    )
    .bind(mediaId)
    .first<{ deletedAt: string | null }>();

  let shouldDeleteObject = false;
  if (mediaRow?.deletedAt && current.storageProvider === "R2") {
    const remaining = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM product_media WHERE storage_provider = 'R2' AND storage_key = ? AND deleted_at IS NULL",
      )
      .bind(current.storageKey)
      .first<{ count: number }>();
    shouldDeleteObject = Number(remaining?.count ?? 0) === 0;
  }

  return {
    storageProvider: current.storageProvider,
    storageKey: current.storageKey,
    shouldDeleteObject,
  };
}

export async function getR2MediaStorage(
  db: D1DatabaseLike,
  mediaId: string,
): Promise<{
  storageKey: string;
  mimeType: string | null;
  checksumSha256: string | null;
} | null> {
  return db
    .prepare(
      q(
        "SELECT storage_key AS storageKey, mime_type AS mimeType,",
        "checksum_sha256 AS checksumSha256",
        "FROM product_media",
        "WHERE id = ? AND storage_provider = 'R2' AND deleted_at IS NULL LIMIT 1",
      ),
    )
    .bind(mediaId)
    .first<{
      storageKey: string;
      mimeType: string | null;
      checksumSha256: string | null;
    }>();
}
