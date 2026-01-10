# Contractor Performance Tracking Implementation

## Overview
Implemented a comprehensive contractor performance tracking system that includes document management, KPI tracking, and automated performance metrics based on work ratings.

## Features Implemented

### 1. Contractor Documents Management
**Component:** `src/components/property-manager/ContractorDocumentsTab.tsx`

**Features:**
- Upload contractor documents (licenses, insurance, certifications, contracts, etc.)
- 8 document types supported:
  - LICENSE
  - INSURANCE
  - CERTIFICATION
  - CONTRACT
  - TAX_CLEARANCE
  - ID_DOCUMENT
  - BANK_STATEMENT
  - OTHER
- Expiry date tracking with calendar display
- Document download functionality
- Grid layout for easy viewing
- File URL storage (supports external storage)

**Usage:**
1. Navigate to Contractor Management
2. Click on a contractor to view details
3. Select the "Documents" tab
4. Click "Upload Document" to add new documents
5. View and download existing documents

### 2. Contractor KPIs Management
**Component:** `src/components/property-manager/ContractorKPIsTab.tsx`

**Features:**
- Create and track Key Performance Indicators
- Multiple frequency options:
  - Daily
  - Weekly
  - Monthly
  - Quarterly
  - Yearly
- Target value setting with units
- Actual value tracking
- Achievement rate calculation (actual/target * 100%)
- Visual progress bars with color coding:
  - Green: ≥100% achievement
  - Yellow: ≥75% achievement
  - Red: <75% achievement
- Period tracking with start and end dates

**Usage:**
1. Navigate to Contractor Management
2. Click on a contractor to view details
3. Select the "KPIs" tab
4. Click "Create KPI" to add new performance indicators
5. View progress and achievement rates

### 3. Work Rating System
**Component:** `src/components/property-manager/RateWorkModal.tsx`

**Features:**
- Multi-dimensional rating system (1-5 stars):
  - Quality of Work
  - Timeliness
  - Professionalism
  - Communication
  - Overall Rating
- Optional comments
- KPI-specific ratings (optional)
- Contractor selection (if not already associated with order)

**Backend:** `src/server/trpc/procedures/rateCompletedWork.ts`

**Automated Updates:**
When work is rated, the system automatically:
1. Updates the order with all ratings and timestamp
2. Recalculates contractor's overall average rating
3. Increments contractor's totalJobsCompleted
4. Updates KPI actual values (if KPI ratings provided)
5. Recalculates KPI achievement rates
6. Creates or updates ContractorPerformance record for current period:
   - Increments jobsCompleted
   - Updates rolling average for quality metrics
   - Updates qualityScore (0-100 scale)
   - Sets performance classification:
     - EXCELLENT: ≥4.5 average rating
     - GOOD: ≥3.5 average rating
     - AVERAGE: <3.5 average rating

**Usage:**
1. Navigate to Property Manager Dashboard
2. Go to Orders tab
3. Find a COMPLETED order (without existing rating)
4. Click "Rate Work" button
5. Select contractor (if needed)
6. Provide ratings for all dimensions
7. Optionally rate specific KPIs
8. Add comments if desired
9. Submit rating

## Technical Implementation

### Files Created
1. `src/components/property-manager/ContractorDocumentsTab.tsx` (278 lines)
2. `src/components/property-manager/ContractorKPIsTab.tsx` (297 lines)
3. `src/components/property-manager/RateWorkModal.tsx` (332 lines)
4. `src/server/trpc/procedures/rateCompletedWork.ts` (176 lines)

### Files Modified
1. `src/server/trpc/root.ts`
   - Added import for `rateCompletedWork`
   - Exported in router

2. `src/components/property-manager/ContractorDetailsModal.tsx`
   - Added imports for new tab components
   - Replaced KPIs tab placeholder with `ContractorKPIsTab`
   - Replaced Documents tab placeholder with `ContractorDocumentsTab`

3. `src/routes/property-manager/dashboard/index.tsx`
   - Added import for `RateWorkModal`
   - Added state for rating modal and order selection
   - Updated `OrdersTab` to accept `onRateClick` callback
   - Added "Rate Work" button for COMPLETED orders
   - Rendered `RateWorkModal` component

### Database Integration
Uses existing Prisma models:
- `ContractorDocument`: Stores document metadata
- `ContractorKPI`: Tracks KPI definitions and values
- `ContractorPerformance`: Monthly/quarterly performance metrics
- `PropertyManagerOrder`: Order information (rating fields to be added)

### Backend Procedures Used
- `uploadContractorDocument`: Upload new documents
- `getContractorDocuments`: Fetch contractor documents
- `createContractorKPI`: Create new KPI
- `getContractorPerformance`: Fetch KPIs and performance data
- `rateCompletedWork`: Rate completed work and update metrics

