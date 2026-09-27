import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

export type SharedMediaContext =
  | "GENERAL"
  | "PRODUCT"
  | "HOMEPAGE"
  | "SECTION"
  | "THEME";

export type SharedMediaSurface =
  | "PRODUCT"
  | "HOMEPAGE"
  | "SECTION"
  | "THEME";

export interface SharedMediaAsset {
  id: string;
  storageProvider: "R2";
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  checksumSha256: string;
  title: string | null;
  altText: string | null;
  context: SharedMediaContext;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

const CONTEXTS = new Set<SharedMediaContext>([
  "GENERAL",
  "PRODUCT",
  "HOMEPAGE",
  "SECTION",
  "THEME",
]);

function now(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function cleanText(
  value: unknown,
  max: number,
  errorCode: string,
): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error(errorCode);
  return result || null;
}

function contextValue(value: unknown): SharedMediaContext {
  const context = String(value ?? "GENERAL").trim().toUpperCase() as SharedMediaContext;
  if (!CONTEXTS.has(context)) throw new Error("shared_media_context_invalid");
  return context;
}

function rowToAsset(row: Record<string, unknown>): SharedMediaAsset {
  return {
    id: String(row.id),
    storageProvider: "R2",
    storageKey: String(row.storageKey),
    publicUrl: String(row.publicUrl),
    mimeType: String(row.mimeType),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    fileSize: Number(row.fileSize ?? 0),
    checksumSha256: String(row.checksumSha256),
    title: row.title == null ? null : String(row.title),
    altText: row.altText == null ? null : String(row.altText),
    context: String(row.context) as SharedMediaContext,
    status: String(row.status) as SharedMediaAsset["status"],
    usageCount: Number(row.usageCount ?? 0),
    createdBy: String(row.createdBy),
    createdAt: String(row.createdAt),
    updatedBy: String(row.updatedBy),
    updatedAt: String(row.updatedAt),
    archivedAt: row.archivedAt == null ? null : String(row.archivedAt),
    deletedAt: row.deletedAt == null ? null : String(row.deletedAt),
  };
}

function selectSql(): string {
  return [
    "SELECT a.id, a.storage_provider AS storageProvider,",
    "a.storage_key AS storageKey, a.public_url AS publicUrl,",
    "a.mime_type AS mimeType, a.width, a.height,",
    "a.file_size AS fileSize, a.checksum_sha256 AS checksumSha256,",
    "a.title, a.alt_text AS altText, a.context, a.status,",
    "a.created_by AS createdBy, a.created_at AS createdAt,",
    "a.updated_by AS updatedBy, a.updated_at AS updatedAt,",
    "a.archived_at AS archivedAt, a.deleted_at AS deletedAt,",
    "((SELECT COUNT(*) FROM shared_media_references r",
    "  WHERE r.asset_id = a.id AND r.released_at IS NULL) +",
    " (SELECT COUNT(*) FROM product_media pm WHERE pm.storage_provider = 'R2' AND pm.storage_key = a.storage_key) +",
    " (SELECT COUNT(*) FROM storefront_node_versions snv WHERE snv.image_url = a.public_url) +",
    " (SELECT COUNT(*) FROM website_appearance_versions wav",
    "  WHERE wav.hero_image_url = a.public_url OR instr(COALESCE(wav.section_images_json, ''), a.public_url) > 0)",
    ") AS usageCount",
    "FROM shared_media_assets a",
  ].join(" ");
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

function auditStatement(
  db: D1DatabaseLike,
  input: {
    assetId: string;
    eventType:
      | "UPLOADED"
      | "METADATA_UPDATED"
      | "ARCHIVED"
      | "RESTORED"
      | "REFERENCE_ADDED"
      | "REFERENCE_RELEASED"
      | "OBJECT_DELETED";
    actorEmail: string;
    before?: unknown;
    after?: unknown;
    createdAt?: string;
  },
): D1PreparedStatementLike {
  return db
    .prepare(
      "INSERT INTO shared_media_audit_events (" +
        "id, asset_id, event_type, actor_id, before_json, after_json, created_at" +
        ") VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      uid("smae"),
      input.assetId,
      input.eventType,
      input.actorEmail,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      input.createdAt ?? now(),
    );
}

export async function listAdminSharedMedia(
  db: D1DatabaseLike,
  options: {
    includeArchived?: boolean;
    context?: unknown;
    search?: unknown;
  } = {},
): Promise<SharedMediaAsset[]> {
  const where: string[] = ["a.status <> 'DELETED'"];
  const bindings: unknown[] = [];

  if (!options.includeArchived) where.push("a.status = 'ACTIVE'");
  if (options.context != null && String(options.context).trim()) {
    where.push("a.context = ?");
    bindings.push(contextValue(options.context));
  }
  const search = String(options.search ?? "").trim();
  if (search) {
    where.push("(a.title LIKE ? OR a.alt_text LIKE ? OR a.id LIKE ?)");
    const pattern = "%" + search.slice(0, 120) + "%";
    bindings.push(pattern, pattern, pattern);
  }

  const statement = db.prepare(
    selectSql() +
      " WHERE " +
      where.join(" AND ") +
      " ORDER BY a.updated_at DESC, a.id DESC LIMIT 250",
  );
  const rows = await allRows<Record<string, unknown>>(
    bindings.length ? statement.bind(...bindings) : statement,
  );
  return rows.map(rowToAsset);
}

export async function getAdminSharedMediaAsset(
  db: D1DatabaseLike,
  assetId: string,
): Promise<SharedMediaAsset | null> {
  const row = await db
    .prepare(selectSql() + " WHERE a.id = ? AND a.status <> 'DELETED' LIMIT 1")
    .bind(assetId)
    .first<Record<string, unknown>>();
  return row ? rowToAsset(row) : null;
}

export async function getSharedMediaStorage(
  db: D1DatabaseLike,
  assetId: string,
): Promise<{
  storageKey: string;
  mimeType: string | null;
  checksumSha256: string | null;
} | null> {
  return db
    .prepare(
      "SELECT storage_key AS storageKey, mime_type AS mimeType, " +
        "checksum_sha256 AS checksumSha256 FROM shared_media_assets " +
        "WHERE id = ? AND storage_provider = 'R2' AND status <> 'DELETED' LIMIT 1",
    )
    .bind(assetId)
    .first<{
      storageKey: string;
      mimeType: string | null;
      checksumSha256: string | null;
    }>();
}

export interface CreateSharedMediaAssetInput {
  assetId?: string;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  fileSize: number;
  checksumSha256: string;
  title?: unknown;
  altText?: unknown;
  context?: unknown;
}

export async function createAdminSharedMediaAsset(
  db: D1DatabaseLike,
  raw: CreateSharedMediaAssetInput,
  actorEmail: string,
): Promise<SharedMediaAsset> {
  const assetId = raw.assetId?.trim() || uid("asset");
  const title = cleanText(raw.title, 160, "shared_media_title_too_long");
  const altText = cleanText(raw.altText, 240, "shared_media_alt_text_too_long");
  const context = contextValue(raw.context);
  if (!raw.storageKey.trim() || !raw.publicUrl.trim()) {
    throw new Error("shared_media_storage_invalid");
  }
  if (!Number.isInteger(raw.fileSize) || raw.fileSize < 0) {
    throw new Error("shared_media_file_size_invalid");
  }
  const timestamp = now();

  await db.batch([
    db
      .prepare(
        "INSERT INTO shared_media_assets (" +
          "id, storage_provider, storage_key, public_url, mime_type, width, height, " +
          "file_size, checksum_sha256, title, alt_text, context, status, " +
          "created_by, created_at, updated_by, updated_at, archived_at, deleted_at" +
          ") VALUES (?, 'R2', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, NULL, NULL)",
      )
      .bind(
        assetId,
        raw.storageKey,
        raw.publicUrl,
        raw.mimeType,
        raw.width ?? null,
        raw.height ?? null,
        raw.fileSize,
        raw.checksumSha256,
        title,
        altText,
        context,
        actorEmail,
        timestamp,
        actorEmail,
        timestamp,
      ),
    auditStatement(db, {
      assetId,
      eventType: "UPLOADED",
      actorEmail,
      after: {
        title,
        altText,
        context,
        mimeType: raw.mimeType,
        fileSize: raw.fileSize,
      },
      createdAt: timestamp,
    }),
  ]);

  const asset = await getAdminSharedMediaAsset(db, assetId);
  if (!asset) throw new Error("shared_media_create_failed");
  return asset;
}

export async function updateAdminSharedMediaAsset(
  db: D1DatabaseLike,
  assetId: string,
  raw: { title?: unknown; altText?: unknown; context?: unknown },
  actorEmail: string,
): Promise<SharedMediaAsset> {
  const current = await getAdminSharedMediaAsset(db, assetId);
  if (!current) throw new Error("shared_media_not_found");
  const title =
    raw.title === undefined
      ? current.title
      : cleanText(raw.title, 160, "shared_media_title_too_long");
  const altText =
    raw.altText === undefined
      ? current.altText
      : cleanText(raw.altText, 240, "shared_media_alt_text_too_long");
  const context =
    raw.context === undefined ? current.context : contextValue(raw.context);
  const timestamp = now();

  await db.batch([
    db
      .prepare(
        "UPDATE shared_media_assets SET title = ?, alt_text = ?, context = ?, " +
          "updated_by = ?, updated_at = ? WHERE id = ? AND status <> 'DELETED'",
      )
      .bind(title, altText, context, actorEmail, timestamp, assetId),
    auditStatement(db, {
      assetId,
      eventType: "METADATA_UPDATED",
      actorEmail,
      before: {
        title: current.title,
        altText: current.altText,
        context: current.context,
      },
      after: { title, altText, context },
      createdAt: timestamp,
    }),
  ]);

  const asset = await getAdminSharedMediaAsset(db, assetId);
  if (!asset) throw new Error("shared_media_not_found");
  return asset;
}

export async function archiveAdminSharedMediaAsset(
  db: D1DatabaseLike,
  assetId: string,
  actorEmail: string,
): Promise<SharedMediaAsset> {
  const current = await getAdminSharedMediaAsset(db, assetId);
  if (!current) throw new Error("shared_media_not_found");
  if (current.status === "ARCHIVED") return current;
  const timestamp = now();
  await db.batch([
    db
      .prepare(
        "UPDATE shared_media_assets SET status = 'ARCHIVED', archived_at = ?, " +
          "updated_by = ?, updated_at = ? WHERE id = ? AND status = 'ACTIVE'",
      )
      .bind(timestamp, actorEmail, timestamp, assetId),
    auditStatement(db, {
      assetId,
      eventType: "ARCHIVED",
      actorEmail,
      before: { status: current.status },
      after: { status: "ARCHIVED", publicDeliveryPreserved: true },
      createdAt: timestamp,
    }),
  ]);
  const asset = await getAdminSharedMediaAsset(db, assetId);
  if (!asset) throw new Error("shared_media_not_found");
  return asset;
}

export async function restoreAdminSharedMediaAsset(
  db: D1DatabaseLike,
  assetId: string,
  actorEmail: string,
): Promise<SharedMediaAsset> {
  const current = await getAdminSharedMediaAsset(db, assetId);
  if (!current) throw new Error("shared_media_not_found");
  if (current.status === "ACTIVE") return current;
  if (current.status !== "ARCHIVED") throw new Error("shared_media_not_restorable");
  const timestamp = now();
  await db.batch([
    db
      .prepare(
        "UPDATE shared_media_assets SET status = 'ACTIVE', archived_at = NULL, " +
          "updated_by = ?, updated_at = ? WHERE id = ? AND status = 'ARCHIVED'",
      )
      .bind(actorEmail, timestamp, assetId),
    auditStatement(db, {
      assetId,
      eventType: "RESTORED",
      actorEmail,
      before: { status: current.status },
      after: { status: "ACTIVE" },
      createdAt: timestamp,
    }),
  ]);
  const asset = await getAdminSharedMediaAsset(db, assetId);
  if (!asset) throw new Error("shared_media_not_found");
  return asset;
}

export async function addSharedMediaReference(
  db: D1DatabaseLike,
  input: {
    assetId: string;
    surface: SharedMediaSurface;
    ownerId: string;
    ownerVersionId?: string | null;
    slotKey: string;
  },
  actorEmail: string,
): Promise<string> {
  const asset = await getAdminSharedMediaAsset(db, input.assetId);
  if (!asset || asset.status !== "ACTIVE") {
    throw new Error("shared_media_not_available");
  }
  const surface = String(input.surface).toUpperCase() as SharedMediaSurface;
  if (!["PRODUCT", "HOMEPAGE", "SECTION", "THEME"].includes(surface)) {
    throw new Error("shared_media_surface_invalid");
  }
  const ownerId = String(input.ownerId || "").trim();
  const slotKey = String(input.slotKey || "").trim();
  if (!ownerId || !slotKey) throw new Error("shared_media_reference_invalid");
  const referenceId = uid("smr");
  const timestamp = now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO shared_media_references (" +
          "id, asset_id, surface, owner_id, owner_version_id, slot_key, " +
          "created_by, created_at, released_at" +
          ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
      )
      .bind(
        referenceId,
        input.assetId,
        surface,
        ownerId,
        input.ownerVersionId ?? null,
        slotKey,
        actorEmail,
        timestamp,
      ),
    auditStatement(db, {
      assetId: input.assetId,
      eventType: "REFERENCE_ADDED",
      actorEmail,
      after: {
        referenceId,
        surface,
        ownerId,
        ownerVersionId: input.ownerVersionId ?? null,
        slotKey,
      },
      createdAt: timestamp,
    }),
  ]);
  return referenceId;
}

