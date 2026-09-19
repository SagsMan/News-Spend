import { useThemeColor } from "heroui-native/hooks";
import { Spinner } from "heroui-native/spinner";
import type {
  ToastActionProps,
  ToastComponentProps,
  ToastShowOptions,
} from "heroui-native/toast";
import { Toast as HeroUIToast, useToast } from "heroui-native/toast";
import { cn } from "heroui-native/utils";
import type { Icon } from "#/lib/icons";
import {
  BellIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
} from "#/lib/icons";
import { useEffect } from "react";
import { View } from "react-native";
import { useUniwind } from "uniwind";

type ToastManager = ReturnType<typeof useToast>["toast"];

export type ToastVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger";

/** Passed to an action's `onPress` so it can dismiss itself or chain a toast. */
export type ToastHelpers = {
  hide: (ids?: string | string[] | "all") => void;
  show: ToastManager["show"];
};

export type ToastOptions = {
  description?: string;
  /**
   * Milliseconds before the toast auto-hides. `Infinity` keeps it up until
   * something dismisses it, matching what sonner accepted at the call sites.
   */
  duration?: number;
  id?: string;
  /** Trailing button. Its colour follows the variant unless overridden. */
  action?: {
    label: string;
    onPress?: (helpers: ToastHelpers) => void;
    /** Override the button style HeroUI picks from the variant. */
    variant?: ToastActionProps["variant"];
  };
  /** Render a trailing icon-only close button that dismisses this toast. */
  closable?: boolean;
  placement?: "top" | "bottom";
  /** Swipe-to-dismiss. Defaults to HeroUI's `true`. */
  isSwipeable?: boolean;
  /** Replace the variant's default phosphor icon. */
  icon?: Icon;
  /** Extra classes on the toast container. */
  className?: string;
};

const ICONS: Record<ToastVariant, Icon> = {
  default: BellIcon,
  accent: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  danger: XCircleIcon,
};

/**
 * Red used for the danger label in dark mode.
 *
 * HeroUI derives every toast label by mixing the variant colour toward
 * `--black`, which stays pure black in our dark theme. On our dark surface
 * (#18181B) that lands `danger` at 2.44:1, but the base `danger` token only gets
 * to 3.97:1, so neither clears 4.5:1 and this one is lifted by hand. The other
 * three variants pass once they use their base token, which is what
 * `useToastColors` does below.
 */
const DARK_DANGER_LABEL = "#F0736F";

function useToastColors(variant: ToastVariant) {
  const { theme } = useUniwind();
  const [
    foreground,
    muted,
    accent,
    success,
    warning,
    danger,
    accentSoftFg,
    successSoftFg,
    warningSoftFg,
    dangerSoftFg,
  ] = useThemeColor([
    "foreground",
    "muted",
    "accent",
    "success",
    "warning",
    "danger",
    "accent-soft-foreground",
    "success-soft-foreground",
    "warning-soft-foreground",
    "danger-soft-foreground",
  ]);

  const icon = {
    default: muted,
    accent,
    success,
    warning,
    danger,
  }[variant];

  const isDark = theme === "dark";

  const label = {
    default: foreground,
    accent: isDark ? accent : accentSoftFg,
    success: isDark ? success : successSoftFg,
    warning: isDark ? warning : warningSoftFg,
    danger: isDark ? DARK_DANGER_LABEL : dangerSoftFg,
  }[variant];

  return { icon, label };
}

type AppToastProps = ToastComponentProps & {
  variant: ToastVariant;
  label: string;
  options?: ToastOptions & { isLoading?: boolean };
};

/**
 * The body of every toast the app shows.
 *
 * Rendered through HeroUI's custom-component form rather than its config
 * object, so the label colour, the icon set and the loading spinner stay ours.
 */
function AppToast({ variant, label, options, ...toastProps }: AppToastProps) {
  const colors = useToastColors(variant);
  const IconComponent = options?.icon ?? ICONS[variant];
  const { hide, show } = toastProps;
  const action = options?.action;

  return (
    <HeroUIToast
      className={cn("flex-row items-center gap-3", options?.className)}
      isSwipeable={options?.isSwipeable}
      placement={options?.placement}
      variant={variant}
      {...toastProps}
    >
      <View className="size-6 items-center justify-center">
        {options?.isLoading ? (
          <Spinner size="sm" />
        ) : (
          <IconComponent color={colors.icon} size={22} weight="fill" />
        )}
      </View>
      <View className="flex-1">
        <HeroUIToast.Title style={{ color: colors.label }}>
          {label}
        </HeroUIToast.Title>
        {options?.description ? (
          <HeroUIToast.Description>
            {options.description}
          </HeroUIToast.Description>
        ) : null}
      </View>
      {action ? (
        <HeroUIToast.Action
          onPress={() => action.onPress?.({ hide, show })}
          variant={action.variant}
        >
          {action.label}
        </HeroUIToast.Action>
      ) : null}
      {/* Dismisses itself. Toast.Close reads `hide` and `id` off the root context. */}
      {options?.closable ? <HeroUIToast.Close /> : null}
    </HeroUIToast>
  );
}

