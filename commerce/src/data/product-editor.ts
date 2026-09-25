
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

const SELL_STATUSES = new Set([
  "AUTO",
  "OUT_OF_STOCK",
  "ARRIVING_SOON",
  "NOT_FOR_SALE",
]);

const q = (...parts: string[]) => parts.join(" ");

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function textValue(
  value: unknown,
  name: string,
  options: { required?: boolean; max?: number; nullable?: boolean } = {},
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && options.nullable) return null;
  const result = String(value ?? "").trim();
  if (options.required && !result) throw new Error("product_" + name + "_required");
  if (!result && options.nullable) return null;
  if (options.max && result.length > options.max) {
    throw new Error("product_" + name + "_too_long");
  }
  return result;
}

function boolValue(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error("product_" + name + "_invalid");
  return value;
}

function intMoney(value: unknown, name: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10_000_000) {
    throw new Error("product_" + name + "_invalid");
  }
  return number;
}

function intValue(value: unknown, name: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
    throw new Error("product_" + name + "_invalid");
  }
  return number;
}

function expectedVersion(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("product_expected_version_invalid");
  }
  return number;
}

function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 82)
    .replace(/-+$/g, "");
  return base || "product";
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

async function uniqueSlug(db: D1DatabaseLike, title: string): Promise<string> {
  const base = slugify(title);
  for (let index = 1; index <= 100; index += 1) {
    const slug = index === 1 ? base : base + "-" + index;
    const found = await db
      .prepare("SELECT id FROM products WHERE current_slug = ? LIMIT 1")
      .bind(slug)
      .first<{ id: string }>();
    if (!found) return slug;
  }
  throw new Error("product_slug_unavailable");
}

async function assertCategories(
  db: D1DatabaseLike,
  categoryIds: string[],
): Promise<void> {
  const unique = [...new Set(categoryIds.filter(Boolean))];
  if (unique.length !== categoryIds.length) {
    throw new Error("product_categories_invalid");
  }
  if (!unique.length) return;
  const placeholders = unique.map(() => "?").join(",");
  const rows = await allRows<{ id: string }>(
    db
      .prepare(
        "SELECT id FROM categories WHERE active = 1 AND id IN (" +
          placeholders +
          ")",
      )
      .bind(...unique),
  );
  if (rows.length !== unique.length) throw new Error("product_category_not_found");
}