export async function releaseSharedMediaReferences(
  db: D1DatabaseLike,
  input: {
    surface: SharedMediaSurface;
    ownerId: string;
    ownerVersionId?: string | null;
    slotKey?: string | null;
  },
  actorEmail: string,
): Promise<void> {
  const rows = await allRows<{ id: string; assetId: string }>(
    db
      .prepare(
        "SELECT id, asset_id AS assetId FROM shared_media_references " +
          "WHERE surface = ? AND owner_id = ? " +
          "AND (? IS NULL OR owner_version_id = ?) " +
          "AND (? IS NULL OR slot_key = ?) AND released_at IS NULL",
      )
      .bind(
        input.surface,
        input.ownerId,
        input.ownerVersionId ?? null,
        input.ownerVersionId ?? null,
        input.slotKey ?? null,
        input.slotKey ?? null,
      ),
  );
  if (!rows.length) return;
  const timestamp = now();
  const statements: D1PreparedStatementLike[] = [];
  for (const row of rows) {
    statements.push(
      db
        .prepare(
          "UPDATE shared_media_references SET released_at = ? WHERE id = ? AND released_at IS NULL",
        )
        .bind(timestamp, row.id),
      auditStatement(db, {
        assetId: row.assetId,
        eventType: "REFERENCE_RELEASED",
        actorEmail,
        after: { referenceId: row.id },
        createdAt: timestamp,
      }),
    );
  }
  await db.batch(statements);
}

