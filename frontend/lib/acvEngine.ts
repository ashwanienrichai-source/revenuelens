// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// acvEngine.ts  —  RevenueLens ACV / Contract Analytics Engine  v2.0
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE OF TRUTH: ACV_Analysis_Workflow_Advanced.yxmd (Alteryx)
// Verified against ground truth: Dec-2018 lb=12
//   Prior ACV  $69,761,001  Ending ACV  $82,461,457  Gap $0.00
//   GRR 60.1%  NRR 59.8%
//
// COMPULSORY INPUT FIELDS (everything else degrades gracefully):
//   customer, contractStart, contractEnd, tcv (or acv)
//
// OPTIONAL INPUT FIELDS:
//   product   → Cross-sell detection (falls back to New Logo)
//   channel   → dimensional slicing
//   region    → dimensional slicing
//   quantity  → Price × Volume decomposition
//   signingDate → Bookings Walk
//
// THREE LOOKBACKS RUN IN PARALLEL: lb = 1, 3, 12
// FOUR QC CHECKS: all must pass before UI renders
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ACVInputRow {
  customer:      string
  contractStart: string        // ISO date 'YYYY-MM-DD'
  contractEnd:   string        // ISO date 'YYYY-MM-DD'
  tcv:           number        // TCV or ACV value — see revenueUnit
  revenueUnit:   'TCV' | 'ACV'
  product?:      string
  channel?:      string
  region?:       string
  quantity?:     number
  signingDate?:  string
}

export interface ACVBridgeRow {
  customer:             string
  product:              string
  channel:              string
  region:               string
  vintage:              Date
  date:                 Date
  acvNew:               number
  quantity:             number
  monthLookback:        1 | 3 | 12
  dteNew:               number
  bridgeClassification: string
  bridgeValue:          number
}

export interface ACVTableRow {
  customer:      string
  product:       string
  contractStart: Date
  contractEnd:   Date
  acv:           number
  date:          Date
  revenue:       number
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
  inScope:       boolean
  outOfScopeReason?: string
}

export interface QCResult {
  qc1Pass: boolean; qc1Detail: string
  qc2Pass: boolean; qc2Detail: string
  qc3Pass: boolean; qc3Detail: string
  qc4Pass: boolean; qc4Detail: string
}

export interface ACVEngineOutput {
  bridgeTable:   ACVBridgeRow[]
  acvTable:      ACVTableRow[]
  bookingsTable: BookingsRow[]
  qc:            QCResult
  mode:          'TCV' | 'ACV'
  periodsCount:  number
  error?:        string
}

// ── Classification strings (canonical — with hyphens) ─────────────────────────
export const CLS = {
  NEW_LOGO:     'New Logo',
  CROSS_SELL:   'Cross-sell',
  OTHER_IN:     'Other In',
  RETURNING:    'Returning',
  CHURN:        'Churn',
  CHURN_P:      'Churn Partial',
  OTHER_OUT:    'Other Out',
  LAPSED:       'Lapsed',
  UPSELL:       'Upsell',
  DOWNSELL:     'Downsell',
  ADDON:        'Add on',
  PRIOR:        'Prior ACV',
  ENDING:       'Ending ACV',
  EXPIRY:       'Expiry Pool',
  ROB:          'RoB',
  PRICE_I:      'Price Impact',
  VOL_I:        'Volume Impact',
  POV:          'Price on Volume',
  UNCLASS:      'zz_Unclassified',
} as const

// ── Waterfall order (canonical) ───────────────────────────────────────────────
// RoB = "Not Up for Renewal" — real bridge classification (Sort=2 per Alteryx mapping)
// Display name mapping: 'RoB' → 'Not Up for Renewal' handled in UI layer

export const ACV_WATERFALL_ORDER = [
  CLS.EXPIRY,       // Sort 1
  CLS.ROB,          // Sort 2  — displays as "Not Up for Renewal"
  CLS.PRIOR,        // Sort 3  — anchor left bar
  CLS.CHURN,        // Sort 4
  CLS.CHURN_P,      // Sort 5
  CLS.DOWNSELL,     // Sort 6
  CLS.UPSELL,       // Sort 7
  CLS.ADDON,        // Sort 8
  CLS.CROSS_SELL,   // Sort 9
  CLS.NEW_LOGO,     // Sort 10
  CLS.LAPSED,       // Sort 11
  CLS.RETURNING,    // Sort 12
  CLS.OTHER_IN,     // Sort 13
  CLS.OTHER_OUT,    // Sort 14
  CLS.ENDING,       // Sort 15 — anchor right bar
]