async function assertSkuBarcodeUnique(
  db: D1DatabaseLike,
  variantId: string | null,
  sku: string | null | undefined,
  barcode: string | null | undefined,
): Promise<void> {
  if (sku) {
    const row = await db
      .prepare(
        "SELECT id FROM product_variants WHERE sku = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      )
      .bind(sku, variantId, variantId)
      .first<{ id: string }>();
    if (row) throw new Error("product_sku_conflict");
  }
  if (barcode) {
    const row = await db
      .prepare(
        "SELECT id FROM product_variants WHERE barcode = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      )
      .bind(barcode, variantId, variantId)
      .first<{ id: string }>();
    if (row) throw new Error("product_barcode_conflict");
  }
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
    variantId?: string | null;
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
        ") SELECT ?, ?, ?, ?, 'ADMIN', ?, NULL, NULL, ?, ?, ?, ?",
        "FROM products WHERE id = ? AND version = ? AND updated_at = ?",
      ),
    )
    .bind(
      uid("pae"),
      input.productId,
      input.variantId ?? null,
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

export interface CreateAdminProductInput {
  title: unknown;
  shortDescription?: unknown;
  productType?: unknown;
  brand?: unknown;
  collectionLabel?: unknown;
  priceMinor?: unknown;
  sku?: unknown;
  barcode?: unknown;
  categoryIds?: unknown;
}

export async function createAdminProduct(
  db: D1DatabaseLike,
  raw: CreateAdminProductInput,
  actorEmail: string,
): Promise<{ id: string }> {
  const title = textValue(raw.title, "title", { required: true, max: 160 })!;
  const shortDescription =
    textValue(raw.shortDescription, "description", { max: 1200 }) ?? "";
  const productType =
    textValue(raw.productType, "type", { max: 80 }) || "gifts";
  const brand = textValue(raw.brand, "brand", { max: 120, nullable: true }) ?? null;
  const collectionLabel =
    textValue(raw.collectionLabel, "collection_label", {
      max: 120,
      nullable: true,
    }) ?? null;
  const priceMinor = intMoney(raw.priceMinor, "price");
  const sku = textValue(raw.sku, "sku", { max: 80, nullable: true }) ?? null;
  const barcode =
    textValue(raw.barcode, "barcode", { max: 80, nullable: true }) ?? null;
  const categoryIds = Array.isArray(raw.categoryIds)
    ? raw.categoryIds.map((value) => String(value))
    : [];

  await assertCategories(db, categoryIds);
  await assertSkuBarcodeUnique(db, null, sku, barcode);

  const createdAt = now();
  const productId = uid("prd");
  const draftId = uid("pver");
  const variantId = uid("var");
  const slug = await uniqueSlug(db, title);

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        q(
          "INSERT INTO products (",
          "id, legacy_catalog_id, current_slug, publication_status, sell_status,",
          "online_ordering_enabled, featured, current_published_version_id,",
          "current_draft_version_id, version, created_at, updated_at, archived_at",
          ") VALUES (?, NULL, ?, 'DRAFT', 'AUTO', 1, 0, NULL, ?, 1, ?, ?, NULL)",
        ),
      )
      .bind(productId, slug, draftId, createdAt, createdAt),
    db
      .prepare(
        q(
          "INSERT INTO product_versions (",
          "id, product_id, version_number, title, short_description, long_description,",
          "brand, collection_label, product_type, public_note, seo_title, seo_description,",
          "created_by, created_at, published_at, superseded_at",
          ") VALUES (?, ?, 1, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL, NULL)",
        ),
      )
      .bind(
        draftId,
        productId,
        title,
        shortDescription,
        brand,
        collectionLabel,
        productType,
        actorEmail,
        createdAt,
      ),
    db
      .prepare(
        "INSERT INTO product_slugs (product_id, slug, is_primary, created_at, retired_at) VALUES (?, ?, 1, ?, NULL)",
      )
      .bind(productId, slug, createdAt),
    db
      .prepare(
        q(
          "INSERT INTO product_variants (",
          "id, product_id, title, sku, barcode, price_minor, compare_at_price_minor,",
          "cost_minor, currency, track_inventory, low_stock_threshold, active, is_default,",
          "version, created_at, updated_at",
          ") VALUES (?, ?, 'Default', ?, ?, ?, NULL, NULL, 'GBP', 0, NULL, 1, 1, 1, ?, ?)",
        ),
      )
      .bind(
        variantId,
        productId,
        sku,
        barcode,
        priceMinor ?? null,
        createdAt,
        createdAt,
      ),
  ];

  categoryIds.forEach((categoryId, index) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO product_version_categories (product_version_id, category_id, is_primary, position) VALUES (?, ?, ?, ?)",
        )
        .bind(draftId, categoryId, index === 0 ? 1 : 0, index),
    );
  });

  statements.push(
    db
      .prepare(
        q(
          "INSERT INTO product_audit_events (",
          "id, product_id, variant_id, event_type, actor_type, actor_id, request_id,",
          "idempotency_key, before_json, after_json, reason, created_at",
          ") VALUES (?, ?, ?, 'PRODUCT_CREATED', 'ADMIN', ?, NULL, NULL, NULL, ?, ?, ?)",
        ),
      )
      .bind(
        uid("pae"),
        productId,
        variantId,
        actorEmail,
        JSON.stringify({
          title,
          slug,
          priceMinor: priceMinor ?? null,
          sku,
          barcode,
          categoryIds,
        }),
        "Product created as a private draft",
        createdAt,
      ),
  );

  await db.batch(statements);
  return { id: productId };
}

export interface ProductOperationsInput {
  expectedVersion: unknown;
  sellStatus?: unknown;
  onlineOrderingEnabled?: unknown;
  featured?: unknown;
}