export async function sharedMediaStorageOwnedByLibrary(
  db: D1DatabaseLike,
  storageKey: string,
): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        "SELECT id FROM shared_media_assets WHERE storage_key = ? AND status <> 'DELETED' LIMIT 1",
      )
      .bind(storageKey)
      .first<{ id: string }>();
    return Boolean(row?.id);
  } catch {
    // A quota/connection/schema failure is not proof of exclusive ownership.
    // Retain the object; cleanup can be retried after the database recovers.
    return true;
  }
}

export async function sharedMediaDeleteEligibility(
  db: D1DatabaseLike,
  assetId: string,
): Promise<{
  asset: SharedMediaAsset;
  canDeleteObject: boolean;
  blockers: string[];
}> {
  const asset = await getAdminSharedMediaAsset(db, assetId);
  if (!asset) throw new Error("shared_media_not_found");
  const blockers: string[] = [];
  if (asset.status !== "ARCHIVED") blockers.push("asset_not_archived");

  const product = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM product_media WHERE storage_provider = 'R2' AND storage_key = ?",
    )
    .bind(asset.storageKey)
    .first<{ count: number }>();
  if (Number(product?.count ?? 0) > 0) blockers.push("product_history");

  const storefront = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM storefront_node_versions WHERE image_url = ?",
    )
    .bind(asset.publicUrl)
    .first<{ count: number }>();
  if (Number(storefront?.count ?? 0) > 0) blockers.push("section_history");

  const appearance = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM website_appearance_versions " +
        "WHERE hero_image_url = ? OR instr(COALESCE(section_images_json, ''), ?) > 0",
    )
    .bind(asset.publicUrl, asset.publicUrl)
    .first<{ count: number }>();
  if (Number(appearance?.count ?? 0) > 0) blockers.push("appearance_history");

  const references = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM shared_media_references " +
        "WHERE asset_id = ? AND released_at IS NULL",
    )
    .bind(assetId)
    .first<{ count: number }>();
  if (Number(references?.count ?? 0) > 0) blockers.push("active_references");

  return { asset, canDeleteObject: blockers.length === 0, blockers };
}