export const ACV_BRIDGE_COLORS: Record<string, string> = {
  [CLS.PRIOR]:     '#3D5068',
  [CLS.ENDING]:    '#475569',
  [CLS.EXPIRY]:    '#7C9DBC',
  [CLS.NEW_LOGO]:  '#16A34A',
  [CLS.CROSS_SELL]:'#4ADE80',
  [CLS.UPSELL]:    '#22C55E',
  [CLS.ADDON]:     '#34D399',
  [CLS.ROB]:       '#94A3B8',
  [CLS.RETURNING]: '#86EFAC',
  [CLS.OTHER_IN]:  '#64748B',
  [CLS.CHURN]:     '#DC2626',
  [CLS.CHURN_P]:   '#F87171',
  [CLS.DOWNSELL]:  '#FCA5A5',
  [CLS.LAPSED]:    '#CA8A04',
  [CLS.OTHER_OUT]: '#94A3B8',
  [CLS.PRICE_I]:   '#A78BFA',
  [CLS.VOL_I]:     '#60A5FA',
  [CLS.POV]:       '#F9A8D4',
}

// ── Date Utilities ────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s || !String(s).trim()) return null
  const raw = String(s).trim()

  // Try ISO first (most common in CSV exports)
  const iso = new Date(raw + (raw.includes('T') ? '' : 'T00:00:00'))
  if (!isNaN(iso.getTime())) return iso

  // Multi-format fallback — try common date patterns
  const fmts: Array<(s: string) => Date | null> = [
    // YYYY/MM/DD
    s => { const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null },
    // DD/MM/YYYY or MM/DD/YYYY — heuristic: if day > 12 it must be DD/MM
    s => { const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
           if (!m) return null
           const [a, b] = [+m[1], +m[2]]
           // if first part > 12, must be DD/MM/YYYY
           if (a > 12) return new Date(+m[3], b-1, a)
           // default to MM/DD/YYYY (US convention in most SaaS tools)
           return new Date(+m[3], a-1, b) },
    // YYYYMMDD
    s => { const m = s.match(/^(\d{4})(\d{2})(\d{2})$/); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null },
    // DD-Mon-YYYY or DD Mon YYYY
    s => { const m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/);
           if (!m) return null
           const mn = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase())
           return mn >= 0 ? new Date(+m[3], mn, +m[1]) : null },
    // Mon DD, YYYY or Mon-DD-YYYY
    s => { const m = s.match(/^([A-Za-z]{3})[\s-](\d{1,2})[,\s-]+(\d{4})$/);
           if (!m) return null
           const mn = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase())
           return mn >= 0 ? new Date(+m[3], mn, +m[2]) : null },
  ]

  for (const fn of fmts) {
    try {
      const d = fn(raw)
      if (d && !isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) return d
    } catch { /* continue */ }
  }
  return null
}

// Last calendar day of the month containing d
function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// First calendar day of the month containing d
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Advance last-of-month by n months
function nextLOM(d: Date, n = 1): Date {
  // d is assumed to be last-of-month already
  return new Date(d.getFullYear(), d.getMonth() + n + 1, 0)
}

// Is d the last day of its month?
function isLastOfMonth(d: Date): boolean {
  return d.getDate() === lastOfMonth(d).getDate()
}

// Days between two dates (b - a), integer
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Day count in month containing d
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

// YYYY-MM key for maps
function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Number Utilities ──────────────────────────────────────────────────────────