export async function updateAdminProductOperations(
  db: D1DatabaseLike,
  productId: string,
  raw: ProductOperationsInput,
  actorEmail: string,
): Promise<void> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      "SELECT id, version, sell_status AS sellStatus, online_ordering_enabled AS onlineOrderingEnabled, featured FROM products WHERE id = ? LIMIT 1",
    )
    .bind(productId)
    .first<{
      id: string;
      version: number;
      sellStatus: string;
      onlineOrderingEnabled: number;
      featured: number;
    }>();

  if (!current) throw new Error("product_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");

  let sellStatus = current.sellStatus;
  if (raw.sellStatus !== undefined) {
    sellStatus = String(raw.sellStatus);
    if (!SELL_STATUSES.has(sellStatus)) throw new Error("product_sell_status_invalid");
  }

  const online =
    boolValue(raw.onlineOrderingEnabled, "online_ordering") ??
    (Number(current.onlineOrderingEnabled) === 1);
  const featured =
    boolValue(raw.featured, "featured") ?? (Number(current.featured) === 1);

  const token = now();
  const resultVersion = expected + 1;
  const before = {
    sellStatus: current.sellStatus,
    onlineOrderingEnabled: Number(current.onlineOrderingEnabled) === 1,
    featured: Number(current.featured) === 1,
  };
  const after = { sellStatus, onlineOrderingEnabled: online, featured };

  await db.batch([
    db
      .prepare(
        "UPDATE products SET sell_status = ?, online_ordering_enabled = ?, featured = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(
        sellStatus,
        online ? 1 : 0,
        featured ? 1 : 0,
        token,
        productId,
        expected,
      ),
    auditStatement(db, {
      productId,
      eventType: "PRODUCT_OPERATIONS_UPDATED",
      actorEmail,
      before,
      after,
      reason: "Owner quick-edit selling state",
      resultVersion,
      token,
    }),
  ]);

  await verifyProductToken(db, productId, resultVersion, token);
}

export interface VariantUpdateInput {
  expectedVersion: unknown;
  priceMinor?: unknown;
  compareAtPriceMinor?: unknown;
  sku?: unknown;
  barcode?: unknown;
  lowStockThreshold?: unknown;
  active?: unknown;
}

