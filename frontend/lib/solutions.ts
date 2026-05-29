// lib/solutions.ts — all 7 solution configs

export interface Capability {
  icon: string
  title: string
  desc: string
}

export interface Solution {
  slug: string
  label: string
  icon: string
  accent: string
  accentLight: string
  tagline: string
  heroHeadline: string
  heroSub: string
  challenges: string[]
  capabilities: Capability[]
  whyMatters: { icon: string; title: string; body: string }[]
  questions: string[]
  industries: { icon: string; name: string }[]
  previewMetrics: { label: string; value: string; delta?: string; up?: boolean }[]
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'growth',
    label: 'Growth',
    icon: '📈',
    accent: '#6B31D4',
    accentLight: '#F0EBFF',
    tagline: 'Understand exactly what drives revenue performance.',
    heroHeadline: 'Complete visibility into every dollar of growth.',
    heroSub: 'Gain a clear, reconciled view of acquisition, expansion, contraction, and churn — and the exact drivers behind every movement.',
    challenges: [
      'Revenue is growing but the drivers are unclear or disputed',
      'Explaining NRR and ARR movements to the board takes days of manual work',
      'No single source of truth for expansion vs churn attribution',
      'Historical comparisons are inconsistent across teams',
    ],
    capabilities: [
      { icon:'🌉', title:'ARR Bridge Analysis',         desc:'Full waterfall from Beginning ARR to Ending ARR — New Logo, Upsell, Downsell, Churn, Lapsed, Returning.' },
      { icon:'📊', title:'MRR Bridge Analysis',         desc:'Monthly movement classification at atomic level. Every dollar accounted for.' },
      { icon:'🎯', title:'Revenue Driver Attribution',  desc:'Isolate exactly which customers, products, and segments drove growth or decline.' },
      { icon:'📉', title:'NRR & GRR Tracking',          desc:'Net and Gross Revenue Retention trended over time with full drill-down.' },
      { icon:'📅', title:'Historical Trend Analysis',   desc:'Multi-year YoY, QoQ, MoM comparison with period-normalized benchmarks.' },
      { icon:'📋', title:'Executive Reporting',         desc:'Board-ready narratives generated automatically after every analysis run.' },
    ],
    whyMatters: [
      { icon:'⚡', title:'Decisions in minutes',  body:'Stop spending 3 days building the monthly ARR pack. Get answers in under 2 minutes.' },
      { icon:'✅', title:'100% reconciled',        body:'Beginning ARR always equals Ending ARR. No leakage, no manual adjustments.' },
      { icon:'🎯', title:'Clear accountability',   body:'Every movement attributed to a customer, product, and channel — no ambiguity.' },
    ],
    questions: [
      'What drove ARR growth this quarter?',
      'Which customers contributed most to expansion?',
      'How much revenue was lost to churn vs downsell?',
      'Which segments are growing fastest YoY?',
      'How does this quarter compare to the same period last year?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'🏥',name:'Healthcare Tech'},{icon:'💼',name:'PE Portfolio'},{icon:'🏦',name:'Financial Services'},
    ],
    previewMetrics: [
      {label:'Beginning ARR',value:'$10.5M'},{label:'New Logo',value:'$1.1M',delta:'+$1.1M',up:true},{label:'Upsell',value:'$832K',delta:'+$832K',up:true},{label:'Churn',value:'-$362K',delta:'-3.4%',up:false},{label:'Ending ARR',value:'$11.1M',delta:'+5.3%',up:true},
    ],
  },
  {
    slug: 'customers',
    label: 'Customers',
    icon: '👥',
    accent: '#2E90FA',
    accentLight: '#EFF6FF',
    tagline: 'Understand health, risk, and expansion potential at account level.',
    heroHeadline: 'Know which customers will grow, stay, or leave.',
    heroSub: 'Turn transaction data into a complete picture of customer health — who to prioritize, who is at risk, and where expansion is hiding.',
    challenges: [
      'No early warning system for accounts at risk of churning',
      'Expansion opportunities identified too late or not at all',
      'Customer health scoring is manual and inconsistent',
      'Account-level revenue trends buried in aggregate numbers',
    ],
    capabilities: [
      { icon:'🏥', title:'Customer Health Scoring',    desc:'Composite health score per account based on revenue trend, engagement, and cohort behavior.' },
      { icon:'⚠️', title:'Churn Propensity Signals',   desc:'Early warning flags for accounts showing contraction, reduced engagement, or renewal risk.' },
      { icon:'🚀', title:'Expansion Opportunity Map',   desc:'Surface accounts with high upsell potential based on usage, growth, and segment benchmarks.' },
      { icon:'📊', title:'Account-Level Waterfall',     desc:'Full ARR bridge at the individual account level — see every movement for every customer.' },
      { icon:'🔬', title:'Segment Analysis',            desc:'Group customers by size, industry, product, or region and compare cohort performance.' },
      { icon:'📈', title:'Lifetime Value Tracking',     desc:'Track LTV trends and payback periods across acquisition cohorts.' },
    ],
    whyMatters: [
      { icon:'🛡️', title:'Protect revenue',   body:'Identify at-risk accounts 60–90 days before renewal, not after the fact.' },
      { icon:'🚀', title:'Accelerate growth',  body:'Find expansion opportunities hidden in your existing customer base.' },
      { icon:'📊', title:'Focus your team',    body:'Give CS and sales a prioritized list of accounts to act on this week.' },
    ],
    questions: [
      'Which accounts are most likely to churn in the next 90 days?',
      'Where are our biggest upsell opportunities?',
      'What is the LTV of customers acquired in Q1 2024?',
      'Which customer segments have the best retention?',
      'Which accounts have been shrinking month over month?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'📡',name:'Telecom'},{icon:'🏥',name:'Healthcare'},{icon:'💼',name:'PE Portfolio'},
    ],
    previewMetrics: [
      {label:'Total Customers',value:'342'},{label:'At Risk',value:'28',delta:'8.2%',up:false},{label:'Expansion Ready',value:'54',delta:'+15.8%',up:true},{label:'Avg Health Score',value:'74/100'},{label:'NRR',value:'105.3%',delta:'+2.1pp',up:true},
    ],
  },
  {
    slug: 'contracts',
    label: 'Contracts',
    icon: '📋',
    accent: '#12B76A',
    accentLight: '#ECFDF3',
    tagline: 'Monitor renewals, commitments, and future revenue obligations.',
    heroHeadline: 'See every dollar of committed revenue — and when it\'s at risk.',
    heroSub: 'Turn your contract data into a forward-looking view of renewals, expirations, and revenue obligations across your entire book of business.',
    challenges: [
      'No clear view of what revenue is renewing in the next 90 days',
      'Contract expirations caught too late to act on',
      'TCV and ACV reporting inconsistent across deals',
      'Renewal rate calculations vary by team and spreadsheet',
    ],
    capabilities: [
      { icon:'🔄', title:'Contract Bridge Analysis',  desc:'Movement of contract value from period to period — new, renewed, expanded, contracted, churned.' },
      { icon:'📅', title:'Renewal Calendar',          desc:'Every expiring contract surfaced by month, with value and risk indicators.' },
      { icon:'💰', title:'ACV / TCV Analytics',       desc:'Full contract value analysis — annual vs total, by segment, product, and cohort.' },
      { icon:'⚠️', title:'Expiry Risk Pool',          desc:'Contracts at risk of non-renewal flagged with confidence scores and recommended actions.' },
      { icon:'📊', title:'Renewal Rate Tracking',     desc:'Logo and revenue renewal rates trended over time — standardized and reconciled.' },
      { icon:'🎯', title:'Commitment Coverage',       desc:'Contracted ARR vs run-rate ARR — shows the gap between committed and recurring revenue.' },
    ],
    whyMatters: [
      { icon:'📅', title:'Never miss a renewal',   body:'Every expiring contract surfaced 90+ days ahead with full context.' },
      { icon:'💰', title:'Protect committed ARR',  body:'Know exactly how much revenue is locked in vs at risk at any point.' },
      { icon:'🎯', title:'Improve forecast accuracy', body:'Build forecasts on actual contract data, not assumptions.' },
    ],
    questions: [
      'What contracts are expiring in the next 60 days?',
      'What is our renewal rate by customer segment?',
      'How much committed ARR do we have for next quarter?',
      'Which contracts have the highest non-renewal risk?',
      'How does ACV compare to run-rate MRR by cohort?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'💼',name:'PE Portfolio'},{icon:'🏭',name:'Manufacturing'},{icon:'🏦',name:'Financial Services'},
    ],
    previewMetrics: [
      {label:'Contracts Expiring',value:'$2.1M'},{label:'Renewal Rate',value:'91.4%',delta:'+1.2pp',up:true},{label:'At-Risk ARR',value:'$380K',delta:'-$380K',up:false},{label:'Avg Contract',value:'$18.4K'},{label:'Committed ARR',value:'$9.8M',delta:'+4.2%',up:true},
    ],
  },
  {
    slug: 'pricing',
    label: 'Pricing',
    icon: '💲',
    accent: '#F79009',
    accentLight: '#FFFBEB',
    tagline: 'Evaluate pricing performance and improve monetization strategies.',
    heroHeadline: 'Understand exactly how pricing drives revenue.',
    heroSub: 'Separate the impact of price changes from volume changes — and make confident pricing decisions backed by your actual contract and subscription data.',
    challenges: [
      'Unable to separate price increase impact from volume growth',
      'Discounting patterns invisible across the sales team',
      'No data on which price points drive the best retention',
      'Pricing changes take months to show up in revenue reporting',
    ],
    capabilities: [
      { icon:'⚖️', title:'Price × Volume Decomposition', desc:'Split ARR movement into pure pricing effects vs customer count and seat changes.' },
      { icon:'🏷️', title:'Discount Analysis',             desc:'Measure discounting depth, frequency, and impact on LTV by segment and rep.' },
      { icon:'📊', title:'Price Point Performance',       desc:'Compare retention and expansion rates across price tiers and contract structures.' },
      { icon:'📈', title:'Monetization Benchmarks',      desc:'Track ARPU and ACV trends over time — are you capturing more value per customer?' },
      { icon:'🎯', title:'Pricing Cohort Analysis',      desc:'Compare revenue performance across cohorts with different pricing structures.' },
      { icon:'💰', title:'Uplift Attribution',           desc:'Measure the revenue impact of price increases, discounts, and promotions.' },
    ],
    whyMatters: [
      { icon:'💰', title:'Capture more value',    body:'Identify where you are underpriced relative to the value customers receive.' },
      { icon:'🎯', title:'Price with confidence', body:'Every pricing decision backed by actual data, not gut feel.' },
      { icon:'📊', title:'Stop revenue leakage',  body:'Identify discounting patterns that erode margin without improving retention.' },
    ],
    questions: [
      'How much of our growth was from price increases vs new customers?',
      'Which price points have the best long-term retention?',
      'Where are we discounting most aggressively?',
      'What is the revenue impact of our last price increase?',
      'How does ARPU trend across our customer cohorts?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'📡',name:'Telecom'},{icon:'🏭',name:'Manufacturing'},{icon:'💼',name:'PE Portfolio'},
    ],
    previewMetrics: [
      {label:'ARPU',value:'$1,240',delta:'+8.4%',up:true},{label:'Price Effect',value:'+$420K'},{label:'Volume Effect',value:'+$392K'},{label:'Discount Rate',value:'12.3%',delta:'-1.8pp',up:true},{label:'Avg ACV',value:'$14.9K',delta:'+6.2%',up:true},
    ],
  },
  {
    slug: 'products',
    label: 'Products',
    icon: '📦',
    accent: '#7C3AED',
    accentLight: '#F5F3FF',
    tagline: 'Discover which products and bundles drive growth and adoption.',
    heroHeadline: 'Know which products are driving — and dragging — growth.',
    heroSub: 'See revenue performance at the product and bundle level — which offerings are growing, which are stalling, and how your product mix is evolving.',
    challenges: [
      'No clear view of which products are driving ARR growth',
      'Bundle performance invisible in aggregate revenue numbers',
      'Cross-sell and upsell attach rates tracked manually or not at all',
      'Product mix shifting without a clear picture of why',
    ],
    capabilities: [
      { icon:'📦', title:'Product Revenue Breakdown', desc:'Full ARR bridge at the product level — see growth, churn, and expansion per SKU.' },
      { icon:'🔗', title:'Bundle Analysis',           desc:'Measure bundle performance, attach rates, and revenue contribution by combination.' },
      { icon:'🚀', title:'Cross-Sell Intelligence',  desc:'Identify which product combinations correlate with best retention and expansion.' },
      { icon:'📊', title:'Product Mix Evolution',    desc:'Track how revenue mix shifts across products and segments over time.' },
      { icon:'🎯', title:'SKU Attribution',           desc:'Attribute every dollar of ARR movement to a specific product or feature tier.' },
      { icon:'📈', title:'Adoption Cohorts',          desc:'Measure how product adoption rate correlates with NRR and customer health.' },
    ],
    whyMatters: [
      { icon:'🎯', title:'Focus product investment', body:'Know which products drive the most durable revenue — and fund them accordingly.' },
      { icon:'🚀', title:'Accelerate cross-sell',    body:'Surface the bundle patterns that turn single-product customers into multi-product customers.' },
      { icon:'📊', title:'Simplify your portfolio',  body:'Identify products that dilute focus without contributing meaningfully to ARR.' },
    ],
    questions: [
      'Which products are growing fastest in ARR?',
      'What is the churn rate by product tier?',
      'Which product combinations have the highest NRR?',
      'How is our product mix evolving quarter over quarter?',
      'What is the revenue impact of our cross-sell motion?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'🏥',name:'Healthcare Tech'},{icon:'📡',name:'Telecom'},{icon:'🏭',name:'Manufacturing'},
    ],
    previewMetrics: [
      {label:'Products Tracked',value:'12'},{label:'Top Product ARR',value:'$6.2M',delta:'+14%',up:true},{label:'Bundle Attach Rate',value:'38%',delta:'+4pp',up:true},{label:'Cross-Sell ARR',value:'$1.1M'},{label:'Product NRR',value:'108%',delta:'+3pp',up:true},
    ],
  },
  {
    slug: 'profitability',
    label: 'Profitability',
    icon: '💹',
    accent: '#059669',
    accentLight: '#ECFDF5',
    tagline: 'Analyze margins, contribution, and value creation across the business.',
    heroHeadline: 'From revenue to profitability — with full attribution.',
    heroSub: 'Move beyond top-line revenue to understand contribution margin, segment profitability, and where value is truly being created — or destroyed.',
    challenges: [
      'Revenue growth masking margin compression in key segments',
      'No view of profitability by customer, product, or geography',
      'CAC and LTV ratios inconsistent across reporting',
      'Hard to identify where to focus to improve unit economics',
    ],
    capabilities: [
      { icon:'💹', title:'Contribution Margin Analysis', desc:'Revenue less direct costs by segment, product, and customer — see where you make money.' },
      { icon:'🏪', title:'4-Wall Analytics',              desc:'Segment-level P&L showing full contribution by region, channel, or business unit.' },
      { icon:'📊', title:'Unit Economics Tracking',       desc:'CAC, LTV, payback period, and LTV:CAC trended across cohorts and segments.' },
      { icon:'⚖️', title:'Margin Bridge Analysis',       desc:'Explain margin movement with the same rigour as ARR bridge analysis.' },
      { icon:'🎯', title:'Value Cohort Analysis',        desc:'Which customer cohorts generate the most lifetime value — and why?' },
      { icon:'📈', title:'ROI Attribution',              desc:'Measure the return on revenue investment across sales, marketing, and CS.' },
    ],
    whyMatters: [
      { icon:'💰', title:'Grow profitably',       body:'Identify segments where revenue growth creates value — and segments where it destroys it.' },
      { icon:'🎯', title:'Focus on unit economics', body:'Make resource allocation decisions based on contribution, not just revenue.' },
      { icon:'📊', title:'Board-ready margins',   body:'Explain margin trends with the same clarity and rigour as revenue trends.' },
    ],
    questions: [
      'Which customer segments are most profitable?',
      'What is our LTV:CAC ratio by acquisition cohort?',
      'Where is margin compression happening?',
      'Which products have the highest contribution margin?',
      'What is the payback period for our current CAC?',
    ],
    industries: [
      {icon:'💼',name:'PE Portfolio'},{icon:'💻',name:'SaaS & Software'},{icon:'🏭',name:'Manufacturing'},{icon:'🏦',name:'Financial Services'},
    ],
    previewMetrics: [
      {label:'Gross Margin',value:'72.4%',delta:'+1.8pp',up:true},{label:'LTV:CAC',value:'4.2x',delta:'+0.4x',up:true},{label:'Payback Period',value:'14 mo',delta:'-2mo',up:true},{label:'Best Segment',value:'Enterprise',delta:'81% margin'},{label:'Contribution',value:'$8.1M',delta:'+12%',up:true},
    ],
  },
  {
    slug: 'retention',
    label: 'Retention',
    icon: '🔄',
    accent: '#0EA5E9',
    accentLight: '#F0F9FF',
    tagline: 'Measure customer loyalty and the sustainability of revenue growth.',
    heroHeadline: 'Know how sticky your revenue really is.',
    heroSub: 'Measure, benchmark, and improve customer retention with cohort-level precision — and understand what separates customers who stay from those who leave.',
    challenges: [
      'Retention metrics inconsistent across teams and reporting periods',
      'No cohort-level view of how retention evolves over time',
      'Early churn signals invisible until it\'s too late to act',
      'Hard to isolate the product and pricing factors that drive churn',
    ],
    capabilities: [
      { icon:'🔄', title:'Cohort Retention Heatmaps', desc:'Visualize retention by acquisition cohort — see exactly when customers leave and why.' },
      { icon:'📊', title:'NRR / GRR by Cohort',        desc:'Net and Gross Revenue Retention sliced by cohort, segment, product, and channel.' },
      { icon:'📈', title:'Retention Curve Analysis',   desc:'Understand where retention stabilizes — and how your curves compare period over period.' },
      { icon:'⚠️', title:'Early Warning System',       desc:'Flag accounts showing the behavioral patterns that precede churn 60–90 days out.' },
      { icon:'🏷️', title:'Churn Driver Attribution',   desc:'Attribute churn to specific factors — pricing, product, support, segment — not just "competition".' },
      { icon:'🎯', title:'Retention Benchmarking',     desc:'Compare your retention performance against SaaS benchmarks by segment and ARR band.' },
    ],
    whyMatters: [
      { icon:'🛡️', title:'Make revenue sustainable', body:'High retention is the foundation of compounding growth — measure it with precision.' },
      { icon:'📊', title:'Find the leaky bucket',    body:'Identify exactly where and why customers leave — and fix it before it compounds.' },
      { icon:'🚀', title:'Improve NRR to 110%+',     body:'The difference between 95% and 110% NRR determines whether you grow or grind.' },
    ],
    questions: [
      'What is our 12-month logo retention rate?',
      'Which acquisition cohort has the best 24-month retention?',
      'At what month do most customers churn?',
      'What is GRR by product and segment?',
      'How does retention compare between SMB and Enterprise?',
    ],
    industries: [
      {icon:'💻',name:'SaaS & Software'},{icon:'📡',name:'Telecom'},{icon:'🏥',name:'Healthcare'},{icon:'💼',name:'PE Portfolio'},
    ],
    previewMetrics: [
      {label:'Logo Retention',value:'91.4%',delta:'+1.2pp',up:true},{label:'Revenue Retention',value:'105.3%',delta:'+2.1pp',up:true},{label:'12-mo GRR',value:'94.7%'},{label:'Avg Churn Month',value:'Month 7'},{label:'Best Cohort NRR',value:'118%',delta:'Q1 2024'},
    ],
  },
]

export const SOLUTION_MAP = Object.fromEntries(SOLUTIONS.map(s => [s.slug, s]))
