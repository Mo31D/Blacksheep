export const REVISION_STATES = [
  "DRAFT",
  "SENT",
  "SUPERSEDED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export type RevisionState = (typeof REVISION_STATES)[number];

export const REVISION_ITEM_STATUSES = [
  "CONFIRMED",
  "REDUCED",
  "UNAVAILABLE",
  "SUBSTITUTE",
  "ADDED",
] as const;

export type RevisionItemStatus = (typeof REVISION_ITEM_STATUSES)[number];

export interface RevisionItemAmounts {
  unitPriceMinor: number;
  requestedQuantity: number;
  confirmedQuantity: number;
  availabilityStatus: RevisionItemStatus;
}

export interface RevisionTotalsInput {
  items: RevisionItemAmounts[];
  deliveryAmountMinor: number | null;
  adjustmentAmountMinor?: number;
}

function integerBetween(value: number, minimum: number, maximum: number, code: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(code);
  }
}

export function validateRevisionItem(item: RevisionItemAmounts): void {
  integerBetween(item.unitPriceMinor, 0, 10_000_000, "revision_invalid_unit_price");
  integerBetween(item.requestedQuantity, 0, 99, "revision_invalid_requested_quantity");
  integerBetween(item.confirmedQuantity, 0, 99, "revision_invalid_confirmed_quantity");

  if (!REVISION_ITEM_STATUSES.includes(item.availabilityStatus)) {
    throw new Error("revision_invalid_availability_status");
  }

  switch (item.availabilityStatus) {
    case "UNAVAILABLE":
      if (item.confirmedQuantity !== 0) {
        throw new Error("revision_unavailable_requires_zero_confirmed");
      }
      break;
    case "REDUCED":
      if (
        item.requestedQuantity < 1 ||
        item.confirmedQuantity >= item.requestedQuantity
      ) {
        throw new Error("revision_reduced_requires_lower_quantity");
      }
      break;
    case "ADDED":
      if (item.requestedQuantity !== 0 || item.confirmedQuantity < 1) {
        throw new Error("revision_added_requires_confirmed_quantity");
      }
      break;
    case "CONFIRMED":
      if (
        item.requestedQuantity < 1 ||
        item.confirmedQuantity !== item.requestedQuantity
      ) {
        throw new Error("revision_confirmed_must_match_requested");
      }
      break;
    case "SUBSTITUTE":
      if (item.confirmedQuantity < 1) {
        throw new Error("revision_substitute_requires_quantity");
      }
      break;
  }
}

export function calculateRevisionTotals(input: RevisionTotalsInput): {
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  adjustmentAmountMinor: number;
  finalTotalMinor: number | null;
} {
  for (const item of input.items) validateRevisionItem(item);

  if (
    input.deliveryAmountMinor !== null &&
    (!Number.isInteger(input.deliveryAmountMinor) || input.deliveryAmountMinor < 0)
  ) {
    throw new Error("revision_invalid_delivery_amount");
  }

  const adjustmentAmountMinor = input.adjustmentAmountMinor ?? 0;
  if (!Number.isInteger(adjustmentAmountMinor)) {
    throw new Error("revision_invalid_adjustment_amount");
  }

  const itemsSubtotalMinor = input.items.reduce(
    (sum, item) => sum + item.unitPriceMinor * item.confirmedQuantity,
    0,
  );

  const finalTotalMinor =
    input.deliveryAmountMinor === null
      ? null
      : itemsSubtotalMinor + input.deliveryAmountMinor + adjustmentAmountMinor;

  if (finalTotalMinor !== null && finalTotalMinor < 0) {
    throw new Error("revision_negative_final_total");
  }

  return {
    itemsSubtotalMinor,
    deliveryAmountMinor: input.deliveryAmountMinor,
    adjustmentAmountMinor,
    finalTotalMinor,
  };
}
