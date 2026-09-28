import { sharedMediaUrlsAvailableSql } from "./shared-media-attachment";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

export interface AppearanceTokens {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  button: string;
  border: string;
  header: string;
}

export type WebsiteAppearancePresetKey =
  | "DEFAULT"
  | "WINTER"
  | "CHRISTMAS"
  | "SUMMER"
  | "ICE_CREAM";

export interface WebsiteAppearancePreset {
  key: WebsiteAppearancePresetKey;
  label: string;
  description: string;
  tokens: AppearanceTokens;
}

export const WEBSITE_APPEARANCE_PRESETS: readonly WebsiteAppearancePreset[] = [
  {
    key: "DEFAULT",
    label: "Default",
    description: "The Black Sheep Shop's warm neutral look for everyday use.",
    tokens: {
      background: "#f8f4ea",
      surface: "#fffefa",
      text: "#151512",
      mutedText: "#706b61",
      accent: "#b7904c",
      button: "#151512",
      border: "#ddd5c6",
      header: "#f8f4ea",
    },
  },
  {
    key: "WINTER",
    label: "Winter",
    description: "Cool, calm blue-grey tones with strong readable contrast.",
    tokens: {
      background: "#f1f5f6",
      surface: "#ffffff",
      text: "#17252b",
      mutedText: "#5c6970",
      accent: "#547985",
      button: "#244a59",
      border: "#ccd8dc",
      header: "#e7eff1",
    },
  },
  {
    key: "CHRISTMAS",
    label: "Christmas",
    description: "Cream, deep evergreen and restrained gold for the festive season.",
    tokens: {
      background: "#f7f3e8",
      surface: "#fffdf7",
      text: "#1b2b22",
      mutedText: "#5f675f",
      accent: "#a47a35",
      button: "#1e5239",
      border: "#ddd2be",
      header: "#edf1e7",
    },
  },
  {
    key: "SUMMER",
    label: "Summer",
    description: "Warm sunshine neutrals with a fresh deep teal accent.",
    tokens: {
      background: "#fff8e8",
      surface: "#fffdf7",
      text: "#18332f",
      mutedText: "#65706b",
      accent: "#b27a2c",
      button: "#17685d",
      border: "#e5d8bb",
      header: "#f7efd8",
    },
  },
  {
    key: "ICE_CREAM",
    label: "Ice Cream",
    description: "Soft berry and cream tones designed for ice-cream season.",
    tokens: {
      background: "#fff3f2",
      surface: "#fffdfc",
      text: "#3b252c",
      mutedText: "#725f65",
      accent: "#a55d72",
      button: "#7d4054",
      border: "#ead4d7",
      header: "#fce8e8",
    },
  },
];

export function listWebsiteAppearancePresets(): WebsiteAppearancePreset[] {
  return WEBSITE_APPEARANCE_PRESETS.map((item) => ({
    ...item,
    tokens: { ...item.tokens },
  }));
}

export interface AppearanceHero {
  imageUrl: string | null;
  heading: string | null;
  text: string | null;
  buttonLabel: string | null;
  buttonHref: string | null;
}

export interface WebsiteAppearanceSnapshot {
  id: string;
  version: number;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  effectiveVersionId: string;
  effectiveVersionNumber: number;
  hasDraft: boolean;
  presetKey: string;
  tokens: AppearanceTokens;
  hero: AppearanceHero;
  sectionImages: Record<string, string>;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface WebsiteAppearanceHistoryItem {
  versionId: string;
  versionNumber: number;
  presetKey: string;
  createdAt: string;
  publishedAt: string | null;
  supersededAt: string | null;
  createdBy: string;
  isCurrent: boolean;
}

export interface SaveWebsiteAppearanceDraftInput {
  expectedVersion: unknown;
  presetKey?: unknown;
  tokens?: unknown;
  hero?: unknown;
  sectionImages?: unknown;
}

const APPEARANCE_ID = "site_appearance";
const HEX = /^#[0-9a-fA-F]{6}$/;

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("appearance_expected_version_invalid");
  }
  return version;
}

function colour(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  const result = String(value ?? "").trim().toLowerCase();
  if (!HEX.test(result)) throw new Error("appearance_colour_invalid");
  return result;
}

function optionalText(
  value: unknown,
  fallback: string | null,
  max: number,
  code: string,
): string | null {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error(code);
  return result || null;
}

