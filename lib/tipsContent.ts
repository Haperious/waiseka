export interface TipCta {
  label: string
  route: string
}

export interface Tip {
  id: string
  title: string
  filipinoFraming: string
  iconKey:
    | 'pie'
    | 'piggy'
    | 'autoTransfer'
    | 'shield'
    | 'calendar'
    | 'receipt'
  body: string
  steps: string[]
  cta?: TipCta
}

export const tips: Tip[] = [
  {
    id: 'tip-50-30-20',
    title: 'The 50-30-20 Rule',
    filipinoFraming: '"Tatlong Hati ng Sweldo"',
    iconKey: 'pie',
    body: 'Sweldo just came in? Before it disappears into bills, Shopee carts, and "panggastos lang," try splitting it into three: 50% needs, 30% wants, 20% savings or investments. Not a strict law - more like a starting map you can adjust.',
    steps: [
      'List your fixed monthly needs and see what % of your sweldo they eat up.',
      'Set a rough ceiling for "wants," even kung estimate lang muna.',
      'Move your 20% savings share out on day one, hindi after everything else.',
    ],
    cta: { label: 'Try the 50-30-20 split with your numbers', route: '/budgets' },
  },
  {
    id: 'tip-save-first',
    title: 'Save First, Not Save After',
    filipinoFraming: '"Bayaran Mo Muna ang Sarili Mo"',
    iconKey: 'piggy',
    body: 'Most people save whatever\'s left after rent, bills, Jollibee, and that 12.12 sale na hindi naman kailangan. Kadalasan, walang natitira. Flip the order: send a portion to savings the moment sweldo lands, then budget the rest like that money never existed.',
    steps: [
      'Pick a fixed amount or % to save, decided before payday, not on payday.',
      'Treat that transfer like a bill you genuinely cannot skip.',
      'Budget your spending around what\'s left, never the other way around.',
    ],
    cta: { label: 'Set a savings goal that moves first', route: '/goals' },
  },
  {
    id: 'tip-auto-transfer',
    title: 'Auto-Transfer on Payday',
    filipinoFraming: '"I-set Mo Na, Bahala na ang System"',
    iconKey: 'autoTransfer',
    body: 'Willpower is unreliable, lalo na sa first few days pagkatapos lumabas ang sweldo. The fix isn\'t more discipline - it\'s removing the decision entirely. Set up an auto-transfer or GCash/Maya scheduled "auto-save" the moment salary arrives.',
    steps: [
      'Check kung may auto-transfer or "auto-save" feature ang bank/wallet mo.',
      'Schedule it for the same day, or the day right after, sweldo comes in.',
      'Keep that money somewhere you don\'t casually swipe from.',
    ],
    cta: { label: 'Set up a recurring transfer to a goal', route: '/goals' },
  },
  {
    id: 'tip-emergency-fund',
    title: 'Build Your Emergency Fund First',
    filipinoFraming: '"Hiwalay na Pondo Para sa \'Kung Sakali\'"',
    iconKey: 'shield',
    body: 'Savings for a Boracay trip and savings for "paano kung biglang nawalan ng trabaho" should never live in the same pocket. Before mutual funds or crypto, build a separate emergency fund - ideally 3-6 months of basic expenses, untouched unless it\'s an actual emergency.',
    steps: [
      'Add up essential monthly costs: rent, bills, food, transport.',
      'Multiply by 3-6 to get your target amount.',
      'Park it somewhere boring but reachable - not your daily-swipe wallet.',
    ],
    cta: { label: 'Create a separate Emergency Fund goal', route: '/goals' },
  },
  {
    id: 'tip-13th-month',
    title: 'Plan Your 13th Month Pay Early',
    filipinoFraming: '"Bago Pa Man Dumating ang Bonus"',
    iconKey: 'calendar',
    body: 'November or December, 13th month pay lands and suddenly feels like a permission slip for full holiday shopping mode. Wala namang masama sa pamimili - pero kung wala kang plano bago ito dumating, madali itong matunaw sa isang weekend ng sale.',
    steps: [
      'Decide your split ahead: bills/utang, savings/goals, free-to-spend.',
      'Write that split down before the money even lands.',
      'Move the savings portion right away, same as your regular sweldo.',
    ],
    cta: { label: 'Log your 13th month pay and split it', route: '/goals' },
  },
  {
    id: 'tip-tingi-leaks',
    title: 'Watch Out for "Tingi" Leaks',
    filipinoFraming: '"Maliit Lang Naman \'To" - famous last words',
    iconKey: 'receipt',
    body: 'Twenty pesos for load, thirty for a delivery fee, fifty for sari-sari snacks. None of it feels like real spending on its own. Pagsamahin mo lahat sa isang buwan, malalaman mong dito pala napunta ang malaking parte ng sweldo mo.',
    steps: [
      'Track every small purchase for one week, kahit ₱20 lang.',
      'Add it all up Sunday night - madalas nakakagulat ang total.',
      'Pick one category and try to cut it down next month.',
    ],
    cta: { label: 'Track small transactions automatically', route: '/transactions' },
  },
]