export async function markSharedMediaObjectDeleted(
  db: D1DatabaseLike,
  assetId: string,
  actorEmail: string,
): Promise<void> {
  const eligibility = await sharedMediaDeleteEligibility(db, assetId);
  if (!eligibility.canDeleteObject) {
    throw new Error("shared_media_delete_blocked");
  }
  const timestamp = now();
  await db.batch([
    db
      .prepare(
        "UPDATE shared_media_assets SET status = 'DELETED', deleted_at = ?, " +
          "updated_by = ?, updated_at = ? WHERE id = ? AND status = 'ARCHIVED'",
      )
      .bind(timestamp, actorEmail, timestamp, assetId),
    auditStatement(db, {
      assetId,
      eventType: "OBJECT_DELETED",
      actorEmail,
      before: { status: eligibility.asset.status },
      after: { status: "DELETED", storageKey: eligibility.asset.storageKey },
      createdAt: timestamp,
    }),
  ]);
}


export interface SharedMediaDeleteClaim {
  assetId: string;
  storageKey: string;
  claimToken: string | null;
  alreadyDeleted: boolean;
}

/**
 * Claim an archived, unreferenced object for destructive R2 deletion.
 *
 * The INSERT ... SELECT eligibility predicate and the claim write are one D1
 * statement, so a destructive caller never relies only on an earlier
 * read/check. Repeating a FAILED/CLAIMED job creates a new claim token; DONE
 * is idempotent success.
 */