export function normalizeWebsiteAppearancePresetKey(
  value: unknown,
  fallback: string,
): WebsiteAppearancePresetKey {
  const candidate = String(value === undefined ? fallback : value ?? "")
    .trim()
    .toUpperCase();
  if (
    !WEBSITE_APPEARANCE_PRESETS.some((item) => item.key === candidate)
  ) {
    throw new Error("appearance_preset_invalid");
  }
  return candidate as WebsiteAppearancePresetKey;
}

function presetTokens(key: WebsiteAppearancePresetKey): AppearanceTokens {
  const found = WEBSITE_APPEARANCE_PRESETS.find((item) => item.key === key);
  if (!found) throw new Error("appearance_preset_invalid");
  return { ...found.tokens };
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number): number => {
    const raw = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928
      ? raw / 12.92
      : Math.pow((raw + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(1) +
    0.7152 * channel(3) +
    0.0722 * channel(5)
  );
}

export function appearanceContrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) {
    throw new Error("appearance_colour_invalid");
  }
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function validateAppearanceContrast(tokens: AppearanceTokens): void {
  const pairs: Array<[string, string, number]> = [
    [tokens.text, tokens.background, 4.5],
    [tokens.text, tokens.surface, 4.5],
    [tokens.mutedText, tokens.background, 4.5],
    [tokens.text, tokens.header, 4.5],
    ["#ffffff", tokens.button, 4.5],
  ];
  if (
    pairs.some(
      ([foreground, background, minimum]) =>
        appearanceContrastRatio(foreground, background) < minimum,
    )
  ) {
    throw new Error("appearance_contrast_invalid");
  }
}

function safeHref(value: unknown, fallback: string | null): string | null {
  const result = optionalText(
    value,
    fallback,
    300,
    "appearance_hero_href_invalid",
  );
  if (result == null) return null;
  if (
    !result.startsWith("/") &&
    !/^https:\/\/(?:www\.)?theblacksheepshop\.co\.uk(?:\/|$)/i.test(result)
  ) {
    throw new Error("appearance_hero_href_invalid");
  }
  return result;
}

function sectionImages(
  value: unknown,
  fallback: Record<string, string>,
): Record<string, string> {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("appearance_section_images_invalid");
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{2,80}$/i.test(key)) {
      throw new Error("appearance_section_images_invalid");
    }
    const url = String(raw ?? "").trim();
    if (!url || url.length > 700) {
      throw new Error("appearance_section_images_invalid");
    }
    result[key] = url;
  }
  if (Object.keys(result).length > 50) {
    throw new Error("appearance_section_images_invalid");
  }
  return result;
}

function parseImages(value: unknown): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function snapshotFromRow(row: Record<string, unknown>): WebsiteAppearanceSnapshot {
  return {
    id: String(row.id),
    version: Number(row.version),
    publishedVersionId:
      row.publishedVersionId == null ? null : String(row.publishedVersionId),
    draftVersionId:
      row.draftVersionId == null ? null : String(row.draftVersionId),
    effectiveVersionId: String(row.effectiveVersionId),
    effectiveVersionNumber: Number(row.effectiveVersionNumber),
    hasDraft: row.draftVersionId != null,
    presetKey: String(row.presetKey),
    tokens: {
      background: String(row.backgroundColor),
      surface: String(row.surfaceColor),
      text: String(row.textColor),
      mutedText: String(row.mutedTextColor),
      accent: String(row.accentColor),
      button: String(row.buttonColor),
      border: String(row.borderColor),
      header: String(row.headerColor),
    },
    hero: {
      imageUrl: row.heroImageUrl == null ? null : String(row.heroImageUrl),
      heading: row.heroHeading == null ? null : String(row.heroHeading),
      text: row.heroText == null ? null : String(row.heroText),
      buttonLabel:
        row.heroButtonLabel == null ? null : String(row.heroButtonLabel),
      buttonHref:
        row.heroButtonHref == null ? null : String(row.heroButtonHref),
    },
    sectionImages: parseImages(row.sectionImagesJson),
    scheduledStartAt:
      row.scheduledStartAt == null ? null : String(row.scheduledStartAt),
    scheduledEndAt:
      row.scheduledEndAt == null ? null : String(row.scheduledEndAt),
    createdAt: String(row.createdAt),
    publishedAt: row.publishedAt == null ? null : String(row.publishedAt),
  };
}