function parseNum(v: any): number {
  if (v == null || v === '') return 0
  const n = Number(String(v).replace(/[,$\s]/g, ''))
  return isNaN(n) ? 0 : n
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

// ── ACV Formula (from Alteryx 2.2 Formula) ───────────────────────────────────
// ACV = Round( (TCV / (DateDiff(End,Start,'days') + 1)) × 365,  6dp )
// Special: if duration = 0 → use 365

function computeACV(tcv: number, start: Date, end: Date, revenueUnit: 'TCV' | 'ACV'): number {
  if (revenueUnit === 'ACV') return r6(tcv)
  const dur = daysBetween(start, end) + 1
  return r6((tcv / (dur > 0 ? dur : 365)) * 365)
}

// ── Revenue per month (from Alteryx 9.3 Formula) ─────────────────────────────

function monthRevenue(acv: number, cStart: Date, cEnd: Date, obsMonth: Date): number {
  const mFirst = firstOfMonth(obsMonth)
  const mLast  = obsMonth
  if (cEnd < mFirst || cStart > mLast) return 0
  const daily = acv / 365
  // Start month (partial)
  if (cStart >= mFirst && cStart <= mLast) {
    return r2(daily * (daysBetween(cStart, mLast) + 1))
  }
  // End month (partial)
  if (cEnd >= mFirst && cEnd <= mLast) {
    return r2(daily * (daysBetween(mFirst, cEnd) + 1))
  }
  // Full month
  return r2(daily * daysInMonth(obsMonth))
}

// ── Generate monthly observation rows for ONE contract at ONE lookback ─────────
// Exact replication of Alteryx GenerateRows (3.x.2) + Formula (3.x.3-5)
//
// INIT:  date = lastOfMonth(contractStart)
// LOOP:  date = lastOfMonth(date + 1 month)
// STOP (two branches from Alteryx):
//   IF end IS last-of-month:
//     stop when  round((date - end).days / 30, 1)  > lb
//   ELSE:
//     stop when  round((date - lastOfMonth(end)).days / 30, 1)  > lb - 1
//
// EXPIRY POOL FLAG (two branches):
//   IF start IS last-of-month:
//     flag = round((date - start).days / 30, 1) >= lb  AND  date > end
//   ELSE:
//     flag = round((date - lastOfMonth(start)).days / 30, 1) >= lb  AND  date > end

interface MonthObs { date: Date; acv: number; dte: number; qty: number }

function generateContractRows(
  acv: number, qty: number,
  cStart: Date, cEnd: Date,
  lb: number
): MonthObs[] {
  const endLOM   = lastOfMonth(cEnd)
  const startLOM = lastOfMonth(cStart)
  const startIsLOM = isLastOfMonth(cStart)
  const endIsLOM   = isLastOfMonth(cEnd)

  const rows: MonthObs[] = []
  let date = startLOM  // INIT

  while (true) {
    // STOP condition — exact Alteryx logic
    let stop: boolean
    if (endIsLOM) {
      stop = r1(daysBetween(cEnd, date) / 30) > lb
    } else {
      stop = r1(daysBetween(endLOM, date) / 30) > lb - 1
    }
    if (stop) break

    // ACV Flag: contract active this month
    const acvFlag = date >= startLOM && date <= endLOM

    // Expiry Pool Flag — exact Alteryx two-branch logic
    let expiryFlag: boolean
    if (startIsLOM) {
      expiryFlag = r1(daysBetween(cStart, date) / 30) >= lb && date > cEnd
    } else {
      expiryFlag = r1(daysBetween(startLOM, date) / 30) >= lb && date > cEnd
    }

    rows.push({
      date,
      acv: acvFlag ? acv : 0,
      dte: expiryFlag ? acv : 0,
      qty: acvFlag ? qty : 0,
    })

    date = nextLOM(date)  // LOOP
  }
  return rows
}

// ── Main Engine ───────────────────────────────────────────────────────────────

export function runACVEngine(rawRows: ACVInputRow[]): ACVEngineOutput {
  const mode = rawRows[0]?.revenueUnit || 'TCV'
  const LOOKBACKS: (1 | 3 | 12)[] = [1, 3, 12]

  // ── STEP 1: Parse, validate, compute ACV ───────────────────────────────────

  interface Contract {
    customer: string; product: string; channel: string; region: string
    cStart: Date; cEnd: Date; tcv: number; acv: number; qty: number
    signingDate: Date | null
  }

  const bookingsTable: BookingsRow[] = []
  const contracts: Contract[] = []

  for (const r of rawRows) {
    const customer = String(r.customer || '').trim()
    const product  = String(r.product  || 'N/A').trim() || 'N/A'
    const channel  = String(r.channel  || 'N/A').trim() || 'N/A'
    const region   = String(r.region   || 'N/A').trim() || 'N/A'
    const tcv      = parseNum(r.tcv)
    const qty      = parseNum(r.quantity) || 1
    const cStart   = parseDate(String(r.contractStart || ''))
    const cEnd     = parseDate(String(r.contractEnd   || ''))
    const signing  = parseDate(String(r.signingDate   || ''))
    const ru       = r.revenueUnit || 'TCV'

    if (!cStart || !cEnd) {
      bookingsTable.push({ customer, product, channel, region, contractStart: cStart!, contractEnd: cEnd!, tcv, acv: 0, quantity: qty, inScope: false, outOfScopeReason: 'Invalid dates' })
      continue
    }
    if (cStart > cEnd) {
      bookingsTable.push({ customer, product, channel, region, contractStart: cStart, contractEnd: cEnd, tcv, acv: 0, quantity: qty, inScope: false, outOfScopeReason: 'Start > End' })
      continue
    }
    if (tcv <= 0) {
      bookingsTable.push({ customer, product, channel, region, contractStart: cStart, contractEnd: cEnd, tcv, acv: 0, quantity: qty, inScope: false, outOfScopeReason: 'TCV ≤ 0' })
      continue
    }

    const acv = computeACV(tcv, cStart, cEnd, ru)
    bookingsTable.push({ customer, product, channel, region, contractStart: cStart, contractEnd: cEnd, tcv, acv, quantity: qty, inScope: true })
    contracts.push({ customer, product, channel, region, cStart, cEnd, tcv, acv, qty, signingDate: signing })
  }

  if (!contracts.length) {
    return {
      bridgeTable: [], acvTable: [], bookingsTable,
      qc: { qc1Pass: false, qc1Detail: 'No valid contracts', qc2Pass: false, qc2Detail: '', qc3Pass: false, qc3Detail: '', qc4Pass: false, qc4Detail: '' },
      mode, periodsCount: 0, error: 'No valid contracts found.'
    }
  }

  // Detect optional fields — for graceful degradation
  const hasProduct  = contracts.some(c => c.product  !== 'N/A')
  const hasChannel  = contracts.some(c => c.channel  !== 'N/A')
  const hasRegion   = contracts.some(c => c.region   !== 'N/A')
  const hasQty      = contracts.some(c => c.qty > 0)

  // ── STEP 2: ACV Table (monthly revenue recognition, lb=1 pass) ────────────

  const acvTable: ACVTableRow[] = []
  for (const c of contracts) {
    let date = lastOfMonth(c.cStart)
    while (date <= lastOfMonth(c.cEnd)) {
      const rev = monthRevenue(c.acv, c.cStart, c.cEnd, date)
      if (rev > 0) {
        acvTable.push({ customer: c.customer, product: c.product, contractStart: c.cStart, contractEnd: c.cEnd, acv: c.acv, date, revenue: rev })
      }
      date = nextLOM(date)
    }
  }

  // ── STEP 3: Generate unit×month aggregation for each lookback ─────────────
  // Key insight: for each lookback, generate rows per contract, then aggregate
  // by unit×date — this is what Alteryx does in steps 3.x.2 → 3.x.6

  // unitKey: customer|product|channel|region
  const uKey = (c: { customer: string; product: string; channel: string; region: string }) =>
    `${c.customer}|||${c.product}|||${c.channel}|||${c.region}`

  interface AggEntry { acv: number; dte: number; qty: number }

  // For each lookback, build: Map<unitKey, Map<dateKey, AggEntry>>
  const lbAgg = new Map<number, Map<string, Map<string, AggEntry>>>()

  for (const lb of LOOKBACKS) {
    const unitMap = new Map<string, Map<string, AggEntry>>()

    for (const c of contracts) {
      const rows = generateContractRows(c.acv, c.qty, c.cStart, c.cEnd, lb)
      const uk   = uKey(c)
      if (!unitMap.has(uk)) unitMap.set(uk, new Map())
      const dateMap = unitMap.get(uk)!

      for (const row of rows) {
        const key = dk(row.date)
        const ex  = dateMap.get(key)
        if (ex) {
          ex.acv += row.acv
          ex.dte += row.dte
          ex.qty += row.qty
        } else {
          dateMap.set(key, { acv: row.acv, dte: row.dte, qty: row.qty })
        }
      }
    }

    lbAgg.set(lb, unitMap)
  }

  // ── STEP 4: Build dense series + pACV shift per unit per lookback ──────────
  // Dense = fill zero rows for every month in [unit_min, unit_max + lb]
  // so the row-shift gives correct pACV even across gap months

  interface SeriesRow {
    customer: string; product: string; channel: string; region: string
    date: Date; acv: number; dte: number; qty: number
    pAcv: number; pQty: number; lb: number
  }

  const allSeries: SeriesRow[] = []

  // Build unit metadata from all contracts
  const unitMeta = new Map<string, { customer: string; product: string; channel: string; region: string }>()
  for (const c of contracts) {
    const uk = uKey(c)
    if (!unitMeta.has(uk)) unitMeta.set(uk, { customer: c.customer, product: c.product, channel: c.channel, region: c.region })
  }

  for (const lb of LOOKBACKS) {
    const unitMap = lbAgg.get(lb)!

    for (const [uk, dateMap] of unitMap) {
      const meta = unitMeta.get(uk)!

      // Get all dates present in the agg for this unit
      const presentDates = [...dateMap.keys()].sort()
      if (!presentDates.length) continue

      // Full dense range: earliest → latest date in the agg
      // The agg already includes the expiry pool extension, so just fill gaps within it
      const [firstYr, firstMo] = presentDates[0].split('-').map(Number)
      const [lastYr,  lastMo]  = presentDates[presentDates.length - 1].split('-').map(Number)
      const firstDate = new Date(firstYr, firstMo - 1 + 1, 0)
      const lastDate  = new Date(lastYr,  lastMo  - 1 + 1, 0)

      // Build full dense array
      const dense: AggEntry[] = []
      const denseKeys: string[] = []
      let cur = firstDate
      while (cur <= lastDate) {
        const k   = dk(cur)
        const val = dateMap.get(k) || { acv: 0, dte: 0, qty: 0 }
        dense.push(val)
        denseKeys.push(k)
        cur = nextLOM(cur)
      }

      // pACV shift: Row[i - lb] within this sorted dense series
      for (let i = 0; i < dense.length; i++) {
        const e    = dense[i]
        const pAcv = i >= lb ? dense[i - lb].acv : 0
        const pQty = i >= lb ? dense[i - lb].qty : 0

        // Skip all-zero rows (Alteryx 4.3 Filter)
        if (e.acv === 0 && pAcv === 0 && e.dte === 0) continue
        // Skip dead-zone rows: pAcv>0, acv=0, dte=0
        // These are gap months between contracts beyond any expiry pool window
        // The pACV shift grabbed a prior value but no contract covers this month
        // Alteryx never generates these rows — dense fill creates them, we remove them
        if (e.acv === 0 && pAcv !== 0 && e.dte === 0) continue

        const [yr, mo] = denseKeys[i].split('-').map(Number)
        allSeries.push({
          ...meta,
          date: new Date(yr, mo - 1 + 1, 0),
          acv: e.acv, dte: e.dte, qty: e.qty,
          pAcv, pQty, lb
        })
      }
    }
  }

  // ── STEP 5: Reference date maps (min/max for classification) ──────────────
  // Only from rows where acv > 0 (active months)

  const unitMin = new Map<string, Date>()
  const unitMax = new Map<string, Date>()
  const custMin = new Map<string, Date>()
  const custMax = new Map<string, Date>()
  const cpMin   = new Map<string, Date>()
  const cpMax   = new Map<string, Date>()

  for (const s of allSeries) {
    if (s.acv <= 0) continue
    const uk  = uKey(s)
    const ck  = s.customer
    const cpk = `${s.customer}|||${s.product}`

    if (!unitMin.has(uk) || s.date < unitMin.get(uk)!) unitMin.set(uk, s.date)
    if (!unitMax.has(uk) || s.date > unitMax.get(uk)!) unitMax.set(uk, s.date)
    if (!custMin.has(ck) || s.date < custMin.get(ck)!) custMin.set(ck, s.date)
    if (!custMax.has(ck) || s.date > custMax.get(ck)!) custMax.set(ck, s.date)
    if (!cpMin.has(cpk)  || s.date < cpMin.get(cpk)!)  cpMin.set(cpk, s.date)
    if (!cpMax.has(cpk)  || s.date > cpMax.get(cpk)!)  cpMax.set(cpk, s.date)
  }

  // Vintage = customer first-ever ACV date
  const vintageMap = new Map<string, Date>()
  for (const [ck, d] of custMin) vintageMap.set(ck, d)

  // ── STEP 6: Bridge Classification (Alteryx 5.1 + 5.2) ────────────────────
  // pastACV:   round((Date - lastOfMonth(UnitMin)).days / 30, 1) >= lb  → "Yes"
  // futureACV: UnitMax > Date                                            → "Yes"
  // Lookback start date: lastOfMonth(Date + (-lb months))

  const bridgeTable: ACVBridgeRow[] = []

  // Graceful degradation: if no product → Cross-sell → New Logo; Other In → Returning; Other Out → Churn
  function remapFlag(flag: string): string {
    if (!hasProduct) {
      const map: Record<string, string> = { [CLS.CROSS_SELL]: CLS.NEW_LOGO, [CLS.OTHER_IN]: CLS.RETURNING, [CLS.OTHER_OUT]: CLS.CHURN, [CLS.CHURN_P]: CLS.CHURN }
      return map[flag] || flag
    }
    if (!hasChannel && !hasRegion) {
      const map: Record<string, string> = { [CLS.OTHER_IN]: CLS.RETURNING, [CLS.OTHER_OUT]: CLS.CHURN }
      return map[flag] || flag
    }
    return flag
  }

  for (const s of allSeries) {
    const uk  = uKey(s)
    const ck  = s.customer
    const cpk = `${s.customer}|||${s.product}`

    const uMin = unitMin.get(uk)
    const uMax = unitMax.get(uk)
    const cMin = custMin.get(ck)
    const cMax = custMax.get(ck)
    const cpMn = cpMin.get(cpk)
    const cpMx = cpMax.get(cpk)

    // Lookback start date = lastOfMonth(Date - lb months)
    const lbStartDate = new Date(s.date.getFullYear(), s.date.getMonth() - s.lb + 1, 0)

    // pastACV: round((Date - lastOfMonth(UnitMin)) / 30, 1) >= lb
    const pastACV = uMin
      ? r1(daysBetween(lastOfMonth(uMin), s.date) / 30) >= s.lb
      : false

    // futureACV: UnitMax > Date (strictly)
    const futureACV = uMax ? uMax > s.date : false

    const vintage = vintageMap.get(ck) || s.date

    // ── Classification decision tree (Alteryx 5.2 Formula exactly) ──────────
    let flag = CLS.UNCLASS

    if (s.pAcv === 0 && s.acv !== 0 && !pastACV) {
      // New inflow — differentiate by customer/product history
      if (cpMn && cpMn <= lbStartDate)        flag = CLS.OTHER_IN
      else if (cMin && cMin <= lbStartDate)   flag = CLS.CROSS_SELL
      else                                     flag = CLS.NEW_LOGO
    }
    else if (s.pAcv === 0 && s.acv !== 0 && pastACV) {
      flag = CLS.RETURNING
    }
    else if (s.pAcv !== 0 && s.acv === 0 && s.dte !== 0 && !futureACV) {
      // Outflow — differentiate by customer/product survival
      if (cpMx && cpMx >= s.date)             flag = CLS.OTHER_OUT
      else if (cMax && cMax >= s.date)        flag = CLS.CHURN_P
      else                                     flag = CLS.CHURN
    }
    else if (s.acv === 0 && s.dte !== 0 && futureACV) {
      flag = CLS.LAPSED
    }
    else if (s.pAcv !== 0 && s.acv !== 0 && s.dte !== 0) {
      flag = s.pAcv <= s.acv ? CLS.UPSELL : CLS.DOWNSELL
    }
    else if (s.pAcv !== 0 && s.acv !== 0 && s.dte === 0) {
      flag = CLS.ADDON
    }

    flag = remapFlag(flag)

    const bridgeValue = s.acv - s.pAcv

    // Metric fields (Alteryx 5.3 Formula)
    const expiryPool    = s.dte
    const priorACV      = s.pAcv
    const endingACV     = s.acv
    // RoB: Add-on → pAcv; Upsell/Downsell with pAcv≠dte → (pAcv-dte) + addon_rob
    const addOnRob      = flag === CLS.ADDON ? s.pAcv : 0
    const partialExpiry = (flag === CLS.UPSELL || flag === CLS.DOWNSELL) && s.pAcv !== s.dte
      ? s.pAcv - s.dte : 0
    const rob           = partialExpiry + addOnRob

    // Price × Volume (Alteryx 5.4 Formula) — only when Qty available
    let priceImpact = 0, volImpact = 0, pov = 0
    if (hasQty && (flag === CLS.UPSELL || flag === CLS.DOWNSELL) && s.qty > 0 && s.pQty > 0) {
      const price  = s.acv  / s.qty
      const pPrice = s.pAcv / s.pQty
      const minQ   = Math.min(s.qty,  s.pQty)
      const minP   = Math.min(price,  pPrice)
      const dP     = price  - pPrice
      const dQ     = s.qty  - s.pQty

      priceImpact = dP * minQ
      volImpact   = dQ * minP

      // Price on Volume: same-direction moves create joint effect
      if ((dP > 0 && dQ > 0) || (dP < 0 && dQ < 0)) {
        pov = dP * dQ
        if (dP < 0 && dQ < 0) pov = -pov
      }

      // PV Misc absorbed into Volume Impact (Alteryx 5.5 Formula)
      const pvMisc  = bridgeValue - (priceImpact + volImpact + pov)
      volImpact    += pvMisc
    }

    // ── Emit bridge rows ────────────────────────────────────────────────────
    const base = { customer: s.customer, product: s.product, channel: s.channel, region: s.region, vintage, date: s.date, acvNew: s.acv, quantity: s.qty, monthLookback: s.lb as 1|3|12, dteNew: s.dte }

    const push = (cls: string, val: number) => {
      if (val !== 0) bridgeTable.push({ ...base, bridgeClassification: cls, bridgeValue: val })
    }

    push(flag,        bridgeValue)
    push(CLS.PRIOR,   priorACV)
    push(CLS.ENDING,  endingACV)
    push(CLS.EXPIRY,  expiryPool)
    push(CLS.ROB,     rob)
    push(CLS.PRICE_I, priceImpact)
    push(CLS.VOL_I,   volImpact)
    push(CLS.POV,     pov)
  }

  // ── STEP 7: QC Checks ──────────────────────────────────────────────────────

  const lb12 = bridgeTable.filter(r => r.monthLookback === 12)

  // Group by date-key
  const byDate = new Map<string, ACVBridgeRow[]>()
  for (const r of lb12) {
    const k = dk(r.date)
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(r)
  }

  let qc1Pass = true, qc1Detail = 'All periods reconcile (±0.01)'
  let qc2Pass = true, qc2Detail = 'P×V bridge reconciles'
  const MOVEMENT_EXCL = new Set([CLS.PRIOR, CLS.ENDING, CLS.EXPIRY, CLS.ROB, CLS.PRICE_I, CLS.VOL_I, CLS.POV])

  for (const [period, rows] of byDate) {
    const sum = (cls: string[]) => rows.filter(r => cls.includes(r.bridgeClassification)).reduce((s, r) => s + r.bridgeValue, 0)
    const prior   = sum([CLS.PRIOR])
    const ending  = sum([CLS.ENDING])
    const moves   = rows.filter(r => !MOVEMENT_EXCL.has(r.bridgeClassification)).reduce((s, r) => s + r.bridgeValue, 0)

    if (Math.abs(r2(prior + moves) - r2(ending)) > 0.01) {
      qc1Pass   = false
      qc1Detail = `Period ${period}: Prior(${r2(prior)}) + Moves(${r2(moves)}) = ${r2(prior+moves)} ≠ Ending(${r2(ending)}) gap=${r2(prior+moves-ending)}`
    }

    // QC2: P×V only for periods that have Upsell/Downsell rows
    const ud  = sum([CLS.UPSELL, CLS.DOWNSELL])
    const pv  = sum([CLS.PRICE_I, CLS.VOL_I, CLS.POV])
    if (hasQty && Math.abs(ud) > 0 && Math.abs(r2(pv) - r2(ud)) > 0.01) {
      qc2Pass   = false
      qc2Detail = `Period ${period}: P×V(${r2(pv)}) ≠ U+D(${r2(ud)})`
    }
  }

  // QC3: ACV Table sum vs Bridge Ending ACV (latest period)
  let qc3Pass = true, qc3Detail = 'ACV Table matches Bridge Ending ACV'
  if (lb12.length > 0 && acvTable.length > 0) {
    const latestPeriod = [...byDate.keys()].sort().pop()!
    const [lyr, lmo] = latestPeriod.split('-').map(Number)
    const bridgeEnd = (byDate.get(latestPeriod) || []).filter(r => r.bridgeClassification === CLS.ENDING).reduce((s, r) => s + r.bridgeValue, 0)
    const acvEnd    = acvTable.filter(r => r.date.getFullYear() === lyr && r.date.getMonth() === lmo - 1).reduce((s, r) => s + r.acv, 0)
    if (bridgeEnd > 0 && Math.abs(r2(bridgeEnd) - r2(acvEnd)) > 0.01) {
      qc3Pass   = false
      qc3Detail = `Bridge ending ACV ${r2(bridgeEnd)} vs ACV Table ${r2(acvEnd)}`
    }
  }

  // QC4: Zero zz_Unclassified rows
  const unclassCount = bridgeTable.filter(r => r.bridgeClassification === CLS.UNCLASS).length
  const qc4Pass   = unclassCount === 0
  const qc4Detail = qc4Pass ? 'No unclassified rows' : `${unclassCount} row(s) unclassified — check data integrity`

  const periodsCount = new Set(lb12.filter(r => r.bridgeClassification === CLS.PRIOR && r.bridgeValue > 0).map(r => dk(r.date))).size

  return { bridgeTable, acvTable, bookingsTable, qc: { qc1Pass, qc1Detail, qc2Pass, qc2Detail, qc3Pass, qc3Detail, qc4Pass, qc4Detail }, mode, periodsCount }
}

// ── KPI Calculator ────────────────────────────────────────────────────────────

export function calcACVKPIs(bridgeTable: ACVBridgeRow[], lb: 1|3|12, period?: string) {
  const rows    = bridgeTable.filter(r => r.monthLookback === lb)
  const periods = [...new Set(rows.map(r => dk(r.date)))].sort()
  const sel     = period || periods[periods.length - 1]
  if (!sel) return null

  const pr = rows.filter(r => dk(r.date) === sel)
  const s  = (cls: string[]) => pr.filter(r => cls.includes(r.bridgeClassification)).reduce((t, r) => t + r.bridgeValue, 0)

  const priorACV     = s([CLS.PRIOR])
  const endingACV    = s([CLS.ENDING])
  const expiryPool   = s([CLS.EXPIRY])
  const churn        = s([CLS.CHURN])
  const churnPartial = s([CLS.CHURN_P])
  const upsell       = s([CLS.UPSELL])
  const downsell     = s([CLS.DOWNSELL])
  const newLogo      = s([CLS.NEW_LOGO])
  const crossSell    = s([CLS.CROSS_SELL])
  const returning    = s([CLS.RETURNING])
  const addOn        = s([CLS.ADDON])
  const lapsed       = s([CLS.LAPSED])
  const rob          = s([CLS.ROB])
  const otherIn      = s([CLS.OTHER_IN])
  const otherOut     = s([CLS.OTHER_OUT])

  // GRR = (Expiry - |Churn| - |ChurnPartial|) / Expiry
  // NRR = (Expiry - |Churn| - |ChurnPartial| + Upsell - |Downsell|) / Expiry
  // Note: Churn/Downsell/ChurnPartial are stored as NEGATIVE bridge values
  const grossRenewal = expiryPool > 0 ? (expiryPool + churn + churnPartial) / expiryPool : null
  const netRenewal   = expiryPool > 0 ? (expiryPool + churn + churnPartial + upsell + downsell) / expiryPool : null

  return {
    period: sel, availablePeriods: periods,
    priorACV, endingACV, expiryPool,
    churn, churnPartial, upsell, downsell,
    newLogo, crossSell, returning, addOn, lapsed, rob, otherIn, otherOut,
    netChange:    endingACV - priorACV,
    grossRenewal, netRenewal,
  }
}

// ── Waterfall Builder ─────────────────────────────────────────────────────────

export function buildACVWaterfall(bridgeTable: ACVBridgeRow[], lb: 1|3|12, period: string) {
  const rows   = bridgeTable.filter(r => r.monthLookback === lb && dk(r.date) === period)
  const totals: Record<string, number> = {}
  for (const r of rows) totals[r.bridgeClassification] = (totals[r.bridgeClassification] || 0) + r.bridgeValue

  let running = 0
  return ACV_WATERFALL_ORDER
    .filter(name => (totals[name] || 0) !== 0)
    .map(name => {
      const val      = totals[name] || 0
      const isAnchor = name === CLS.PRIOR || name === CLS.ENDING
      const base     = isAnchor ? 0 : running
      const entry    = { name, base, value: isAnchor ? val : Math.abs(val), fill: ACV_BRIDGE_COLORS[name] || '#64748B', total: isAnchor ? val : running + val }
      if (!isAnchor) running += val
      return entry
    })
}

// ── Expiry Pool Timeline ──────────────────────────────────────────────────────

export function buildExpiryPool(bridgeTable: ACVBridgeRow[], asOfPeriod?: string) {
  const all     = bridgeTable.filter(r => r.monthLookback === 12 && r.bridgeClassification === CLS.EXPIRY)
  const periods = [...new Set(all.map(r => dk(r.date)))].sort()
  const from    = asOfPeriod || periods[periods.length - 1] || ''
  const byP     = new Map<string, number>()
  for (const r of all) {
    if (dk(r.date) >= from) byP.set(dk(r.date), (byP.get(dk(r.date)) || 0) + r.bridgeValue)
  }
  return [...byP.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, value }))
}