export async function claimSharedMediaObjectDeletion(
  db: D1DatabaseLike,
  assetId: string,
  actorEmail: string,
): Promise<SharedMediaDeleteClaim> {
  const existing = await db
    .prepare(
      "SELECT storage_key AS storageKey, state, claim_token AS claimToken " +
        "FROM shared_media_delete_jobs WHERE asset_id = ? LIMIT 1",
    )
    .bind(assetId)
    .first<{ storageKey: string; state: string; claimToken: string }>();

  if (existing?.state === "DONE") {
    return {
      assetId,
      storageKey: existing.storageKey,
      claimToken: null,
      alreadyDeleted: true,
    };
  }

  const claimToken = uid("smdelete");
  const timestamp = now();

  await db
    .prepare(
      "INSERT INTO shared_media_delete_jobs (" +
        "asset_id, storage_key, state, attempt_count, claim_token, last_error, " +
        "claimed_by, claimed_at, updated_at" +
        ") " +
        "SELECT a.id, a.storage_key, 'CLAIMED', 1, ?, NULL, ?, ?, ? " +
        "FROM shared_media_assets a " +
        "WHERE a.id = ? AND a.status = 'ARCHIVED' " +
        "AND NOT EXISTS (" +
        " SELECT 1 FROM product_media pm" +
        " WHERE pm.storage_provider = 'R2' AND pm.storage_key = a.storage_key" +
        ") " +
        "AND NOT EXISTS (" +
        " SELECT 1 FROM storefront_node_versions snv WHERE snv.image_url = a.public_url" +
        ") " +
        "AND NOT EXISTS (" +
        " SELECT 1 FROM website_appearance_versions wav" +
        " WHERE wav.hero_image_url = a.public_url" +
        " OR instr(COALESCE(wav.section_images_json, ''), a.public_url) > 0" +
        ") " +
        "AND NOT EXISTS (" +
        " SELECT 1 FROM shared_media_references r" +
        " WHERE r.asset_id = a.id AND r.released_at IS NULL" +
        ") " +
        "ON CONFLICT(asset_id) DO UPDATE SET " +
        "storage_key = excluded.storage_key, state = 'CLAIMED', " +
        "attempt_count = shared_media_delete_jobs.attempt_count + 1, " +
        "claim_token = excluded.claim_token, last_error = NULL, " +
        "claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at, " +
        "updated_at = excluded.updated_at " +
        "WHERE shared_media_delete_jobs.state IN ('CLAIMED','FAILED')",
    )
    .bind(claimToken, actorEmail, timestamp, timestamp, assetId)
    .run();

  const claimed = await db
    .prepare(
      "SELECT storage_key AS storageKey, state, claim_token AS claimToken " +
        "FROM shared_media_delete_jobs WHERE asset_id = ? LIMIT 1",
    )
    .bind(assetId)
    .first<{ storageKey: string; state: string; claimToken: string }>();

  if (claimed?.state === "DONE") {
    return {
      assetId,
      storageKey: claimed.storageKey,
      claimToken: null,
      alreadyDeleted: true,
    };
  }

  if (claimed?.state === "CLAIMED" && claimed.claimToken === claimToken) {
    return {
      assetId,
      storageKey: claimed.storageKey,
      claimToken,
      alreadyDeleted: false,
    };
  }

  const eligibility = await sharedMediaDeleteEligibility(db, assetId);
  if (!eligibility.canDeleteObject) throw new Error("shared_media_delete_blocked");
  throw new Error("shared_media_delete_claim_failed");
}

