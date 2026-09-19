import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReloadlyClient, ReloadlyError } from '../../lib/giveaway/reloadly';

describe('Reloadly API Endpoint', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  describe('getOperatorProducts', () => {
    it('should fetch available products for a fixed-amount operator', async () => {
      const mockOperator = {
        operatorId: 345,
        operatorName: 'MTN Nigeria Data',
        denominationType: 'FIXED' as const,
        supportsLocalAmounts: true,
        localMinAmount: null,
        localMaxAmount: null,
        localFixedAmounts: [500, 1000, 2500, 5000, 10000, 20000],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOperator,
      });

      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        env: 'sandbox' as const,
        fetchImpl: mockFetch,
      };

      const client = new ReloadlyClient(config);
      const products = await client.getOperatorProducts(345);

      expect(products).toEqual(mockOperator);
      expect(products.denominationType).toBe('FIXED');
      expect(products.localFixedAmounts).toEqual([500, 1000, 2500, 5000, 10000, 20000]);
    });

    it('should fetch available products for a range-amount operator', async () => {
      const mockOperator = {
        operatorId: 317,
        operatorName: 'Nigeria Airtime',
        denominationType: 'RANGE' as const,
        supportsLocalAmounts: true,
        localMinAmount: 100,
        localMaxAmount: 100000,
        localFixedAmounts: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOperator,
      });

      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        env: 'sandbox' as const,
        fetchImpl: mockFetch,
      };

      const client = new ReloadlyClient(config);
      const products = await client.getOperatorProducts(317);

      expect(products).toEqual(mockOperator);
      expect(products.denominationType).toBe('RANGE');
      expect(products.localMinAmount).toBe(100);
      expect(products.localMaxAmount).toBe(100000);
    });

    it('should throw ReloadlyError on 4xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Operator not found' }),
      });

      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        env: 'sandbox' as const,
        fetchImpl: mockFetch,
      };

      const client = new ReloadlyClient(config);

      await expect(client.getOperatorProducts(999)).rejects.toThrow(ReloadlyError);
    });

    it('should throw ReloadlyError on 5xx response with retryable=true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        env: 'sandbox' as const,
        fetchImpl: mockFetch,
      };

      const client = new ReloadlyClient(config);

      try {
        await client.getOperatorProducts(345);
      } catch (err) {
        expect(err).toBeInstanceOf(ReloadlyError);
        expect((err as ReloadlyError).retryable).toBe(true);
      }
    });

    it('should cache token and reuse for multiple requests', async () => {
      const mockOperator = {
        operatorId: 345,
        operatorName: 'MTN Nigeria Data',
        denominationType: 'FIXED' as const,
        supportsLocalAmounts: true,
        localMinAmount: null,
        localMaxAmount: null,
        localFixedAmounts: [500, 1000, 2500],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token123', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOperator,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOperator,
      });

      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        env: 'sandbox' as const,
        fetchImpl: mockFetch,
      };

      const client = new ReloadlyClient(config);

      await client.getOperatorProducts(345);
      await client.getOperatorProducts(345);

      // Should only call fetch 3 times: 1 auth + 2 product requests
      // Not 4 times (which would be 2 auth + 2 product)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