async function loadAppearance(
  db: D1DatabaseLike,
  publishedOnly: boolean,
): Promise<WebsiteAppearanceSnapshot> {
  const versionExpr = publishedOnly
    ? "wa.current_published_version_id"
    : "COALESCE(wa.current_draft_version_id, wa.current_published_version_id)";
  const row = await db
    .prepare(
      "SELECT wa.id, wa.version, wa.current_published_version_id AS publishedVersionId, " +
        "wa.current_draft_version_id AS draftVersionId, wav.id AS effectiveVersionId, " +
        "wav.version_number AS effectiveVersionNumber, wav.preset_key AS presetKey, " +
        "wav.background_color AS backgroundColor, wav.surface_color AS surfaceColor, " +
        "wav.text_color AS textColor, wav.muted_text_color AS mutedTextColor, " +
        "wav.accent_color AS accentColor, wav.button_color AS buttonColor, " +
        "wav.border_color AS borderColor, wav.header_color AS headerColor, " +
        "wav.hero_image_url AS heroImageUrl, wav.hero_heading AS heroHeading, " +
        "wav.hero_text AS heroText, wav.hero_button_label AS heroButtonLabel, " +
        "wav.hero_button_href AS heroButtonHref, wav.section_images_json AS sectionImagesJson, " +
        "wav.scheduled_start_at AS scheduledStartAt, wav.scheduled_end_at AS scheduledEndAt, " +
        "wav.created_at AS createdAt, wav.published_at AS publishedAt " +
        "FROM website_appearance wa " +
        "JOIN website_appearance_versions wav ON wav.id = " +
        versionExpr +
        " WHERE wa.id = ? LIMIT 1",
    )
    .bind(APPEARANCE_ID)
    .first<Record<string, unknown>>();

  if (!row) throw new Error("appearance_not_found");
  return snapshotFromRow(row);
}

export async function getAdminWebsiteAppearance(
  db: D1DatabaseLike,
): Promise<WebsiteAppearanceSnapshot> {
  return loadAppearance(db, false);
}

export async function getPublishedWebsiteAppearance(
  db: D1DatabaseLike,
): Promise<WebsiteAppearanceSnapshot> {
  return loadAppearance(db, true);
}

export async function listWebsiteAppearanceHistory(
  db: D1DatabaseLike,
  limit = 8,
): Promise<WebsiteAppearanceHistoryItem[]> {
  const current = await db
    .prepare(
      "SELECT current_published_version_id AS publishedVersionId " +
        "FROM website_appearance WHERE id = ? LIMIT 1",
    )
    .bind(APPEARANCE_ID)
    .first<{ publishedVersionId: string | null }>();
  const statement = db
    .prepare(
      "SELECT id AS versionId, version_number AS versionNumber, preset_key AS presetKey, " +
        "created_at AS createdAt, published_at AS publishedAt, superseded_at AS supersededAt, " +
        "created_by AS createdBy FROM website_appearance_versions " +
        "WHERE appearance_id = ? AND published_at IS NOT NULL " +
        "ORDER BY published_at DESC, version_number DESC LIMIT ?",
    )
    .bind(APPEARANCE_ID, Math.max(1, Math.min(30, Math.trunc(limit))));
  if (!statement.all) throw new Error("database_all_unavailable");
  const rows = (await statement.all<Record<string, unknown>>()).results;
  return rows.map((row) => ({
    versionId: String(row.versionId),
    versionNumber: Number(row.versionNumber),
    presetKey: String(row.presetKey),
    createdAt: String(row.createdAt),
    publishedAt: row.publishedAt == null ? null : String(row.publishedAt),
    supersededAt: row.supersededAt == null ? null : String(row.supersededAt),
    createdBy: String(row.createdBy),
    isCurrent: String(row.versionId) === String(current?.publishedVersionId ?? ""),
  }));
}