export async function recordSharedMediaDeleteFailure(
  db: D1DatabaseLike,
  assetId: string,
  claimToken: string,
  cause: unknown,
): Promise<void> {
  const message = String(cause instanceof Error ? cause.message : cause ?? "R2 delete failed")
    .slice(0, 500);
  const timestamp = now();
  await db
    .prepare(
      "UPDATE shared_media_delete_jobs SET state = 'FAILED', last_error = ?, updated_at = ? " +
        "WHERE asset_id = ? AND state = 'CLAIMED' AND claim_token = ?",
    )
    .bind(message, timestamp, assetId, claimToken)
    .run();
}

export async function finalizeSharedMediaObjectDeletion(
  db: D1DatabaseLike,
  claim: SharedMediaDeleteClaim,
  actorEmail: string,
): Promise<void> {
  if (claim.alreadyDeleted) return;
  if (!claim.claimToken) throw new Error("shared_media_delete_claim_failed");

  const timestamp = now();
  const beforeJson = JSON.stringify({ status: "ARCHIVED" });
  const afterJson = JSON.stringify({
    status: "DELETED",
    storageKey: claim.storageKey,
    crashSafeClaim: true,
  });

  await db.batch([
    db
      .prepare(
        "UPDATE shared_media_assets SET status = 'DELETED', deleted_at = ?, " +
          "updated_by = ?, updated_at = ? " +
          "WHERE id = ? AND status = 'ARCHIVED' AND EXISTS (" +
          "SELECT 1 FROM shared_media_delete_jobs j " +
          "WHERE j.asset_id = ? AND j.state = 'CLAIMED' AND j.claim_token = ?)",
      )
      .bind(
        timestamp,
        actorEmail,
        timestamp,
        claim.assetId,
        claim.assetId,
        claim.claimToken,
      ),
    db
      .prepare(
        "UPDATE shared_media_delete_jobs SET state = 'DONE', last_error = NULL, updated_at = ? " +
          "WHERE asset_id = ? AND state = 'CLAIMED' AND claim_token = ?",
      )
      .bind(timestamp, claim.assetId, claim.claimToken),
    db
      .prepare(
        "INSERT INTO shared_media_audit_events (" +
          "id, asset_id, event_type, actor_id, before_json, after_json, created_at" +
          ") SELECT ?, ?, 'OBJECT_DELETED', ?, ?, ?, ? WHERE EXISTS (" +
          "SELECT 1 FROM shared_media_delete_jobs j " +
          "WHERE j.asset_id = ? AND j.state = 'CLAIMED' AND j.claim_token = ?)",
      )
      .bind(
        uid("smae"),
        claim.assetId,
        actorEmail,
        beforeJson,
        afterJson,
        timestamp,
        claim.assetId,
        claim.claimToken,
      ),
  ]);

  const completed = await db
    .prepare(
      "SELECT state, claim_token AS claimToken FROM shared_media_delete_jobs " +
        "WHERE asset_id = ? LIMIT 1",
    )
    .bind(claim.assetId)
    .first<{ state: string; claimToken: string }>();

  if (completed?.state !== "DONE" || completed.claimToken !== claim.claimToken) {
    throw new Error("shared_media_delete_finalize_failed");
  }
}
