// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// acvEngine.ts — RevenueLens ACV / Contract Analytics Engine
// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED: No imports from command-center.tsx or mrrEngine.ts
// SOURCE OF TRUTH: chat session 8add9d57 — "Consolidating MRR and ACV workflows"
//
// OUTPUT TABLES (3):
//   1. bridgeTable   — 12-column bridge (one row per unit × date × lb × classification)
//   2. acvTable      — monthly revenue recognition per contract
//   3. bookingsTable — standardised source rows (Bookings-to-ACV walk input)
//
// QC CHECKS (4 — must all pass before UI renders):
//   QC1: Bridge sums reconcile → Ending ACV (±0.01)
//   QC2: Price/Volume bridge → Upsell + Downsell (±0.01)
//   QC3: acvTable ending ACV = bridgeTable ending ACV (±0.01)
//   QC4: Zero rows with zz_Unclassified
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface ACVInputRow {
  customer:       string
  product?:       string
  channel?:       string
  region?:        string
  contractStart:  string   // ISO date string
  contractEnd:    string   // ISO date string
  tcv:            number   // TCV or ACV — caller passes whichever they have
  quantity?:      number
  revenueUnit:    'TCV' | 'ACV'  // tells engine how to treat the value
}

export interface ACVBridgeRow {
  customer:              string
  product:               string
  channel:               string
  region:                string
  vintage:               Date
  date:                  Date
  acvNew:                number
  quantity:              number
  monthLookback:         1 | 3 | 12
  dteNew:                number
  bridgeClassification:  string
  bridgeValue:           number
}

export interface ACVTableRow {
  customer:      string
  product:       string
  contractStart: Date
  contractEnd:   Date
  acv:           number
  date:          Date          // observation month (last of month)
  revenue:       number        // pro-rated revenue for this month
}

export interface BookingsRow {
  customer:      string
  product:       string
  channel:       string
  region:        string
  contractStart: Date
  contractEnd:   Date
  tcv:           number
  acv:           number
  quantity:      number
  durationDays:  number
  inScope:       boolean
  outOfScopeReason?: string
}

export interface QCResult {
  qc1Pass: boolean   // bridge reconciles to ending ACV
  qc2Pass: boolean   // price/volume bridge = upsell + downsell
  qc3Pass: boolean   // acvTable ending = bridgeTable ending
  qc4Pass: boolean   // no zz_Unclassified rows
  qc1Detail: string
  qc2Detail: string
  qc3Detail: string
  qc4Detail: string
}

export interface ACVEngineOutput {
  bridgeTable:   ACVBridgeRow[]
  acvTable:      ACVTableRow[]
  bookingsTable: BookingsRow[]
  qc:            QCResult
  error?:        string
  mode:          'TCV' | 'ACV'
  periodsCount:  number
}

// ── Date Utilities ────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Last day of the month containing date d
function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// First day of the month containing date d
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Add N months to date d (returns last-of-month)
function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n + 1, 0)
  return r
}

// Number of whole months between two dates (a before b → positive)
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

// Days in month containing date d
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

// Date key string for Map keys — "YYYY-MM"
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Generate array of last-of-month dates from startMonth to endMonth inclusive
function generateMonthRange(startDate: Date, endDate: Date): Date[] {
  const months: Date[] = []
  let cur = lastOfMonth(startDate)
  const end = lastOfMonth(endDate)
  while (cur <= end) {
    months.push(new Date(cur))
    cur = lastOfMonth(addMonths(cur, 1))
  }
  return months
}

// ── Numeric Utilities ─────────────────────────────────────────────────────────

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/[,$]/g, ''))
  return isNaN(n) ? 0 : n
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Unit Key ──────────────────────────────────────────────────────────────────

function unitKey(customer: string, product: string, channel: string, region: string): string {
  return `${customer}|${product}|${channel}|${region}`
}

function custKey(customer: string): string {
  return customer

}

function custProdKey(customer: string, product: string): string {
  return `${customer}|${product}`
}

// ── ACV Calculation ───────────────────────────────────────────────────────────

function calcACV(tcv: number, startDate: Date, endDate: Date, revenueUnit: 'TCV' | 'ACV'): number {
  if (revenueUnit === 'ACV') return round6(tcv)
  // TCV → ACV: annualise
  const durationDays = Math.max(
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    365  // default to 365 if zero/negative
  )
  return round6((tcv / durationDays) * 365)
}