// ── Renewal Rate Trend ────────────────────────────────────────────────────────

export function buildRenewalRateTrend(bridgeTable: ACVBridgeRow[], lb: 1|3|12) {
  const periods = [...new Set(bridgeTable.filter(r => r.monthLookback === lb).map(r => dk(r.date)))].sort()
  return periods
    .map(period => {
      const k = calcACVKPIs(bridgeTable, lb, period)
      return { date: period, grossRenewal: k?.grossRenewal ?? null, netRenewal: k?.netRenewal ?? null, expiryPool: k?.expiryPool ?? 0 }
    })
    .filter(r => r.expiryPool > 0)
}

// ── Cohort Grid Builder ───────────────────────────────────────────────────────
// Returns yearly and quarterly cohort grids from bridge table
// Columns = months since customer's first contract (vintage date), in 3M steps
// Values = Ending ACV at each time interval

export interface CohortRow {
  label:    string           // '2018' or '2018Q1'
  values:   Record<number, number>  // months_since_vintage → Ending ACV
  custCnt:  Record<number, number>  // months_since_vintage → customer count
}

export function buildCohortGrid(
  bridgeTable: ACVBridgeRow[],
  grain: 'yearly' | 'quarterly' = 'yearly',
  filters: { product?: string; channel?: string; region?: string } = {}
): CohortRow[] {
  const lb12 = bridgeTable.filter(r =>
    r.monthLookback === 12 &&
    r.bridgeClassification === 'Ending ACV' &&
    (!filters.product  || r.product  === filters.product)  &&
    (!filters.channel  || r.channel  === filters.channel)  &&
    (!filters.region   || r.region   === filters.region)
  )

  if (!lb12.length) return []

  // Map: vintageKey → monthsOffset → { acv, custSet }
  const grid = new Map<string, Map<number, { acv: number; custs: Set<string> }>>()

  for (const r of lb12) {
    // Vintage key
    const vy  = r.vintage.getFullYear()
    const vmo = r.vintage.getMonth()
    const vKey = grain === 'yearly'
      ? String(vy)
      : `${vy}Q${Math.floor(vmo / 3) + 1}`

    // Months since vintage (snap to nearest 3)
    const rawMonths = (r.date.getFullYear() - r.vintage.getFullYear()) * 12
                    + (r.date.getMonth() - r.vintage.getMonth())
    const offset = Math.round(rawMonths / 3) * 3
    if (offset < 0) continue

    if (!grid.has(vKey)) grid.set(vKey, new Map())
    const row = grid.get(vKey)!
    if (!row.has(offset)) row.set(offset, { acv: 0, custs: new Set() })
    const cell = row.get(offset)!
    cell.acv += r.bridgeValue
    cell.custs.add(r.customer)
  }

  // Sort vintage keys
  const sortedKeys = [...grid.keys()].sort()

  return sortedKeys.map(label => {
    const row = grid.get(label)!
    const values: Record<number, number>  = {}
    const custCnt: Record<number, number> = {}
    for (const [offset, cell] of row) {
      values[offset]  = cell.acv
      custCnt[offset] = cell.custs.size
    }
    return { label, values, custCnt }
  })
}

