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
    | 'subscriptionAudit'
    | 'lifestyleInflation'
    | 'walletSave'
    | 'cutoff'
    | 'installments'
    | 'padala'
    | 'sinkingFund'
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
    id: 'tip-per-cutoff',
    title: 'Budget Per Cutoff, Not Per Month',
    filipinoFraming: '"Kinsenas Ka, Hindi Buwanan"',
    iconKey: 'cutoff',
    body: 'Most of us get paid every 15th and 30th, pero ang budget natin, pang-buwanan. So the first cutoff feels like extra money - kain sa labas, konting shopping - and the second cutoff ends up carrying rent, bills, and everything else. Instead of one big monthly plan, give each cutoff its own job: which bills it pays, how much goes to savings, and how much is free to spend until the next sweldo.',
    steps: [
      'List your bills with their due dates, then assign each one to the cutoff that lands before it.',
      'Split your savings across both cutoffs para hindi isang sweldo lang ang nagbubuhat.',
      'Whatever\'s left per cutoff is your spending money until the next payday - hindi para sa buong buwan.',
    ],
    cta: { label: 'Set budgets that fit your cutoff', route: '/budgets' },
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
    id: 'tip-sinking-funds',
    title: 'Sinking Funds for "Surprise" Expenses',
    filipinoFraming: '"Hindi Emergency \'Yan, Alam Mo Namang Darating"',
    iconKey: 'sinkingFund',
    body: 'Enrollment sa June. Regalo sa Pasko. Ninong or ninang ka na naman sa binyag. Birthday ni Mama, car registration, annual insurance premium. None of these are real emergencies - alam mo namang darating sila - pero pag dumating na, parang biglaan pa rin. A sinking fund fixes that: save a small amount every cutoff for each expense you know is coming, so the full amount is ready when the bill shows up and your emergency fund stays untouched.',
    steps: [
      'List the big expenses you expect in the next 12 months and roughly how much each one costs.',
      'Divide each amount by the number of cutoffs left before it\'s due - that\'s your per-sweldo target.',
      'Keep each fund separate so you always know kung magkano na ang naipon for each one.',
    ],
    cta: { label: 'Create a goal for each expense you see coming', route: '/goals' },
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
  {
    id: 'tip-subscription-audit',
    title: 'Audit Your Subscriptions',
    filipinoFraming: '"Nagbabayad Ka Pa Ba Doon?"',
    iconKey: 'subscriptionAudit',
    body: 'Netflix, Spotify, iCloud storage, that fitness app you downloaded during New Year\'s, the cloud backup you set up tapos nakalimutan na. Subscriptions are sneaky - bawat isa ay mukhang maliit lang monthly, but they stack quietly in the background. Most people are paying for at least one or two they haven\'t opened in months. A quick audit takes fifteen minutes and can free up a few hundred pesos a month without changing your lifestyle at all.',
    steps: [
      'Go through your GCash, Maya, or bank statement and highlight every recurring charge, kahit gaano kaliit.',
      'For each one, ask: "Ginamit ko ba \'to this month?" If the answer is no twice in a row, cancel it.',
      'Set a calendar reminder every 3 months to re-check - new subscriptions creep in without you noticing.',
    ],
  },
  {
    id: 'tip-lifestyle-inflation',
    title: 'Don\'t Let Lifestyle Inflation Eat Your Raise',
    filipinoFraming: '"Tumaas ang Sweldo, Huwag Hayaang Sumabay ang Gastos"',
    iconKey: 'lifestyleInflation',
    body: 'You work hard, you get a raise, and somehow by the next month you\'re still feeling just as tight. This is lifestyle inflation - spending automatically rises to meet whatever income you earn. Mas malaki na ang sahod, mas malaki na rin ang brunch, ang gadget upgrade, ang Grab rides instead of MRT. The raise feels good for about two weeks, then it disappears. The fix is to treat a portion of every raise as already committed to savings before your lifestyle has a chance to adjust.',
    steps: [
      'When your sweldo increases, commit at least half of that increase to savings or investments before spending anything extra.',
      'Update your auto-transfer amount on the same day you learn about the raise - not next month.',
      'Give yourself a small lifestyle reward too, para hindi masyadong strict. The goal is balance, not punishment.',
    ],
    cta: { label: 'Update your savings goal to match your new income', route: '/goals' },
  },
  {
    id: 'tip-bnpl-trap',
    title: 'Watch Out for the BNPL Trap',
    filipinoFraming: '"Hulugan Lang Naman... Times Five"',
    iconKey: 'installments',
    body: 'SPayLater for the air fryer, GGives for the new phone, Home Credit for the laptop, plus a 0% installment sa credit card. Each one feels manageable on its own - ₱500 here, ₱1,200 there. Pero pag pinagsama-sama mo, baka ang laking parte na ng bawat cutoff ang naka-reserve sa hulog bago ka pa makabili ng kahit ano. Buy now, pay later is easy to start and easy to forget, and missed payments can come with fees and penalties.',
    steps: [
      'List every active installment and loan - app, store, and credit card - with its monthly amount and end date.',
      'Add them all up and compare the total to one cutoff. Kung malaki na ang kinakain, that\'s your signal.',
      'Pause new installments until at least one is fully paid, and log each payment para kita mo ang progress.',
    ],
    cta: { label: 'Log your installment payments', route: '/transactions' },
  },
  {
    id: 'tip-padala-budget',
    title: 'Set a Padala Budget',
    filipinoFraming: '"Mahal Mo Sila, Pero May Limit Din"',
    iconKey: 'padala',
    body: 'Pang-tuition ng kapatid, pambayad ng kuryente sa probinsya, "pahiram muna" from a tita. Helping family is part of who we are, and there\'s nothing wrong with it. The hard part is when every request gets answered on the spot - then your own bills, savings, and plans quietly get pushed aside. Setting a fixed padala amount each cutoff lets you keep helping without guilt and without putting yourself at risk.',
    steps: [
      'Decide on a fixed amount you can give each cutoff without touching your bills or savings.',
      'Treat it as its own budget line, para malinaw kung magkano pa ang natitira para sa padala this month.',
      'When a request goes over the limit, it\'s okay to say "next cutoff na lang" - you\'re still helping, just with a plan.',
    ],
    cta: { label: 'Create a budget for family support', route: '/budgets' },
  },
  {
    id: 'tip-gcash-maya-save',
    title: 'Use GCash Save or Maya Savings',
    filipinoFraming: '"Nasa Wallet Mo Na Pala ang Tool"',
    iconKey: 'walletSave',
    body: 'Most Filipinos already have GCash or Maya on their phone - but a lot of people only use them for sending money and paying bills. Both apps have built-in savings features (GSave on GCash, Maya Savings on Maya) that earn interest higher than most traditional passbook accounts, and your money stays accessible. You don\'t need to open a separate bank account or fill out forms. The tool is literally already on your home screen.',
    steps: [
      'Open GCash or Maya and look for the Save or Savings feature if you haven\'t set it up yet.',
      'Move even a small starter amount in - the habit of having a separate "hands-off" pocket matters more than the amount at first.',
      'Check the current interest rate and compare it to your existing savings account - you might be leaving money on the table.',
    ],
  },
]