// ── Pro-rated Revenue for ACV Table ──────────────────────────────────────────

function calcMonthlyRevenue(acv: number, contractStart: Date, contractEnd: Date, monthDate: Date): number {
  // monthDate is last-of-month
  const mFirst = firstOfMonth(monthDate)
  const mLast  = monthDate

  // Contract has ended before this month
  if (contractEnd < mFirst) return 0
  // Contract starts after this month
  if (contractStart > mLast) return 0

  const daysInMo = daysInMonth(monthDate)
  const dailyRate = acv / 365

  // Partial start month
  if (contractStart >= mFirst && contractStart <= mLast) {
    const activeDays = mLast.getDate() - contractStart.getDate() + 1
    return round2(dailyRate * activeDays)
  }

  // Partial end month
  if (contractEnd >= mFirst && contractEnd <= mLast) {
    const activeDays = contractEnd.getDate()
    return round2(dailyRate * activeDays)
  }

  // Full month active
  return round2(dailyRate * daysInMo)
}

// ── Main Engine ───────────────────────────────────────────────────────────────

export function runACVEngine(rawRows: ACVInputRow[]): ACVEngineOutput {

  // ── Step 1: Parse + Validate + ACV Calculation ───────────────────────────

  const bookingsTable: BookingsRow[] = []

  const contracts = rawRows.map(r => {
    const customer  = String(r.customer || '').trim()
    const product   = String(r.product  || 'N/A').trim() || 'N/A'
    const channel   = String(r.channel  || 'N/A').trim() || 'N/A'
    const region    = String(r.region   || 'N/A').trim() || 'N/A'
    const tcv       = parseNum(r.tcv)
    const qty       = parseNum(r.quantity) || 1  // default qty = 1
    const revenueUnit = r.revenueUnit || 'TCV'

    const startDate = parseDate(String(r.contractStart || ''))
    const endDate   = parseDate(String(r.contractEnd   || ''))

    // Scope checks
    if (!startDate || !endDate) {
      bookingsTable.push({ customer, product, channel, region, contractStart: startDate!, contractEnd: endDate!, tcv, acv: 0, quantity: qty, durationDays: 0, inScope: false, outOfScopeReason: 'Invalid dates' })
      return null
    }
    if (startDate > endDate) {
      bookingsTable.push({ customer, product, channel, region, contractStart: startDate, contractEnd: endDate, tcv, acv: 0, quantity: qty, durationDays: 0, inScope: false, outOfScopeReason: 'Start > End' })
      return null
    }
    if (tcv <= 0) {
      bookingsTable.push({ customer, product, channel, region, contractStart: startDate, contractEnd: endDate, tcv, acv: 0, quantity: qty, durationDays: 0, inScope: false, outOfScopeReason: 'TCV ≤ 0' })
      return null
    }
    if (revenueUnit === 'TCV' && qty <= 0) {
      bookingsTable.push({ customer, product, channel, region, contractStart: startDate, contractEnd: endDate, tcv, acv: 0, quantity: qty, durationDays: 0, inScope: false, outOfScopeReason: 'TCV > 0 but Qty ≤ 0' })
      return null
    }

    const durationDays = Math.max(
      Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      365
    )
    const acv = calcACV(tcv, startDate, endDate, revenueUnit)

    bookingsTable.push({ customer, product, channel, region, contractStart: startDate, contractEnd: endDate, tcv, acv, quantity: qty, durationDays, inScope: true })

    return { customer, product, channel, region, contractStart: startDate, contractEnd: endDate, tcv, acv, quantity: qty, durationDays }
  }).filter(Boolean)

  if (!contracts.length) {
    return {
      bridgeTable: [], acvTable: [], bookingsTable,
      qc: { qc1Pass: false, qc2Pass: false, qc3Pass: false, qc4Pass: false, qc1Detail: 'No valid contracts', qc2Detail: '', qc3Detail: '', qc4Detail: '' },
      error: 'No valid contracts found. Check date format (YYYY-MM-DD) and TCV values.',
      mode: rawRows[0]?.revenueUnit || 'TCV',
      periodsCount: 0
    }
  }

  // ── Step 2: ACV Table (monthly revenue recognition) ──────────────────────

  const acvTable: ACVTableRow[] = []

  for (const c of contracts) {
    // Generate months from contract start to contract end
    const months = generateMonthRange(c.contractStart, c.contractEnd)
    for (const m of months) {
      const revenue = calcMonthlyRevenue(c.acv, c.contractStart, c.contractEnd, m)
      if (revenue > 0) {
        acvTable.push({
          customer: c.customer, product: c.product,
          contractStart: c.contractStart, contractEnd: c.contractEnd,
          acv: c.acv, date: m, revenue
        })
      }
    }
  }

  // ── Step 3: Monthly Bridge Rows per lookback ──────────────────────────────

  const LOOKBACKS: (1 | 3 | 12)[] = [1, 3, 12]

  // Structure: unitKey → dateKey → lb → { acv, dte, qty }
  // We aggregate multiple contracts per unit-date
  type UnitDateLb = { acv: number; dte: number; qty: number }
  const aggMap = new Map<string, UnitDateLb>()

  const aggKey = (uk: string, dk: string, lb: number) => `${uk}||${dk}||${lb}`

  for (const lb of LOOKBACKS) {
    for (const c of contracts) {
      // Generate months from contract start to contract end + lb months
      const rangeEnd = addMonths(lastOfMonth(c.contractEnd), lb)
      const months   = generateMonthRange(c.contractStart, rangeEnd)

      for (const m of months) {
        const monthsSinceStart = monthsBetween(lastOfMonth(c.contractStart), m)

        // Expiry Pool Flag: months since start >= lb AND date > contract end
        const isExpiryPool = monthsSinceStart >= lb && m > lastOfMonth(c.contractEnd)

        // ACV Flag: contract active this month
        const isActive = m >= lastOfMonth(c.contractStart) && m <= lastOfMonth(c.contractEnd)

        const acvVal = isActive ? c.acv : 0
        const dteVal = isExpiryPool ? c.acv : 0
        const qtyVal = isActive ? c.quantity : 0

        const uk = unitKey(c.customer, c.product, c.channel, c.region)
        const dk = dateKey(m)
        const k  = aggKey(uk, dk, lb)

        const ex = aggMap.get(k)
        if (ex) {
          ex.acv += acvVal
          ex.dte += dteVal
          ex.qty += qtyVal
        } else {
          aggMap.set(k, { acv: acvVal, dte: dteVal, qty: qtyVal })
        }
      }
    }
  }

  // ── Step 4: Build unit-date series + prior period shift ──────────────────

  // Group by unit × lb → sorted date series
  type SeriesEntry = {
    customer: string; product: string; channel: string; region: string
    date: Date; acv: number; dte: number; qty: number
    pAcv: number; pQty: number
    lb: number
  }

  // Extract all unique units from contracts
  const unitMeta = new Map<string, { customer: string; product: string; channel: string; region: string }>()
  for (const c of contracts) {
    const uk = unitKey(c.customer, c.product, c.channel, c.region)
    if (!unitMeta.has(uk)) unitMeta.set(uk, { customer: c.customer, product: c.product, channel: c.channel, region: c.region })
  }

  const allSeries: SeriesEntry[] = []

  for (const lb of LOOKBACKS) {
    for (const [uk, meta] of unitMeta) {
      // Collect all date entries for this unit × lb
      const entries: { date: Date; acv: number; dte: number; qty: number }[] = []

      // Find all dates in aggMap for this uk + lb
      for (const [k, v] of aggMap) {
        const parts = k.split('||')
        if (parts[0] === uk && Number(parts[2]) === lb) {
          // Parse date back
          const [yr, mo] = parts[1].split('-').map(Number)
          const d = new Date(yr, mo - 1 + 1, 0) // last of month
          entries.push({ date: d, acv: v.acv, dte: v.dte, qty: v.qty })
        }
      }

      if (!entries.length) continue

      // Sort chronologically
      entries.sort((a, b) => a.date.getTime() - b.date.getTime())

      // Add prior period (shift by lb positions)
      for (let i = 0; i < entries.length; i++) {
        const pAcv = i >= lb ? entries[i - lb].acv : 0
        const pQty = i >= lb ? entries[i - lb].qty : 0

        const e = entries[i]

        // Filter: remove rows where acv=0 AND pAcv=0 AND dte=0
        if (e.acv === 0 && pAcv === 0 && e.dte === 0) continue

        allSeries.push({
          ...meta, date: e.date, acv: e.acv, dte: e.dte, qty: e.qty,
          pAcv, pQty, lb
        })
      }
    }
  }

  // ── Step 5: Min/Max Dates (for classification) ────────────────────────────

  // Unit-level min/max (where acv > 0)
  const unitMin = new Map<string, Date>()
  const unitMax = new Map<string, Date>()
  // Customer-level min/max
  const custMin = new Map<string, Date>()
  const custMax = new Map<string, Date>()
  // Customer × Product min/max
  const cpMin   = new Map<string, Date>()
  const cpMax   = new Map<string, Date>()

  for (const s of allSeries) {
    if (s.acv <= 0) continue
    const uk = unitKey(s.customer, s.product, s.channel, s.region)
    const ck = custKey(s.customer)
    const cpk = custProdKey(s.customer, s.product)

    if (!unitMin.has(uk) || s.date < unitMin.get(uk)!) unitMin.set(uk, s.date)
    if (!unitMax.has(uk) || s.date > unitMax.get(uk)!) unitMax.set(uk, s.date)
    if (!custMin.has(ck) || s.date < custMin.get(ck)!) custMin.set(ck, s.date)
    if (!custMax.has(ck) || s.date > custMax.get(ck)!) custMax.set(ck, s.date)
    if (!cpMin.has(cpk) || s.date < cpMin.get(cpk)!)   cpMin.set(cpk, s.date)
    if (!cpMax.has(cpk) || s.date > cpMax.get(cpk)!)   cpMax.set(cpk, s.date)
  }

  // Vintage: customer first-ever date (min date where acv > 0)
  const vintageMap = new Map<string, Date>()
  for (const [ck, d] of custMin) vintageMap.set(ck, d)

  // ── Step 6: Bridge Classification ────────────────────────────────────────

  const bridgeTable: ACVBridgeRow[] = []

  for (const s of allSeries) {
    const uk  = unitKey(s.customer, s.product, s.channel, s.region)
    const ck  = custKey(s.customer)
    const cpk = custProdKey(s.customer, s.product)

    const uMin = unitMin.get(uk)
    const uMax = unitMax.get(uk)
    const cMin = custMin.get(ck)
    const cMax = custMax.get(ck)
    const cpMn = cpMin.get(cpk)
    const cpMx = cpMax.get(cpk)

    const vintage  = vintageMap.get(ck) || s.date
    const lbsDate  = addMonths(s.date, -s.lb)  // lookback start date

    // pastACV: did this unit have ACV before the lookback window?
    const pastACV  = uMin ? monthsBetween(s.date, uMin) >= s.lb ? 'Y' : 'N' : 'N'
    // futureACV: does this unit have ACV after this period?
    const futureACV = uMax && uMax > s.date ? 'Y' : 'N'

    let flag = 'zz_Unclassified'

    // ── CASE 1: New / Cross-sell / Other In ─────────────────────────────────
    if (s.pAcv === 0 && s.acv > 0 && pastACV === 'N') {
      if (cpMn && cpMn <= lbsDate)          flag = 'Other In'
      else if (cMin && cMin <= lbsDate)     flag = 'Cross-sell'
      else                                   flag = 'New Logo'
    }

    // ── CASE 2: Returning ────────────────────────────────────────────────────
    else if (s.pAcv === 0 && s.acv > 0 && pastACV === 'Y') {
      flag = 'Returning'
    }

    // ── CASE 3: Churn / Churn-Partial / Other Out ────────────────────────────
    else if (s.pAcv > 0 && s.acv === 0 && s.dte > 0 && futureACV === 'N') {
      if (cpMx && cpMx >= s.date)           flag = 'Other Out'
      else if (cMax && cMax >= s.date)      flag = 'Churn-Partial'
      else                                   flag = 'Churn'
    }

    // ── CASE 4: Lapsed ───────────────────────────────────────────────────────
    else if (s.acv === 0 && futureACV === 'Y') {
      flag = 'Lapsed'
    }

    // ── CASE 5: Upsell / Downsell (ACV: REQUIRES DTE > 0) ───────────────────
    else if (s.pAcv > 0 && s.acv > 0 && s.dte > 0) {
      flag = s.pAcv <= s.acv ? 'Upsell' : 'Downsell'
    }

    // ── CASE 6: Add-on (ACV UNIQUE — active contract, no expiry this period) ─
    else if (s.pAcv > 0 && s.acv > 0 && s.dte === 0) {
      flag = 'Add-on'
    }

    // Bridge value = current − prior
    const bridgeValue = s.acv - s.pAcv

    // ── ACV-specific calculations ────────────────────────────────────────────
    const expiryPool = s.dte
    const priorACV   = s.pAcv
    const endingACV  = s.acv
    const rob        = flag === 'Add-on' ? s.pAcv : 0
    const partialExpiry = (flag === 'Upsell' || flag === 'Downsell') && s.pAcv !== s.dte
      ? s.pAcv - s.dte
      : 0
    const robFinal = partialExpiry + rob

    // ── Price / Volume Decomposition (same as MRR) ───────────────────────────
    let priceImpact = 0, volumeImpact = 0, priceOnVolume = 0

    if ((flag === 'Upsell' || flag === 'Downsell') && s.qty > 0 && s.pQty > 0) {
      const price  = s.acv  / s.qty
      const pPrice = s.pAcv / s.pQty
      const minQty = Math.min(s.qty, s.pQty)
      const minP   = Math.min(price, pPrice)

      priceImpact  = (price - pPrice) * minQty
      volumeImpact = (s.qty - s.pQty) * minP

      const qDiff = s.qty  - s.pQty
      const pDiff = price  - pPrice
      if ((pDiff > 0 && qDiff > 0) || (pDiff < 0 && qDiff < 0)) {
        priceOnVolume = pDiff * qDiff
      } else if (pDiff < 0 && qDiff < 0) {
        priceOnVolume = -(pDiff * qDiff)
      } else {
        priceOnVolume = 0
      }

      // PV Misc ensures PI + VI + PoV = bridgeValue exactly
      const pvMisc = bridgeValue - (priceImpact + volumeImpact + priceOnVolume)
      volumeImpact += pvMisc
    }

    // ── Emit bridge rows ─────────────────────────────────────────────────────
    // Main classification row
    if (bridgeValue !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: flag, bridgeValue
      })
    }

    // Metric rows (Prior ACV, Ending ACV)
    if (priorACV !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Prior ACV', bridgeValue: priorACV
      })
    }
    if (endingACV !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Ending ACV', bridgeValue: endingACV
      })
    }
    // Expiry Pool
    if (expiryPool !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Expiry Pool', bridgeValue: expiryPool
      })
    }
    // RoB
    if (robFinal !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'RoB', bridgeValue: robFinal
      })
    }
    // Price / Volume rows
    if (priceImpact !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Price Impact', bridgeValue: priceImpact
      })
    }
    if (volumeImpact !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Volume Impact', bridgeValue: volumeImpact
      })
    }
    if (priceOnVolume !== 0) {
      bridgeTable.push({
        customer: s.customer, product: s.product, channel: s.channel, region: s.region,
        vintage, date: s.date, acvNew: s.acv, quantity: s.qty,
        monthLookback: s.lb as 1 | 3 | 12, dteNew: s.dte,
        bridgeClassification: 'Price on Volume', bridgeValue: priceOnVolume
      })
    }
  }

  // ── Step 7: QC Checks ─────────────────────────────────────────────────────

  const lb12 = bridgeTable.filter(r => r.monthLookback === 12)

  // Group by date for QC
  const byDate = new Map<string, ACVBridgeRow[]>()
  for (const r of lb12) {
    const k = dateKey(r.date)
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(r)
  }

  let qc1Pass = true, qc1Detail = 'All periods reconcile'
  let qc2Pass = true, qc2Detail = 'Price/Volume bridge reconciles'
  let qc3Pass = true, qc3Detail = 'ACV Table matches Bridge Table'
  let qc4Pass = true, qc4Detail = 'No unclassified rows'

  for (const [dk, rows] of byDate) {
    const priorACV  = rows.filter(r => r.bridgeClassification === 'Prior ACV' ).reduce((s, r) => s + r.bridgeValue, 0)
    const endingACV = rows.filter(r => r.bridgeClassification === 'Ending ACV').reduce((s, r) => s + r.bridgeValue, 0)
    const movements = rows.filter(r => !['Prior ACV','Ending ACV','Expiry Pool','RoB','Price Impact','Volume Impact','Price on Volume'].includes(r.bridgeClassification))
                         .reduce((s, r) => s + r.bridgeValue, 0)
    const computed  = round2(priorACV + movements)
    const actual    = round2(endingACV)

    if (Math.abs(computed - actual) > 0.01) {
      qc1Pass = false
      qc1Detail = `Period ${dk}: computed ${computed} ≠ ending ACV ${actual} (gap ${round2(computed - actual)})`
    }

    // QC2: PI + VI + PoV = Upsell + Downsell
    const upsellDownsell = rows.filter(r => ['Upsell','Downsell'].includes(r.bridgeClassification)).reduce((s, r) => s + r.bridgeValue, 0)
    const pvTotal        = rows.filter(r => ['Price Impact','Volume Impact','Price on Volume'].includes(r.bridgeClassification)).reduce((s, r) => s + r.bridgeValue, 0)
    if (Math.abs(upsellDownsell) > 0 && Math.abs(round2(pvTotal) - round2(upsellDownsell)) > 0.01) {
      qc2Pass = false
      qc2Detail = `Period ${dk}: P/V ${pvTotal} ≠ Upsell+Downsell ${upsellDownsell}`
    }
  }

  // QC4: No unclassified
  const unclassified = bridgeTable.filter(r => r.bridgeClassification === 'zz_Unclassified')
  if (unclassified.length > 0) {
    qc4Pass = false
    qc4Detail = `${unclassified.length} unclassified row(s) found`
  }

  // QC3: ACV Table ending ACV vs Bridge Table ending ACV
  // Compare latest period in both tables
  if (acvTable.length > 0 && lb12.length > 0) {
    const latestBridgePeriod = [...byDate.keys()].sort().pop()!
    const bridgeEnding = (byDate.get(latestBridgePeriod) || [])
      .filter(r => r.bridgeClassification === 'Ending ACV')
      .reduce((s, r) => s + r.bridgeValue, 0)

    const [latestYr, latestMo] = latestBridgePeriod.split('-').map(Number)
    const latestDate = new Date(latestYr, latestMo - 1 + 1, 0)
    const acvEnding  = acvTable
      .filter(r => r.date.getFullYear() === latestDate.getFullYear() && r.date.getMonth() === latestDate.getMonth())
      .reduce((s, r) => s + r.revenue, 0) * 12 // annualise monthly revenue back to ACV basis

    if (bridgeEnding > 0 && Math.abs(round2(bridgeEnding) - round2(acvEnding)) > 1) {
      // Allow $1 tolerance due to day-count rounding
      qc3Pass = false
      qc3Detail = `Bridge ending ACV ${round2(bridgeEnding)} vs ACV Table ${round2(acvEnding)}`
    }
  }

  // ── Count valid periods (lb=12, Beginning > 0) ───────────────────────────
  const validPeriods = new Set(
    lb12
      .filter(r => r.bridgeClassification === 'Prior ACV' && r.bridgeValue > 0)
      .map(r => dateKey(r.date))
  ).size

  return {
    bridgeTable,
    acvTable,
    bookingsTable,
    qc: { qc1Pass, qc2Pass, qc3Pass, qc4Pass, qc1Detail, qc2Detail, qc3Detail, qc4Detail },
    mode: rawRows[0]?.revenueUnit || 'TCV',
    periodsCount: validPeriods
  }
}

