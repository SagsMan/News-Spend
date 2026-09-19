"use client";

import {
  NumberField,
  SelectInput,
  useField,
  useFormFields,
  useRowLabel,
} from "@payloadcms/ui";
import type { NumberFieldClientProps } from "payload";
import { useEffect, useState } from "react";

import {
  RELOADLY_NETWORK_OPERATORS,
  RELOADLY_NETWORK_OPTIONS,
  type ReloadlyNetwork,
} from "../../collections/giveaway/constants";
import { describeDenomination } from "../../lib/giveaway/reloadlyDenominations";

/** Shape returned by GET /api/reloadly/operators/:operatorId/products. */
type ReloadlyProduct = {
  denominationType: "RANGE" | "FIXED";
  localFixedAmounts: number[] | null;
  /** Keyed by the amount as a string: { "600": "2.5GB 2-day" }. */
  localFixedAmountsDescriptions?: Record<string, string> | null;
  localMaxAmount: number | null;
  localMinAmount: number | null;
  operatorId: number;
  operatorName: string;
};

/**
 * Airtime is not network-specific the way data is: Reloadly exposes a single
 * Nigerian airtime product and detects the carrier from the phone number.
 */
const AIRTIME_OPERATOR_ID = 317;

export const operatorIdForNetwork = (network?: string): number | undefined =>
  network ? RELOADLY_NETWORK_OPERATORS[network as ReloadlyNetwork] : undefined;

/** Fetches the live product for an operator. Passing `undefined` clears state. */
const useReloadlyProduct = (operatorId: number | undefined) => {
  const [product, setProduct] = useState<ReloadlyProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operatorId) {
      setProduct(null);
      setError(null);
      return;
    }

    // The operator can change while a request is still in flight (switching
    // network on an array row); ignore anything but the latest response.
    let current = true;
    setLoading(true);
    setError(null);

    fetch(`/api/reloadly/operators/${operatorId}/products`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        return body as ReloadlyProduct;
      })
      .then((data) => {
        if (!current) {
          return;
        }
        setProduct(data);
      })
      .catch((err: unknown) => {
        if (!current) {
          return;
        }
        setProduct(null);
        setError(
          err instanceof Error ? err.message : "Could not load products"
        );
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [operatorId]);

  return { product, loading, error };
};

const Note = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) => (
  <div
    className="field-description"
    style={tone === "error" ? { color: "var(--theme-error-500)" } : undefined}
  >
    {children}
  </div>
);

type AmountFieldProps = NumberFieldClientProps & {
  /** Operator whose products drive the choices, or undefined while unknown. */
  operatorId: number | undefined;
  /** Shown in place of the input when there is no operator to query yet. */
  emptyMessage?: string;
};

/**
 * Renders the amount input for a Reloadly prize using Payload's own inputs, so
 * it inherits admin theming, labels and error styling.
 *
 * Reloadly operators are either FIXED (a closed list of denominations) or RANGE
 * (any amount between a min and a max), and which one applies is only known at
 * runtime — hence a select in one case and Payload's stock number field, with
 * the live bounds applied, in the other.
 */
const ReloadlyAmountField = ({
  operatorId,
  emptyMessage,
  ...props
}: AmountFieldProps) => {
  const { field, path, readOnly } = props;
  const { product, loading, error } = useReloadlyProduct(operatorId);
  const { setValue, showError, value } = useField<number | undefined>({ path });

  if (!operatorId) {
    return <Note>{emptyMessage ?? "Nothing to pick from yet."}</Note>;
  }

  if (loading) {
    return <Note>Loading available amounts…</Note>;
  }

  if (error) {
    return <Note tone="error">{error}</Note>;
  }

  if (
    product?.denominationType === "FIXED" &&
    product.localFixedAmounts?.length
  ) {
    return (
      <SelectInput
        description={field.admin?.description}
        label={field.label}
        name={field.name}
        onChange={(option: unknown) => {
          const selected = Array.isArray(option) ? option[0] : option;
          const next = (selected as { value?: string } | null)?.value;
          setValue(next ? Number(next) : undefined);
        }}
        options={product.localFixedAmounts.map((amount) => ({
          label: describeDenomination(
            amount,
            product.localFixedAmountsDescriptions
          ),
          value: String(amount),
        }))}
        path={path}
        readOnly={readOnly}
        required={field.required}
        showError={showError}
        value={
          value === undefined || value === null ? undefined : String(value)
        }
      />
    );
  }

  if (product?.denominationType === "RANGE") {
    // Payload's stock number field, narrowed to the operator's live bounds.
    return (
      <NumberField
        {...props}
        field={{
          ...field,
          max: product.localMaxAmount ?? field.max,
          min: product.localMinAmount ?? field.min,
        }}
      />
    );
  }

  return (
    <Note tone="error">This operator returned no purchasable amounts.</Note>
  );
};

export const AirtimeProductField = (props: NumberFieldClientProps) => (
  <ReloadlyAmountField {...props} operatorId={AIRTIME_OPERATOR_ID} />
);

/**
 * Amount field for one row of `reloadlyDataPlans`. The row's own `network`
 * select is a plain Payload field; this reads it out of form state so the
 * amounts on offer follow whatever network the editor picked.
 */
export const DataPlanField = (props: NumberFieldClientProps) => {
  const { path } = props;

  // e.g. reloadlyDataPlans.0.reloadlyLocalAmount -> reloadlyDataPlans.0.network
  const rowPath = path.includes(".")
    ? path.slice(0, path.lastIndexOf("."))
    : "";
  const siblingPath = (name: string) => (rowPath ? `${rowPath}.${name}` : name);

  const network = useFormFields(([fields]) => {
    const state = fields?.[siblingPath("network")];
    return typeof state?.value === "string" ? state.value : undefined;
  });

  const operatorId = operatorIdForNetwork(network);

  // `reloadlyOperatorId` is required, read-only and derived entirely from the
  // network. The collection's beforeValidate hook fills it in on the way to the
  // database, but that is too late for the admin panel: its own required check
  // runs client-side and would refuse to submit the form at all. So mirror the
  // derivation into form state as soon as the network is picked.
  const { setValue: setOperatorId, value: currentOperatorId } = useField<
    number | undefined
  >({ path: siblingPath("reloadlyOperatorId") });

  useEffect(() => {
    if (operatorId !== currentOperatorId) {
      setOperatorId(operatorId);
    }
  }, [operatorId, currentOperatorId, setOperatorId]);

  return (
    <ReloadlyAmountField
      {...props}
      emptyMessage="Select a network first."
      operatorId={operatorId}
    />
  );
};

/**
 * Collapsed-row label for `reloadlyDataPlans`.
 *
 * The row's own data arrives through context, not props: Payload renders this
 * inside a `RowLabelProvider` and `useRowLabel` is the only way to reach it.
 * Destructuring a `data` prop instead silently yields undefined, which is what
 * made every row read "Unknown — ₦0".
 */
export const ReloadlyDataPlanRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{
    network?: string;
    reloadlyLocalAmount?: number;
  }>();

  const network = RELOADLY_NETWORK_OPTIONS.find(
    (n) => n.value === data?.network
  )?.label;

  // A row is empty the moment it is added, and naming it "Unknown" reads as
  // something broken rather than something not filled in yet. `rowNumber` is
  // zero-based, matching the number Payload shows on the row itself.
  if (!network) {
    return `Plan ${(rowNumber ?? 0) + 1}`;
  }

  const amount = data?.reloadlyLocalAmount;
  return amount ? `${network} — ₦${amount.toLocaleString()}` : network;
};