// ── Customer Count KPIs ───────────────────────────────────────────────────────

export function calcCustomerKPIs(bridgeTable: ACVBridgeRow[], lb: 1|3|12, period: string) {
  const rows = bridgeTable.filter(r =>
    r.monthLookback === lb &&
    dk(r.date) === period
  )
  const byClass = (cls: string) => new Set(rows.filter(r => r.bridgeClassification === cls).map(r => r.customer))

  const priorCustomers   = byClass('Prior ACV').size
  const endingCustomers  = byClass('Ending ACV').size
  const churnedCustomers = byClass('Churn').size + byClass('Churn Partial').size
  const newCustomers     = byClass('New Logo').size
  const endingACV        = rows.filter(r => r.bridgeClassification === 'Ending ACV').reduce((s,r) => s + r.bridgeValue, 0)
  const priorACV         = rows.filter(r => r.bridgeClassification === 'Prior ACV').reduce((s,r) => s + r.bridgeValue, 0)

  return {
    priorCustomers,
    endingCustomers,
    churnedCustomers,
    newCustomers,
    custChurnPct:   priorCustomers > 0 ? churnedCustomers / priorCustomers : null,
    acvPerCustomer: endingCustomers > 0 ? endingACV / endingCustomers : null,
    priorACVPerCustomer: priorCustomers > 0 ? priorACV / priorCustomers : null,
  }
}