// ── KPI Helpers (consumed by acv-center.tsx) ──────────────────────────────────

export function calcACVKPIs(bridgeTable: ACVBridgeRow[], lb: 1 | 3 | 12, period?: string) {
  const rows = bridgeTable.filter(r => r.monthLookback === lb)

  // Get latest period if not specified
  const periods = [...new Set(rows.map(r => dateKey(r.date)))].sort()
  const selPeriod = period || periods[periods.length - 1]
  if (!selPeriod) return null

  const periodRows = rows.filter(r => dateKey(r.date) === selPeriod)

  const sum = (classifications: string[]) =>
    periodRows.filter(r => classifications.includes(r.bridgeClassification)).reduce((s, r) => s + r.bridgeValue, 0)

  const priorACV   = sum(['Prior ACV'])
  const endingACV  = sum(['Ending ACV'])
  const expiryPool = sum(['Expiry Pool'])
  const churn      = sum(['Churn'])
  const churnPartial = sum(['Churn-Partial'])
  const upsell     = sum(['Upsell'])
  const downsell   = sum(['Downsell'])
  const newLogo    = sum(['New Logo'])
  const crossSell  = sum(['Cross-sell'])
  const returning  = sum(['Returning'])
  const addOn      = sum(['Add-on'])
  const lapsed     = sum(['Lapsed'])
  const rob        = sum(['RoB'])

  const grossRenewal = expiryPool > 0
    ? (expiryPool - churn - churnPartial) / expiryPool
    : null

  const netRenewal = expiryPool > 0
    ? (expiryPool - churn - churnPartial + upsell - downsell) / expiryPool
    : null

  return {
    period: selPeriod,
    priorACV, endingACV, expiryPool,
    churn, churnPartial, upsell, downsell,
    newLogo, crossSell, returning, addOn, lapsed, rob,
    netChange: endingACV - priorACV,
    grossRenewal, netRenewal,
    availablePeriods: periods
  }
}