function auditStatement(
  db: D1DatabaseLike,
  input: {
    eventType: "DRAFT_SAVED" | "PUBLISHED" | "RESTORED";
    actorEmail: string;
    before: unknown;
    after: unknown;
    createdAt: string;
    resultVersion: number;
  },
): D1PreparedStatementLike {
  return db
    .prepare(
      "INSERT INTO website_appearance_audit_events (" +
        "id, appearance_id, event_type, actor_id, before_json, after_json, created_at" +
        ") SELECT ?, ?, ?, ?, ?, ?, ? FROM website_appearance " +
        "WHERE id = ? AND version = ? AND updated_at = ?",
    )
    .bind(
      uid("waa"),
      APPEARANCE_ID,
      input.eventType,
      input.actorEmail,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      input.createdAt,
      APPEARANCE_ID,
      input.resultVersion,
      input.createdAt,
    );
}

export async function saveAdminWebsiteAppearanceDraft(
  db: D1DatabaseLike,
  raw: SaveWebsiteAppearanceDraftInput,
  actorEmail: string,
): Promise<void> {
  const current = await getAdminWebsiteAppearance(db);
  const expected = expectedVersion(raw.expectedVersion);
  if (current.version !== expected) throw new Error("appearance_version_conflict");

  const tokenRaw =
    raw.tokens && typeof raw.tokens === "object" && !Array.isArray(raw.tokens)
      ? (raw.tokens as Record<string, unknown>)
      : {};
  if (raw.tokens !== undefined && raw.tokens !== null && Object.keys(tokenRaw).length === 0) {
    throw new Error("appearance_tokens_invalid");
  }
  const heroRaw =
    raw.hero && typeof raw.hero === "object" && !Array.isArray(raw.hero)
      ? (raw.hero as Record<string, unknown>)
      : {};
  if (raw.hero !== undefined && raw.hero !== null && Object.keys(heroRaw).length === 0) {
    throw new Error("appearance_hero_invalid");
  }

  const nextPresetKey = normalizeWebsiteAppearancePresetKey(
    raw.presetKey,
    current.presetKey,
  );
  const presetChanged =
    raw.presetKey !== undefined && nextPresetKey !== current.presetKey;
  const tokenFallback = presetChanged
    ? presetTokens(nextPresetKey)
    : current.tokens;

  const next = {
    presetKey: nextPresetKey,
    tokens: {
      background: colour(tokenRaw.background, tokenFallback.background),
      surface: colour(tokenRaw.surface, tokenFallback.surface),
      text: colour(tokenRaw.text, tokenFallback.text),
      mutedText: colour(tokenRaw.mutedText, tokenFallback.mutedText),
      accent: colour(tokenRaw.accent, tokenFallback.accent),
      button: colour(tokenRaw.button, tokenFallback.button),
      border: colour(tokenRaw.border, tokenFallback.border),
      header: colour(tokenRaw.header, tokenFallback.header),
    },
    hero: {
      imageUrl: optionalText(
        heroRaw.imageUrl,
        current.hero.imageUrl,
        700,
        "appearance_hero_image_invalid",
      ),
      heading: optionalText(
        heroRaw.heading,
        current.hero.heading,
        140,
        "appearance_hero_heading_invalid",
      ),
      text: optionalText(
        heroRaw.text,
        current.hero.text,
        600,
        "appearance_hero_text_invalid",
      ),
      buttonLabel: optionalText(
        heroRaw.buttonLabel,
        current.hero.buttonLabel,
        80,
        "appearance_hero_button_invalid",
      ),
      buttonHref: safeHref(heroRaw.buttonHref, current.hero.buttonHref),
    },
    sectionImages: sectionImages(raw.sectionImages, current.sectionImages),
  };

  validateAppearanceContrast(next.tokens);

  // Only new references need ACTIVE assets. Retained archived images are still
  // protected by existing version history and must not block ordinary text edits.
  const newImageUrls = [
    ...(next.hero.imageUrl === current.hero.imageUrl ? [] : [next.hero.imageUrl]),
    ...Object.entries(next.sectionImages)
      .filter(([key, value]) => value !== current.sectionImages[key])
      .map(([, value]) => value),
  ];

  const createdAt = now();
  const resultVersion = expected + 1;
  const draftId = uid("wav");
  const versionNumber = current.effectiveVersionNumber + 1;

  await db.batch([
    db
      .prepare(
        "UPDATE website_appearance SET current_draft_version_id = ?, " +
          "version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND " +
          sharedMediaUrlsAvailableSql,
      )
      .bind(draftId, createdAt, APPEARANCE_ID, expected, JSON.stringify(newImageUrls)),
    db
      .prepare(
        "INSERT INTO website_appearance_versions (" +
          "id, appearance_id, version_number, preset_key, " +
          "background_color, surface_color, text_color, muted_text_color, " +
          "accent_color, button_color, border_color, header_color, " +
          "hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href, " +
          "section_images_json, scheduled_start_at, scheduled_end_at, " +
          "created_by, created_at, published_at, superseded_at" +
          ") SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL " +
          "FROM website_appearance WHERE id = ? AND version = ? AND updated_at = ?",
      )
      .bind(
        draftId,
        APPEARANCE_ID,
        versionNumber,
        next.presetKey,
        next.tokens.background,
        next.tokens.surface,
        next.tokens.text,
        next.tokens.mutedText,
        next.tokens.accent,
        next.tokens.button,
        next.tokens.border,
        next.tokens.header,
        next.hero.imageUrl,
        next.hero.heading,
        next.hero.text,
        next.hero.buttonLabel,
        next.hero.buttonHref,
        JSON.stringify(next.sectionImages),
        current.scheduledStartAt,
        current.scheduledEndAt,
        actorEmail,
        createdAt,
        APPEARANCE_ID,
        resultVersion,
        createdAt,
      ),
    auditStatement(db, {
      eventType: "DRAFT_SAVED",
      actorEmail,
      before: current,
      after: next,
      createdAt,
      resultVersion,
    }),
  ]);

  const verified = await db
    .prepare(
      "SELECT version, current_draft_version_id AS draftVersionId, updated_at AS updatedAt " +
        "FROM website_appearance WHERE id = ? LIMIT 1",
    )
    .bind(APPEARANCE_ID)
    .first<{ version: number; draftVersionId: string | null; updatedAt: string }>();
  if (
    Number(verified?.version) !== resultVersion ||
    verified?.draftVersionId !== draftId ||
    verified?.updatedAt !== createdAt
  ) {
    throw new Error("appearance_version_conflict");
  }
}