let manager: ToastManager | null = null;
/** Calls made before the bridge mounts (module init, cold-start auth) replay on mount. */
let pending: Array<(m: ToastManager) => void> = [];

function withManager(run: (m: ToastManager) => void) {
  if (manager) {
    run(manager);
    return;
  }
  pending.push(run);
}

let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `toast-${idCounter}`;
}

function show(
  variant: ToastVariant,
  label: string,
  options?: ToastOptions & { isLoading?: boolean }
) {
  const id = options?.id ?? nextId();
  const duration = options?.duration;

  withManager((m) => {
    // HeroUI's `show()` treats a caller-supplied id that's still active as a
    // no-op: it won't swap in the new content. Callers that reuse an id
    // (e.g. morphing an offline error toast into a "back online" success
    // toast) expect the old one replaced, so clear it first; harmless if
    // nothing with that id exists.
    if (options?.id !== undefined) {
      m.hide(id);
    }
    m.show({
      id,
      // HeroUI wants the string "persistent"; sonner took Infinity, and some
      // call sites still pass it.
      duration:
        duration === undefined
          ? undefined
          : Number.isFinite(duration)
            ? duration
            : "persistent",
      component: (props) => (
        <AppToast
          {...props}
          label={label}
          options={options}
          variant={variant}
        />
      ),
    });
  });

  return id;
}

/**
 * App-wide toast API.
 *
 * Importable from anywhere, including non-React modules like the api error
 * helper and the auth store, which is why it is a singleton over a hook.
 *
 * Callable directly (`toast("Saved")`), matching sonner's shape. Several
 * call sites carried over from the sonner migration rely on that form as an
 * alias for `toast.show`.
 */
export const toast = Object.assign(
  (label: string, options?: ToastOptions) => show("default", label, options),
  {
    show: (label: string, options?: ToastOptions) =>
      show("default", label, options),
    info: (label: string, options?: ToastOptions) =>
      show("accent", label, options),
    success: (label: string, options?: ToastOptions) =>
      show("success", label, options),
    warning: (label: string, options?: ToastOptions) =>
      show("warning", label, options),
    error: (label: string, options?: ToastOptions) =>
      show("danger", label, options),
    loading: (label: string, options?: ToastOptions) =>
      show("default", label, {
        ...options,
        // A loading toast stays up until the work that raised it finishes.
        duration: options?.duration ?? Number.POSITIVE_INFINITY,
        isLoading: true,
      }),
    /**
     * Escape hatch: hand HeroUI a component and own the whole toast.
     *
     * Use when the variants above can't express it, like a progress bar, an
     * avatar, a two-button row. Everything in `heroui-native`'s Toast is
     * yours here: `Toast.Title`, `Toast.Description`, `Toast.Action`,
     * `Toast.Close`, plus `variant`, `placement`, `isSwipeable`, `animation`
     * and `className`.
     */
    custom: (options: ToastShowOptions) => {
      const id = options.id ?? nextId();
      withManager((m) => m.show({ ...options, id }));
      return id;
    },
    /**
     * Dismiss toasts. No argument clears all of them, which is what sonner
     * did. HeroUI's bare `hide()` would only drop the most recent one.
     */
    dismiss: (id?: string | string[]) =>
      withManager((m) => m.hide(id ?? "all")),
  }
);

/**
 * Connects the `toast` singleton to HeroUI's toast manager.
 *
 * Must be rendered inside `HeroUINativeProvider`.
 */
export function ToastBridge() {
  const { toast: heroUIToast } = useToast();

  useEffect(() => {
    manager = heroUIToast;
    if (pending.length) {
      const queued = pending;
      pending = [];
      for (const run of queued) {
        run(heroUIToast);
      }
    }
    return () => {
      manager = null;
    };
  }, [heroUIToast]);

  return null;
}
