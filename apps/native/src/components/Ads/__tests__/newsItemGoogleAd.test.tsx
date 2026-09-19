import { act, render, screen } from "@testing-library/react-native";

const mockCreateForAdRequest = jest.fn();
const mockDestroy = jest.fn();

/** The item the mocked recycling hook should announce on mount. */
let mockCurrentItem: { id: string } = { id: "ad-0" };

// The component's collaborators, all of which reach for native modules.
jest.mock("react-native-google-mobile-ads", () => ({
  NativeAd: {
    createForAdRequest: (...args: unknown[]) => mockCreateForAdRequest(...args),
  },
  NativeAdChoicesPlacement: { BOTTOM_RIGHT: 1 },
  NativeAdView: ({ children }: { children: React.ReactNode }) => children,
  NativeAsset: ({ children }: { children: React.ReactNode }) => children,
  NativeAssetType: {
    ICON: "icon",
    HEADLINE: "headline",
    BODY: "body",
    STORE: "store",
    CALL_TO_ACTION: "cta",
  },
}));

jest.mock("#/lib/adsInit", () => ({
  initializeAdsWhenPermitted: () => Promise.resolve(),
}));

jest.mock("#/lib/adUnits", () => ({ adUnits: { native: "unit" } }));

// The heroui wrappers pull in the design system's own hooks and context; the
// ad's loading state machine is what is under test, not its typography.
jest.mock("../../heroui/text", () => ({
  Text: require("react-native").Text,
}));
jest.mock("../../heroui/image", () => ({
  Image: require("react-native").Image,
}));

/**
 * `useRecyclingEffect` is the component's only entry point into loading — it
 * fires on mount as well as on a genuine recycle. The real hook needs a
 * LegendList recycling context, so this stands in for the mount case.
 */
jest.mock("@legendapp/list/react-native", () => {
  const { useEffect, useRef } = require("react");
  return {
    useRecyclingEffect: (fn: (args: unknown) => void) => {
      const fired = useRef(false);
      useEffect(() => {
        if (fired.current) {
          return;
        }
        fired.current = true;
        fn({ item: mockCurrentItem, prevItem: null });
      });
    },
  };
});

import NewsItemGoogleAds from "../NewsItemGoogleAd";
import { clearTabAdCache } from "#/utils/ad-cache";

/** Let every pending promise callback run, then drain scheduled timers. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("NewsItemGoogleAds", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCreateForAdRequest.mockReset();
    mockDestroy.mockReset();
    clearTabAdCache("test");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the ad once a request succeeds", async () => {
    mockCreateForAdRequest.mockResolvedValue({
      headline: "Buy this",
      body: "Really do",
      store: "Play",
      callToAction: "Install",
      icon: null,
      destroy: mockDestroy,
    });

    mockCurrentItem = { id: "ad-1" };
    render(<NewsItemGoogleAds index={0} item={mockCurrentItem} tab="test" />);
    await flush();

    expect(screen.getByText("Buy this")).toBeTruthy();
  });

  it("collapses the slot instead of stranding an empty placeholder", async () => {
    // No-fill on every attempt: the common real-world case.
    mockCreateForAdRequest.mockRejectedValue(new Error("no fill"));

    mockCurrentItem = { id: "ad-2" };
    render(<NewsItemGoogleAds index={0} item={mockCurrentItem} tab="test" />);
    await flush();

    // While retries are still pending the placeholder is correct: an ad is
    // still expected here.
    expect(screen.queryByText("Advertisement")).toBeTruthy();

    // Walk through the whole backoff schedule (1s, 3s, 9s).
    for (const delay of [1000, 3000, 9000]) {
      await advance(delay);
      await flush();
    }

    // Out of attempts. The slot must take up no space rather than showing a
    // labelled empty box for the rest of the list's life — the reported bug.
    expect(screen.queryByText("Advertisement")).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it("spaces retries out instead of firing them back to back", async () => {
    mockCreateForAdRequest.mockRejectedValue(new Error("no fill"));

    mockCurrentItem = { id: "ad-3" };
    render(<NewsItemGoogleAds index={0} item={mockCurrentItem} tab="test" />);
    await flush();

    // One attempt on mount, and no more until the backoff has elapsed.
    expect(mockCreateForAdRequest).toHaveBeenCalledTimes(1);

    await advance(999);
    await flush();
    expect(mockCreateForAdRequest).toHaveBeenCalledTimes(1);

    await advance(1);
    await flush();
    expect(mockCreateForAdRequest).toHaveBeenCalledTimes(2);
  });

  it("destroys an ad that arrives after its request was superseded", async () => {
    let resolveAd: ((ad: unknown) => void) | undefined;
    mockCreateForAdRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveAd = resolve;
      })
    );

    const view = (() => {
      mockCurrentItem = { id: "ad-4" };
      return render(
        <NewsItemGoogleAds index={0} item={mockCurrentItem} tab="test" />
      );
    })();
    await flush();

    // The cell goes away with the request still in flight.
    view.unmount();

    await act(async () => {
      resolveAd?.({ headline: "late", destroy: mockDestroy });
      await Promise.resolve();
    });

    // The orphan is released rather than leaked onto the native side.
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