export async function publishAdminWebsiteAppearance(
  db: D1DatabaseLike,
  expectedRaw: unknown,
  actorEmail: string,
): Promise<void> {
  const current = await getAdminWebsiteAppearance(db);
  const expected = expectedVersion(expectedRaw);
  if (current.version !== expected) throw new Error("appearance_version_conflict");
  if (!current.draftVersionId) throw new Error("appearance_no_draft");

  const createdAt = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE website_appearance SET current_published_version_id = current_draft_version_id, " +
          "current_draft_version_id = NULL, version = version + 1, updated_at = ? " +
          "WHERE id = ? AND version = ? AND current_draft_version_id = ?",
      )
      .bind(createdAt, APPEARANCE_ID, expected, current.draftVersionId),
  ];

  if (current.publishedVersionId) {
    statements.push(
      db
        .prepare(
          "UPDATE website_appearance_versions SET superseded_at = ? WHERE id = ? " +
            "AND EXISTS (SELECT 1 FROM website_appearance WHERE id = ? AND version = ? AND updated_at = ?)",
        )
        .bind(
          createdAt,
          current.publishedVersionId,
          APPEARANCE_ID,
          resultVersion,
          createdAt,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        "UPDATE website_appearance_versions SET published_at = ?, superseded_at = NULL " +
          "WHERE id = ? AND EXISTS (" +
          "SELECT 1 FROM website_appearance WHERE id = ? AND version = ? AND updated_at = ?)",
      )
      .bind(
        createdAt,
        current.draftVersionId,
        APPEARANCE_ID,
        resultVersion,
        createdAt,
      ),
    auditStatement(db, {
      eventType: "PUBLISHED",
      actorEmail,
      before: current,
      after: { publishedVersionId: current.draftVersionId },
      createdAt,
      resultVersion,
    }),
  );

  await db.batch(statements);
  const verified = await db
    .prepare(
      "SELECT version, current_published_version_id AS publishedVersionId, " +
        "current_draft_version_id AS draftVersionId, updated_at AS updatedAt " +
        "FROM website_appearance WHERE id = ? LIMIT 1",
    )
    .bind(APPEARANCE_ID)
    .first<{
      version: number;
      publishedVersionId: string | null;
      draftVersionId: string | null;
      updatedAt: string;
    }>();
  if (
    Number(verified?.version) !== resultVersion ||
    verified?.publishedVersionId !== current.draftVersionId ||
    verified?.draftVersionId !== null ||
    verified?.updatedAt !== createdAt
  ) {
    throw new Error("appearance_version_conflict");
  }
}