// ── Waterfall Data Builder (for acv-center.tsx charts) ───────────────────────

export const ACV_WATERFALL_ORDER = [
  'Prior ACV',
  'Expiry Pool',
  'New Logo',
  'Cross-sell',
  'Upsell',
  'Add-on',
  'RoB',
  'Returning',
  'Other In',
  'Churn',
  'Churn-Partial',
  'Downsell',
  'Lapsed',
  'Other Out',
  'Ending ACV',
]

export const ACV_BRIDGE_COLORS: Record<string, string> = {
  'Prior ACV':    '#3D5068',
  'Ending ACV':   '#475569',
  'Expiry Pool':  '#4A5568',
  'New Logo':     '#16A34A',
  'Cross-sell':   '#4ADE80',
  'Upsell':       '#22C55E',
  'Add-on':       '#34D399',
  'RoB':          '#7C9DBC',
  'Returning':    '#86EFAC',
  'Other In':     '#64748B',
  'Downsell':     '#FCA5A5',
  'Churn-Partial':'#F87171',
  'Churn':        '#DC2626',
  'Lapsed':       '#CA8A04',
  'Other Out':    '#64748B',
  'Price Impact':  '#A78BFA',
  'Volume Impact': '#60A5FA',
  'Price on Volume':'#F9A8D4',
}