export async function updateAdminVariant(
  db: D1DatabaseLike,
  variantId: string,
  raw: VariantUpdateInput,
  actorEmail: string,
): Promise<{ productId: string }> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      q(
        "SELECT v.id, v.product_id AS productId, v.version, v.price_minor AS priceMinor,",
        "v.compare_at_price_minor AS compareAtPriceMinor, v.sku, v.barcode,",
        "v.low_stock_threshold AS lowStockThreshold, v.active, p.version AS productVersion",
        "FROM product_variants v JOIN products p ON p.id = v.product_id",
        "WHERE v.id = ? LIMIT 1",
      ),
    )
    .bind(variantId)
    .first<{
      id: string;
      productId: string;
      version: number;
      priceMinor: number | null;
      compareAtPriceMinor: number | null;
      sku: string | null;
      barcode: string | null;
      lowStockThreshold: number | null;
      active: number;
      productVersion: number;
    }>();

  if (!current) throw new Error("product_variant_not_found");
  if (Number(current.version) !== expected) {
    throw new Error("product_variant_version_conflict");
  }

  const priceMinor = intMoney(raw.priceMinor, "price");
  const compareAtPriceMinor = intMoney(raw.compareAtPriceMinor, "compare_price");
  const sku = textValue(raw.sku, "sku", { max: 80, nullable: true });
  const barcode = textValue(raw.barcode, "barcode", { max: 80, nullable: true });
  const lowStockThreshold = intValue(raw.lowStockThreshold, "low_stock_threshold");
  const active = boolValue(raw.active, "variant_active");

  const next = {
    priceMinor: priceMinor === undefined ? current.priceMinor : priceMinor,
    compareAtPriceMinor:
      compareAtPriceMinor === undefined
        ? current.compareAtPriceMinor
        : compareAtPriceMinor,
    sku: sku === undefined ? current.sku : sku,
    barcode: barcode === undefined ? current.barcode : barcode,
    lowStockThreshold:
      lowStockThreshold === undefined
        ? current.lowStockThreshold
        : lowStockThreshold,
    active: active === undefined ? Number(current.active) === 1 : active,
  };

  await assertSkuBarcodeUnique(db, variantId, next.sku, next.barcode);

  const token = now();
  const nextVariantVersion = expected + 1;
  const nextProductVersion = Number(current.productVersion) + 1;
  const before = {
    priceMinor: current.priceMinor,
    compareAtPriceMinor: current.compareAtPriceMinor,
    sku: current.sku,
    barcode: current.barcode,
    lowStockThreshold: current.lowStockThreshold,
    active: Number(current.active) === 1,
  };

  try {
    await db.batch([
      db
        .prepare(
          "UPDATE products SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
        )
        .bind(token, current.productId, current.productVersion),
      db
        .prepare(
          q(
            "UPDATE product_variants SET price_minor = ?, compare_at_price_minor = ?,",
            "sku = ?, barcode = ?, low_stock_threshold = ?, active = ?,",
            "version = version + 1, updated_at = ?",
            "WHERE id = ? AND version = ? AND EXISTS (",
            "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          next.priceMinor,
          next.compareAtPriceMinor,
          next.sku,
          next.barcode,
          next.lowStockThreshold,
          next.active ? 1 : 0,
          token,
          variantId,
          expected,
          current.productId,
          nextProductVersion,
          token,
        ),
      auditStatement(db, {
        productId: current.productId,
        variantId,
        eventType: "VARIANT_UPDATED",
        actorEmail,
        before,
        after: next,
        reason: "Owner quick-edit variant",
        resultVersion: nextProductVersion,
        token,
      }),
    ]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.toLowerCase() : "";
    if (message.includes("product_variants.sku")) throw new Error("product_sku_conflict");
    if (message.includes("product_variants.barcode")) {
      throw new Error("product_barcode_conflict");
    }
    throw cause;
  }

  await verifyProductToken(db, current.productId, nextProductVersion, token);
  const variantCheck = await db
    .prepare(
      "SELECT id FROM product_variants WHERE id = ? AND version = ? AND updated_at = ? LIMIT 1",
    )
    .bind(variantId, nextVariantVersion, token)
    .first<{ id: string }>();
  if (!variantCheck) throw new Error("product_variant_version_conflict");

  return { productId: current.productId };
}

export interface ProductDraftInput {
  expectedVersion: unknown;
  changes?: Record<string, unknown>;
}

export async function saveAdminProductDraft(
  db: D1DatabaseLike,
  productId: string,
  raw: ProductDraftInput,
  actorEmail: string,
): Promise<void> {
  const expected = expectedVersion(raw.expectedVersion);
  const changes =
    raw.changes && typeof raw.changes === "object" && !Array.isArray(raw.changes)
      ? raw.changes
      : {};

  const current = await db
    .prepare(
      q(
        "SELECT p.id, p.version, p.current_published_version_id AS publishedVersionId,",
        "p.current_draft_version_id AS draftVersionId, pv.version_number AS versionNumber,",
        "pv.title, pv.short_description AS shortDescription,",
        "pv.long_description AS longDescription, pv.brand,",
        "pv.collection_label AS collectionLabel, pv.product_type AS productType,",
        "pv.public_note AS publicNote, pv.seo_title AS seoTitle,",
        "pv.seo_description AS seoDescription",
        "FROM products p JOIN product_versions pv",
        "ON pv.id = COALESCE(p.current_draft_version_id, p.current_published_version_id)",
        "WHERE p.id = ? LIMIT 1",
      ),
    )
    .bind(productId)
    .first<{
      id: string;
      version: number;
      publishedVersionId: string | null;
      draftVersionId: string | null;
      versionNumber: number;
      title: string;
      shortDescription: string;
      longDescription: string | null;
      brand: string | null;
      collectionLabel: string | null;
      productType: string;
      publicNote: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
    }>();

  if (!current) throw new Error("product_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");

  const draftId = current.draftVersionId ?? uid("pver");
  const newDraft = !current.draftVersionId;

  const changedLong = textValue(changes.longDescription, "long_description", {
    max: 12000,
    nullable: true,
  });
  const changedBrand = textValue(changes.brand, "brand", {
    max: 120,
    nullable: true,
  });
  const changedLabel = textValue(changes.collectionLabel, "collection_label", {
    max: 120,
    nullable: true,
  });
  const changedNote = textValue(changes.publicNote, "public_note", {
    max: 1200,
    nullable: true,
  });
  const changedSeoTitle = textValue(changes.seoTitle, "seo_title", {
    max: 180,
    nullable: true,
  });
  const changedSeoDescription = textValue(changes.seoDescription, "seo_description", {
    max: 320,
    nullable: true,
  });

  const next = {
    title:
      textValue(changes.title, "title", { required: true, max: 160 }) ??
      current.title,
    shortDescription:
      textValue(changes.shortDescription, "description", { max: 1200 }) ??
      current.shortDescription,
    longDescription:
      changedLong === undefined ? current.longDescription : changedLong,
    brand: changedBrand === undefined ? current.brand : changedBrand,
    collectionLabel:
      changedLabel === undefined ? current.collectionLabel : changedLabel,
    productType:
      textValue(changes.productType, "type", { required: true, max: 80 }) ??
      current.productType,
    publicNote: changedNote === undefined ? current.publicNote : changedNote,
    seoTitle:
      changedSeoTitle === undefined ? current.seoTitle : changedSeoTitle,
    seoDescription:
      changedSeoDescription === undefined
        ? current.seoDescription
        : changedSeoDescription,
  };

  const categorySourceId = current.draftVersionId ?? current.publishedVersionId;
  const existingCategories = categorySourceId
    ? await allRows<{ categoryId: string; isPrimary: number; position: number }>(
        db
          .prepare(
            "SELECT category_id AS categoryId, is_primary AS isPrimary, position FROM product_version_categories WHERE product_version_id = ? ORDER BY position",
          )
          .bind(categorySourceId),
      )
    : [];

  const requestedCategories = Array.isArray(changes.categoryIds)
    ? changes.categoryIds.map((value) => String(value))
    : null;
  const categoryIds =
    requestedCategories ?? existingCategories.map((row) => row.categoryId);
  await assertCategories(db, categoryIds);

  const requestedPrimary =
    changes.primaryCategoryId === undefined
      ? null
      : String(changes.primaryCategoryId ?? "");
  const existingPrimary =
    existingCategories.find((row) => Number(row.isPrimary) === 1)?.categoryId ??
    categoryIds[0] ??
    null;
  const primaryCategoryId =
    requestedPrimary && categoryIds.includes(requestedPrimary)
      ? requestedPrimary
      : existingPrimary && categoryIds.includes(existingPrimary)
        ? existingPrimary
        : categoryIds[0] ?? null;

  const token = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE products SET current_draft_version_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(draftId, token, productId, expected),
  ];

  if (newDraft) {
    statements.push(
      db
        .prepare(
          q(
            "INSERT INTO product_versions (",
            "id, product_id, version_number, title, short_description, long_description,",
            "brand, collection_label, product_type, public_note, seo_title, seo_description,",
            "created_by, created_at, published_at, superseded_at",
            ") SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL",
            "FROM products WHERE id = ? AND version = ? AND updated_at = ?",
          ),
        )
        .bind(
          draftId,
          productId,
          Number(current.versionNumber) + 1,
          next.title,
          next.shortDescription,
          next.longDescription,
          next.brand,
          next.collectionLabel,
          next.productType,
          next.publicNote,
          next.seoTitle,
          next.seoDescription,
          actorEmail,
          token,
          productId,
          resultVersion,
          token,
        ),
    );

    if (current.publishedVersionId) {
      statements.push(
        db
          .prepare(
            q(
              "INSERT INTO product_version_media (product_version_id, media_id, position, is_primary, alt_text, display_fit)",
              "SELECT ?, pvm.media_id, pvm.position, pvm.is_primary, pvm.alt_text, pvm.display_fit",
              "FROM product_version_media pvm WHERE pvm.product_version_id = ?",
              "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
            ),
          )
          .bind(
            draftId,
            current.publishedVersionId,
            productId,
            resultVersion,
            token,
          ),
      );
      statements.push(
        db
          .prepare(
            q(
              "INSERT INTO product_attributes (product_version_id, attribute_key, label, value_text, value_json, visibility, position, source_record_id)",
              "SELECT ?, pa.attribute_key, pa.label, pa.value_text, pa.value_json, pa.visibility, pa.position, pa.source_record_id",
              "FROM product_attributes pa WHERE pa.product_version_id = ?",
              "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
            ),
          )
          .bind(
            draftId,
            current.publishedVersionId,
            productId,
            resultVersion,
            token,
          ),
      );
    }
  } else {
    statements.push(
      db
        .prepare(
          q(
            "UPDATE product_versions SET title = ?, short_description = ?,",
            "long_description = ?, brand = ?, collection_label = ?, product_type = ?,",
            "public_note = ?, seo_title = ?, seo_description = ?",
            "WHERE id = ? AND EXISTS (",
            "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          next.title,
          next.shortDescription,
          next.longDescription,
          next.brand,
          next.collectionLabel,
          next.productType,
          next.publicNote,
          next.seoTitle,
          next.seoDescription,
          draftId,
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
          "DELETE FROM product_version_categories WHERE product_version_id = ?",
          "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
        ),
      )
      .bind(draftId, productId, resultVersion, token),
  );

  categoryIds.forEach((categoryId, index) => {
    statements.push(
      db
        .prepare(
          q(
            "INSERT INTO product_version_categories (product_version_id, category_id, is_primary, position)",
            "SELECT ?, ?, ?, ? FROM products",
            "WHERE id = ? AND version = ? AND updated_at = ?",
          ),
        )
        .bind(
          draftId,
          categoryId,
          categoryId === primaryCategoryId ? 1 : 0,
          index,
          productId,
          resultVersion,
          token,
        ),
    );
  });

  statements.push(
    auditStatement(db, {
      productId,
      eventType: newDraft ? "CONTENT_DRAFT_CREATED" : "CONTENT_DRAFT_UPDATED",
      actorEmail,
      before: {
        title: current.title,
        shortDescription: current.shortDescription,
        brand: current.brand,
        collectionLabel: current.collectionLabel,
        productType: current.productType,
        categoryIds: existingCategories.map((row) => row.categoryId),
      },
      after: {
        ...next,
        categoryIds,
        primaryCategoryId,
      },
      reason: "Owner edited product content draft",
      resultVersion,
      token,
    }),
  );

  await db.batch(statements);
  await verifyProductToken(db, productId, resultVersion, token);
}

export interface PublishProductInput {
  expectedVersion: unknown;
}

export async function publishAdminProduct(
  db: D1DatabaseLike,
  productId: string,
  raw: PublishProductInput,
  actorEmail: string,
): Promise<void> {
  const expected = expectedVersion(raw.expectedVersion);
  const current = await db
    .prepare(
      q(
        "SELECT p.id, p.version, p.current_published_version_id AS publishedVersionId,",
        "p.current_draft_version_id AS draftVersionId,",
        "p.online_ordering_enabled AS onlineOrderingEnabled, p.sell_status AS sellStatus,",
        "v.id AS variantId, v.price_minor AS priceMinor",
        "FROM products p JOIN product_variants v",
        "ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1",
        "WHERE p.id = ? LIMIT 1",
      ),
    )
    .bind(productId)
    .first<{
      id: string;
      version: number;
      publishedVersionId: string | null;
      draftVersionId: string | null;
      onlineOrderingEnabled: number;
      sellStatus: string;
      variantId: string;
      priceMinor: number | null;
    }>();

  if (!current) throw new Error("product_not_found");
  if (Number(current.version) !== expected) throw new Error("product_version_conflict");
  if (!current.draftVersionId) throw new Error("product_no_draft");

  const categoryCount = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM product_version_categories WHERE product_version_id = ?",
    )
    .bind(current.draftVersionId)
    .first<{ count: number }>();

  if (Number(categoryCount?.count ?? 0) < 1) {
    throw new Error("product_publish_requires_category");
  }
  if (
    Number(current.onlineOrderingEnabled) === 1 &&
    current.sellStatus === "AUTO" &&
    current.priceMinor === null
  ) {
    throw new Error("product_publish_requires_price");
  }

  const token = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        q(
          "UPDATE products SET current_published_version_id = current_draft_version_id,",
          "current_draft_version_id = NULL, publication_status = 'ACTIVE',",
          "version = version + 1, updated_at = ?",
          "WHERE id = ? AND version = ? AND current_draft_version_id = ?",
        ),
      )
      .bind(token, productId, expected, current.draftVersionId),
    db
      .prepare(
        q(
          "UPDATE product_versions SET published_at = ?, superseded_at = NULL",
          "WHERE id = ? AND EXISTS (",
          "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
        ),
      )
      .bind(token, current.draftVersionId, productId, resultVersion, token),
  ];

  if (
    current.publishedVersionId &&
    current.publishedVersionId !== current.draftVersionId
  ) {
    statements.push(
      db
        .prepare(
          q(
            "UPDATE product_versions SET superseded_at = ? WHERE id = ?",
            "AND EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
          ),
        )
        .bind(
          token,
          current.publishedVersionId,
          productId,
          resultVersion,
          token,
        ),
    );
  }

  statements.push(
    auditStatement(db, {
      productId,
      variantId: current.variantId,
      eventType: "PRODUCT_PUBLISHED",
      actorEmail,
      before: { publishedVersionId: current.publishedVersionId },
      after: { publishedVersionId: current.draftVersionId },
      reason: "Owner published product content to Product Core",
      resultVersion,
      token,
    }),
  );

  await db.batch(statements);
  await verifyProductToken(db, productId, resultVersion, token);
}

export async function listAdminCategories(
  db: D1DatabaseLike,
): Promise<Array<{ id: string; slug: string; name: string; sortOrder: number }>> {
  return allRows(
    db.prepare(
      "SELECT id, slug, name, sort_order AS sortOrder FROM categories WHERE active = 1 ORDER BY sort_order, name COLLATE NOCASE",
    ),
  );
}
