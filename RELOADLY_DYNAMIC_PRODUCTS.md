# Reloadly Dynamic Product Loading Feature

## Overview
Admins can now dynamically fetch and select available data/airtime products from Reloadly when creating prizes in the Payload CMS. This eliminates manual lookups and prevents invalid amounts from being saved.

## Changes Made

### Backend
1. **ReloadlyClient Enhancement** (`packages/payload/src/lib/giveaway/reloadly.ts`)
   - Added `getOperatorProducts(operatorId)` method
   - Fetches available denominations for any operator

2. **API Endpoint** (`apps/cms/src/app/api/reloadly/operators/[operatorId]/products/route.ts`)
   - GET endpoint to fetch available products
   - Returns operator details including `localFixedAmounts` or range

3. **Validation Hooks** (`packages/payload/src/collections/giveaway/PrizeCatalogue.ts`)
   - `beforeValidate` hook validates amounts against actual Reloadly products
   - Auto-populates operator IDs based on network selection
   - Shows helpful error messages for invalid amounts

### Frontend
4. **Custom Admin Component** (`packages/payload/src/components/ReloadlyProductSelector.tsx`)
   - `ReloadlyProductSelector` - Main component
   - `AirtimeProductField` - Payload field wrapper for airtime
   - `DataPlanField` - Payload field wrapper for data
   - `ReloadlyDataPlanRowLabel` - Row labels showing network + amount

### Tests
5. **Unit Tests**
   - `packages/payload/src/endpoints/__tests__/reloadly.test.ts`
   - `packages/payload/src/collections/giveaway/__tests__/PrizeCatalogue.validation.test.ts`
   - `packages/payload/src/components/__tests__/ReloadlyProductSelector.test.tsx`

6. **Integration Tests**
   - `packages/payload/src/__tests__/reloadly-dynamic-loading.integration.test.ts`

## User Flow

### Data Prize Creation
```
1. Select "Data" fulfillment type
   ↓
2. Data Plans section appears
   ↓
3. Select Network (MTN, Airtel, Glo, 9mobile)
   ↓
4. Component fetches available plans via /api/reloadly/operators/{id}/products
   ↓
5. Dropdown shows available amounts: ₦500, ₦1000, ₦2500, ₦5000, etc.
   ↓
6. User selects amount (e.g., ₦5000)
   ↓
7. Operator ID auto-filled (345 for MTN)
   ↓
8. Save → Validates with Reloadly → Success ✓
```

### Airtime Prize Creation
```
1. Select "Airtime" fulfillment type
   ↓
2. Component fetches available amounts on mount
   ↓
3. Dropdown shows: ₦500, ₦1000, ₦2000, ₦5000, etc.
   ↓
4. User selects amount
   ↓
5. Save → Validates with Reloadly → Success ✓
```

## API Reference

### Get Available Products
```bash
GET /api/reloadly/operators/{operatorId}/products
```

**Response (Fixed Amounts):**
```json
{
  "operatorId": 345,
  "operatorName": "MTN Nigeria Data",
  "denominationType": "FIXED",
  "supportsLocalAmounts": true,
  "localMinAmount": null,
  "localMaxAmount": null,
  "localFixedAmounts": [500, 1000, 2500, 5000, 10000, 20000]
}
```

**Response (Range):**
```json
{
  "operatorId": 317,
  "operatorName": "Nigeria Airtime",
  "denominationType": "RANGE",
  "supportsLocalAmounts": true,
  "localMinAmount": 100,
  "localMaxAmount": 100000,
  "localFixedAmounts": null
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid operator ID
- `503` - Reloadly not configured

## Operator Mappings

| Network | Operator ID | Type |
|---------|------------|------|
| MTN Nigeria | 345 | Data |
| Airtel Nigeria | 646 | Data |
| Glo Nigeria | 647 | Data |
| 9mobile / T2 | 645 | Data |
| Nigeria Airtime | 317 | Airtime (Generic) |

## Validation

### Fixed Denominations
- Amount must be in `localFixedAmounts` list
- Error if not available: "Amount ₦3000 is not available. Available: 500, 1000, 2500, 5000, 10000, 20000"

### Range-Based
- Amount must be between `localMinAmount` and `localMaxAmount`
- Error if outside range: "Amount ₦100,000 is outside valid range (₦100 - ₦50,000)"

## Implementation Details

### Component Features
- ✅ Lazy loading of operator products on demand
- ✅ Caching of operator data during session
- ✅ Auto-population of operator IDs
- ✅ Formatted display with currency (₦)
- ✅ Error handling with retry logic
- ✅ Support for both fixed and range-based amounts
- ✅ Responsive and accessible UI

### Validation Features
- ✅ Real-time validation against Reloadly
- ✅ Detailed error messages
- ✅ Sandbox/live environment support
- ✅ Handles network errors gracefully
- ✅ Auto-populate from network selection
- ✅ Prevents invalid amounts from being saved

## Environment Variables

Required (already configured):
```
RELOADLY_ENV=sandbox|live
RELOADLY_CLIENT_ID=...
RELOADLY_CLIENT_SECRET=...
```

## Testing

Run all tests:
```bash
npm run test
```

Run specific test suite:
```bash
npm run test reloadly
npm run test PrizeCatalogue
npm run test ReloadlyProductSelector
```

## Future Enhancements

1. Add operator search/autocomplete
2. Cache operator products in Redis
3. Bulk validate all existing prizes
4. Operator comparison tool (show rates across networks)
5. Historical amount tracking
6. Admin notifications for product changes

## Troubleshooting

### "Reloadly is not configured"
- Check `.env` has `RELOADLY_CLIENT_ID` and `RELOADLY_CLIENT_SECRET`
- Verify environment matches (sandbox vs live)

### Amount not showing in dropdown
- Verify operator ID is correct
- Check operator supports the denomination type
- Confirm Reloadly API is reachable

### Validation failing on save
- Reloadly products may have changed since UI loaded
- Click network dropdown again to refresh available amounts
- Check error message for specific issue

## Related Documentation
- [Giveaway System Spec](./GIVEAWAY_SPEC.md)
- [Reloadly Integration](./packages/payload/src/lib/giveaway/reloadly.ts)
- [Prize Catalogue Collection](./packages/payload/src/collections/giveaway/PrizeCatalogue.ts)