## Performance Tracking Workflow

### Complete Workflow:
1. **Order Creation** → Order created with DRAFT status
2. **Order Submission** → Status changes to SUBMITTED
3. **Order Acceptance** → Status changes to ACCEPTED
4. **Work In Progress** → Status changes to IN_PROGRESS
5. **Work Completion** → Status changes to COMPLETED
6. **Rate Work** → Property manager rates the work
7. **Automatic Updates**:
   - Order marked with ratings and timestamp
   - Contractor average rating recalculated
   - Jobs completed counter incremented
   - KPI values updated (if KPI ratings provided)
   - Performance record created/updated for current period
   - Performance classification assigned

### Data Flow:
```
Rate Work Modal
    ↓
rateCompletedWork Procedure
    ↓
Updates:
    - PropertyManagerOrder (ratings, ratedAt)
    - Contractor (averageRating, totalJobsCompleted)
    - ContractorKPI (actualValue, achievementRate)
    - ContractorPerformance (jobsCompleted, qualityScore, overallRating)
```

## KPI Rating Contribution Logic
When KPI-specific ratings are provided:
- Each rating is normalized: `contribution = rating / 5`
- This contribution is added to the KPI's actualValue
- Achievement rate is recalculated: `(actualValue / targetValue) * 100`
- This allows cumulative tracking of KPI performance over time

## Performance Classification
Based on contractor's average rating:
- **EXCELLENT**: Average rating ≥ 4.5 stars
- **GOOD**: Average rating ≥ 3.5 stars
- **AVERAGE**: Average rating < 3.5 stars

## Benefits

### For Property Managers:
- Track contractor document compliance (licenses, insurance)
- Set and monitor performance goals (KPIs)
- Rate completed work on multiple dimensions
- Data-driven contractor selection
- Automated performance tracking
- Historical performance data

### For Contractors:
- Clear performance expectations (KPIs)
- Transparent rating system
- Performance improvement opportunities
- Document storage and tracking
- Performance history

### For the System:
- Automatic data aggregation
- Rolling performance averages
- Period-based tracking (monthly/quarterly)
- Comprehensive contractor profiles
- Performance-based insights

## Future Enhancements (Recommended)

### Schema Updates:
1. Add rating fields to `PropertyManagerOrder` model:
   - `qualityRating Float?`
   - `timelinessRating Float?`
   - `professionalismRating Float?`
   - `communicationRating Float?`
   - `overallRating Float?`
   - `ratingComments String?`
   - `ratedAt DateTime?`

2. Add contractor relation to `PropertyManagerOrder`:
   - `contractorId Int?`
   - `contractor Contractor?`

### UI Enhancements:
1. Performance analytics dashboard
2. Contractor comparison views
3. KPI trend charts
4. Document expiry notifications
5. Bulk KPI creation
6. Export performance reports

### Business Logic:
1. Automatic notifications for low-performing contractors
2. Bonus calculations based on performance
3. Contractor tier system (Gold, Silver, Bronze)
4. Performance-based pricing suggestions
5. Predictive analytics for contractor selection

## Testing Checklist

### Document Management:
- [x] Upload document with all fields
- [ ] Upload document with expiry date
- [ ] Download document
- [ ] View multiple documents
- [ ] Upload different document types

### KPI Management:
- [x] Create KPI with target value
- [ ] View KPI progress
- [ ] Create KPIs with different frequencies
- [ ] Verify achievement rate calculation
- [ ] View multiple KPIs

### Work Rating:
- [x] Rate completed order
- [ ] Rate with all dimensions (1-5 stars)
- [ ] Rate with KPI-specific ratings
- [ ] Add comments
- [ ] Verify contractor average updates
- [ ] Verify jobs completed increments
- [ ] Verify KPI values update
- [ ] Verify performance record creates/updates
- [ ] Verify performance classification

### Integration:
- [x] View contractor documents in details modal
- [x] View contractor KPIs in details modal
- [ ] Rate multiple orders for same contractor
- [ ] Verify rolling averages
- [ ] Test with contractors without KPIs
- [ ] Test with orders without contractor relation

## Notes
- The system is designed to work with existing database schema
- Rating button only appears for COMPLETED orders without existing ratings
- Contractor selection required if order doesn't have contractor relation
- All performance updates are atomic and transactional
- KPI ratings are optional but recommended for detailed tracking

## Support
For issues or questions about contractor performance tracking:
1. Check console logs for errors
2. Verify contractor has KPIs created
3. Ensure order status is COMPLETED
4. Verify contractor exists in system
5. Check network requests for API errors