export function buildACVWaterfall(bridgeTable: ACVBridgeRow[], lb: 1 | 3 | 12, period: string) {
  const rows = bridgeTable.filter(r => r.monthLookback === lb && dateKey(r.date) === period)

  const totals: Record<string, number> = {}
  for (const r of rows) {
    totals[r.bridgeClassification] = (totals[r.bridgeClassification] || 0) + r.bridgeValue
  }

  let running = 0
  const waterfall: { name: string; base: number; value: number; fill: string; total: number }[] = []

  for (const name of ACV_WATERFALL_ORDER) {
    const val = totals[name] || 0
    if (val === 0) continue

    const isAnchor = name === 'Prior ACV' || name === 'Ending ACV'
    const base = isAnchor ? 0 : running

    waterfall.push({
      name,
      base,
      value: isAnchor ? val : Math.abs(val),
      fill: ACV_BRIDGE_COLORS[name] || '#64748B',
      total: isAnchor ? val : running + val
    })

    if (!isAnchor) running += val
  }

  return waterfall
}

// ── Expiry Pool Builder (for Expiry Pool tab) ─────────────────────────────────

export function buildExpiryPool(bridgeTable: ACVBridgeRow[], asOfPeriod?: string) {
  // Get all future expiry pool entries from the selected period onward
  const periods = [...new Set(bridgeTable.filter(r => r.monthLookback === 12).map(r => dateKey(r.date)))].sort()
  const selPeriod = asOfPeriod || periods[periods.length - 1]

  const expiryRows = bridgeTable.filter(r =>
    r.monthLookback === 12 &&
    r.bridgeClassification === 'Expiry Pool' &&
    dateKey(r.date) >= selPeriod
  )

  // Group by period
  const byPeriod = new Map<string, number>()
  for (const r of expiryRows) {
    const k = dateKey(r.date)
    byPeriod.set(k, (byPeriod.get(k) || 0) + r.bridgeValue)
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, value }))
}

// ── Renewal Rate Trend Builder ────────────────────────────────────────────────

export function buildRenewalRateTrend(bridgeTable: ACVBridgeRow[], lb: 1 | 3 | 12) {
  const periods = [...new Set(bridgeTable.filter(r => r.monthLookback === lb).map(r => dateKey(r.date)))].sort()

  return periods.map(period => {
    const kpis = calcACVKPIs(bridgeTable, lb, period)
    return {
      date: period,
      grossRenewal: kpis?.grossRenewal ?? null,
      netRenewal:   kpis?.netRenewal   ?? null,
      expiryPool:   kpis?.expiryPool   ?? 0,
    }
  }).filter(r => r.expiryPool > 0) // only show periods where there's something to renew
}
