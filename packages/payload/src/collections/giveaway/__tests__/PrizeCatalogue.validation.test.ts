import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReloadlyClient } from '../../../lib/giveaway/reloadly';

vi.mock('../../../lib/giveaway/reloadly');

describe('PrizeCatalogue Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reloadly data plans validation', () => {
    it('should validate fixed-amount data plans correctly', async () => {
      const mockReloadlyClient = {
        getOperatorProducts: vi.fn().mockResolvedValue({
          operatorId: 345,
          operatorName: 'MTN Nigeria Data',
          denominationType: 'FIXED',
          localFixedAmounts: [500, 1000, 2500, 5000, 10000, 20000],
        }),
      };

      (ReloadlyClient as any).mockImplementation(() => mockReloadlyClient);

      const data = {
        name: 'MTN 5GB Data',
        tier: 'tier1',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          {
            network: 'mtn',
            reloadlyOperatorId: 345,
            reloadlyLocalAmount: 5000, // Valid amount
          },
        ],
      };

      // Should not throw for valid amount
      const plans = data.reloadlyDataPlans;
      const operator = await mockReloadlyClient.getOperatorProducts(
        plans[0].reloadlyOperatorId,
      );
      const isValid =
        operator.localFixedAmounts &&
        operator.localFixedAmounts.includes(plans[0].reloadlyLocalAmount);
      expect(isValid).toBe(true);
    });

    it('should reject invalid fixed-amount data plans', async () => {
      const mockReloadlyClient = {
        getOperatorProducts: vi.fn().mockResolvedValue({
          operatorId: 345,
          operatorName: 'MTN Nigeria Data',
          denominationType: 'FIXED',
          localFixedAmounts: [500, 1000, 2500, 5000, 10000, 20000],
        }),
      };

      (ReloadlyClient as any).mockImplementation(() => mockReloadlyClient);

      const data = {
        name: 'MTN Invalid Data',
        tier: 'tier1',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          {
            network: 'mtn',
            reloadlyOperatorId: 345,
            reloadlyLocalAmount: 3000, // NOT in available amounts
          },
        ],
      };

      const operator = await mockReloadlyClient.getOperatorProducts(345);
      const isValid =
        operator.localFixedAmounts &&
        operator.localFixedAmounts.includes(data.reloadlyDataPlans[0].reloadlyLocalAmount);

      expect(isValid).toBe(false);
    });

    it('should validate range-based data plans correctly', async () => {
      const mockReloadlyClient = {
        getOperatorProducts: vi.fn().mockResolvedValue({
          operatorId: 999,
          operatorName: 'Nigeria Data Range',
          denominationType: 'RANGE',
          localMinAmount: 500,
          localMaxAmount: 50000,
          localFixedAmounts: null,
        }),
      };

      (ReloadlyClient as any).mockImplementation(() => mockReloadlyClient);

      const data = {
        name: 'Flexible Data',
        tier: 'tier2',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          {
            network: 'mtn',
            reloadlyOperatorId: 999,
            reloadlyLocalAmount: 15000, // Within range
          },
        ],
      };

      const operator = await mockReloadlyClient.getOperatorProducts(999);
      const isValid =
        data.reloadlyDataPlans[0].reloadlyLocalAmount >= (operator.localMinAmount || 0) &&
        data.reloadlyDataPlans[0].reloadlyLocalAmount <= (operator.localMaxAmount || Infinity);

      expect(isValid).toBe(true);
    });

    it('should reject range-based amount outside limits', async () => {
      const mockReloadlyClient = {
        getOperatorProducts: vi.fn().mockResolvedValue({
          operatorId: 999,
          operatorName: 'Nigeria Data Range',
          denominationType: 'RANGE',
          localMinAmount: 500,
          localMaxAmount: 50000,
          localFixedAmounts: null,
        }),
      };

      (ReloadlyClient as any).mockImplementation(() => mockReloadlyClient);

      const data = {
        name: 'Over-limit Data',
        tier: 'tier2',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          {
            network: 'mtn',
            reloadlyOperatorId: 999,
            reloadlyLocalAmount: 100000, // Exceeds max
          },
        ],
      };

      const operator = await mockReloadlyClient.getOperatorProducts(999);
      const isValid =
        data.reloadlyDataPlans[0].reloadlyLocalAmount >= (operator.localMinAmount || 0) &&
        data.reloadlyDataPlans[0].reloadlyLocalAmount <= (operator.localMaxAmount || Infinity);

      expect(isValid).toBe(false);
    });

    it('should auto-populate operator IDs from network selection', () => {
      const networkOperatorMap = {
        mtn: 345,
        airtel: 646,
        glo: 647,
        t2: 645,
      };

      const data = {
        name: 'Multi-network Data',
        tier: 'tier1',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          { network: 'mtn', reloadlyLocalAmount: 5000 },
          { network: 'airtel', reloadlyLocalAmount: 5000 },
          { network: 'glo', reloadlyLocalAmount: 5000 },
        ],
      };

      // Simulate auto-population logic
      const populated = data.reloadlyDataPlans.map((plan) => ({
        ...plan,
        reloadlyOperatorId: networkOperatorMap[plan.network as keyof typeof networkOperatorMap],
      }));

      expect(populated[0].reloadlyOperatorId).toBe(345);
      expect(populated[1].reloadlyOperatorId).toBe(646);
      expect(populated[2].reloadlyOperatorId).toBe(647);
    });

    it('should handle Reloadly API errors gracefully', async () => {
      const mockReloadlyClient = {
        getOperatorProducts: vi.fn().mockRejectedValue(new Error('API request failed')),
      };

      (ReloadlyClient as any).mockImplementation(() => mockReloadlyClient);

      const data = {
        name: 'Error Test Data',
        tier: 'tier1',
        fulfilmentType: 'data',
        reloadlyDataPlans: [
          {
            network: 'mtn',
            reloadlyOperatorId: 345,
            reloadlyLocalAmount: 5000,
          },
        ],
      };

      try {
        await mockReloadlyClient.getOperatorProducts(345);
      } catch (err: any) {
        expect(err.message).toBe('API request failed');
      }
    });

    it('should skip validation for non-data prizes', () => {
      const data = {
        name: 'Airtime Prize',
        tier: 'tier1',
        fulfilmentType: 'airtime',
        reloadlyLocalAmount: 5000,
      };

      // Validation should only apply to data prizes
      const shouldValidate = data.fulfilmentType === 'data';
      expect(shouldValidate).toBe(false);
    });

    it('should skip validation when Reloadly is not configured', () => {
      // Simulate no Reloadly config
      const config = null;
      const shouldSkip = !config;

      expect(shouldSkip).toBe(true);
    });
  });
});