export async function restoreAdminWebsiteAppearance(
  db: D1DatabaseLike,
  targetVersionIdRaw: unknown,
  expectedRaw: unknown,
  actorEmail: string,
): Promise<void> {
  const current = await getAdminWebsiteAppearance(db);
  const expected = expectedVersion(expectedRaw);
  if (current.version !== expected) throw new Error("appearance_version_conflict");

  const targetVersionId = String(targetVersionIdRaw ?? "").trim();
  if (!targetVersionId) throw new Error("appearance_restore_target_required");
  const target = await db
    .prepare(
      "SELECT * FROM website_appearance_versions WHERE id = ? AND appearance_id = ? " +
        "AND published_at IS NOT NULL LIMIT 1",
    )
    .bind(targetVersionId, APPEARANCE_ID)
    .first<Record<string, unknown>>();
  if (!target) throw new Error("appearance_restore_target_not_found");

  const createdAt = now();
  const resultVersion = expected + 1;
  const restoredId = uid("wav");
  const versionNumber = current.effectiveVersionNumber + 1;

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE website_appearance SET current_published_version_id = ?, " +
          "current_draft_version_id = NULL, version = version + 1, updated_at = ? " +
          "WHERE id = ? AND version = ?",
      )
      .bind(restoredId, createdAt, APPEARANCE_ID, expected),
  ];

  // Close the current live version before inserting the restored live clone.
  // The partial unique index permits only one row with published_at set and
  // superseded_at NULL for this appearance.
  if (current.publishedVersionId) {
    statements.push(
      db
        .prepare(
          "UPDATE website_appearance_versions SET superseded_at = ? WHERE id = ? " +
            "AND EXISTS (SELECT 1 FROM website_appearance WHERE id = ? AND version = ? AND updated_at = ?)",
        )
        .bind(
          createdAt,
          current.publishedVersionId,
          APPEARANCE_ID,
          resultVersion,
          createdAt,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        "INSERT INTO website_appearance_versions (" +
          "id, appearance_id, version_number, preset_key, background_color, surface_color, " +
          "text_color, muted_text_color, accent_color, button_color, border_color, header_color, " +
          "hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href, " +
          "section_images_json, scheduled_start_at, scheduled_end_at, created_by, created_at, " +
          "published_at, superseded_at" +
          ") SELECT ?, appearance_id, ?, preset_key, background_color, surface_color, " +
          "text_color, muted_text_color, accent_color, button_color, border_color, header_color, " +
          "hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href, " +
          "section_images_json, scheduled_start_at, scheduled_end_at, ?, ?, ?, NULL " +
          "FROM website_appearance_versions WHERE id = ? AND appearance_id = ? " +
          "AND EXISTS (SELECT 1 FROM website_appearance WHERE id = ? AND version = ? AND updated_at = ?)",
      )
      .bind(
        restoredId,
        versionNumber,
        actorEmail,
        createdAt,
        createdAt,
        targetVersionId,
        APPEARANCE_ID,
        APPEARANCE_ID,
        resultVersion,
        createdAt,
      ),
    auditStatement(db, {
      eventType: "RESTORED",
      actorEmail,
      before: current,
      after: { restoredFromVersionId: targetVersionId, publishedVersionId: restoredId },
      createdAt,
      resultVersion,
    }),
  );

  await db.batch(statements);
  const verified = await db
    .prepare(
      "SELECT version, current_published_version_id AS publishedVersionId, " +
        "current_draft_version_id AS draftVersionId, updated_at AS updatedAt " +
        "FROM website_appearance WHERE id = ? LIMIT 1",
    )
    .bind(APPEARANCE_ID)
    .first<{
      version: number;
      publishedVersionId: string | null;
      draftVersionId: string | null;
      updatedAt: string;
    }>();
  if (
    Number(verified?.version) !== resultVersion ||
    verified?.publishedVersionId !== restoredId ||
    verified?.draftVersionId !== null ||
    verified?.updatedAt !== createdAt
  ) {
    throw new Error("appearance_version_conflict");
  }
}
