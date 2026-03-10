import TaxCalculator from './TaxCalculator.jsx'
/**
 * VOW — Full Supabase Edition
 *
 * Requires these env vars in Vercel / .env:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *
 * Supabase SQL to run once in the SQL editor:
 * ─────────────────────────────────────────────
 * create table public.profiles (
 *   id uuid references auth.users primary key,
 *   stage text, income text, partner_income text,
 *   children text, debt text, home text,
 *   created_at timestamptz default now()
 * );
 * create table public.progress (
 *   id uuid references auth.users primary key,
 *   completed_chapters text[] default '{}',
 *   updated_at timestamptz default now()
 * );
 * create table public.partner_links (
 *   id uuid default gen_random_uuid() primary key,
 *   created_by uuid references auth.users,
 *   partner_id uuid references auth.users,
 *   invite_code text unique,
 *   created_at timestamptz default now()
 * );
 * create table public.qa_events (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users,
 *   question text,
 *   matched_topic text,
 *   created_at timestamptz default now()
 * );
 * -- Enable Row Level Security
 * alter table public.profiles enable row level security;
 * alter table public.progress enable row level security;
 * alter table public.partner_links enable row level security;
 * alter table public.qa_events enable row level security;
 * -- Policies
 * create policy "Own profile" on public.profiles for all using (auth.uid() = id);
 * create policy "Own progress" on public.progress for all using (auth.uid() = id);
 * create policy "Own links" on public.partner_links for all using (auth.uid() = created_by or auth.uid() = partner_id);
 * create policy "Own events" on public.qa_events for all using (auth.uid() = user_id);
 * ─────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:#0D1824;color:#F4EFE6;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#C9A84C33;border-radius:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideLeft{from{opacity:0;transform:translateX(44px)}to{opacity:1;transform:translateX(0)}}
  @keyframes slideRight{from{opacity:0;transform:translateX(-44px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pop{0%{transform:scale(0.88);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}
  @keyframes pulse{0%,100%{opacity:.65;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px #C9A84C22}50%{box-shadow:0 0 40px #C9A84C55}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes shimmer{0%,100%{opacity:.3}50%{opacity:1}}
  input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px #152233 inset!important;-webkit-text-fill-color:#F4EFE6!important;}
`;

const C = {
  navy:"#0D1824", navyMid:"#152233", navyLight:"#1C2E42",
  gold:"#C9A84C", goldLight:"#E5C97A",
  cream:"#F4EFE6", creamDim:"#F4EFE699", creamFaint:"#F4EFE618",
};

// ─── Profile questions ────────────────────────────────────────────────────────
const PROFILE_QUESTIONS = [
  { id:"stage",  emoji:"💍", question:"Where are you in your journey?",
    options:[{value:"engaged",label:"Recently engaged"},{value:"planning",label:"Planning to propose"},{value:"married",label:"Newly married"},{value:"curious",label:"Just exploring"}] },
  { id:"income", emoji:"💰", question:"What's your approximate annual income?",
    options:[{value:"under50",label:"Under $50K"},{value:"50to100",label:"$50K – $100K"},{value:"100to200",label:"$100K – $200K"},{value:"over200",label:"Over $200K"}] },
  { id:"partnerIncome", emoji:"⚖️", question:"How does your income compare to your partner's?",
    options:[{value:"similar",label:"We earn about the same"},{value:"iMore",label:"I earn significantly more"},{value:"theyMore",label:"They earn significantly more"},{value:"oneIncome",label:"One of us doesn't work"}] },
  { id:"children", emoji:"👶", question:"Do you have or plan to have children?",
    options:[{value:"haveKids",label:"We already have kids"},{value:"planKids",label:"Planning to have kids"},{value:"maybeKids",label:"Maybe someday"},{value:"noKids",label:"Not planning on it"}] },
  { id:"debt", emoji:"📋", question:"Do either of you carry significant debt?",
    options:[{value:"studentLoans",label:"Student loans"},{value:"creditCards",label:"Credit card debt"},{value:"both",label:"Both"},{value:"noneDebt",label:"Neither of us"}] },
  { id:"home", emoji:"🏠", question:"What's your housing situation?",
    options:[{value:"rent",label:"We rent"},{value:"ownOne",label:"One of us owns"},{value:"ownBoth",label:"We both own"},{value:"buyingSoon",label:"Planning to buy soon"}] },
];

// ─── Q&A database ─────────────────────────────────────────────────────────────
const QA_DATABASE = [
  { keywords:["tax","taxes","filing","file","irs","return"], topic:"taxes",
    q:"Should we file jointly or separately?",
    a:"For most couples, filing jointly saves money — sometimes thousands. The exception: if one of you is on income-driven student loan repayment or has large medical expenses, filing separately can preserve lower payments. Always run both scenarios before your first tax season together.",
    tip:"Married filing separately almost always results in a higher combined tax bill — but the IDR exception is real and worth checking." },
  { keywords:["marriage bonus","bonus","save tax","lower bracket"], topic:"taxes",
    q:"What is the marriage bonus?",
    a:"When partners have meaningfully different incomes, filing jointly pulls the higher earner into a lower bracket. Couples with one high earner and one lower earner can save $3,000–$8,000 per year. The bigger the income gap, the bigger the potential bonus.",
    tip:"The marriage bonus is most powerful when one partner earns 2x or more than the other." },
  { keywords:["marriage penalty","penalty","higher taxes"], topic:"taxes",
    q:"What is the marriage penalty?",
    a:"When both partners earn similar incomes, combining them can push you into a higher bracket than you'd each hit separately. Couples where both earn $80K–$180K are most at risk. The penalty is real but usually smaller than people fear — typically a few hundred to a few thousand dollars.",
    tip:"Run your taxes both ways before filing. Free tools like TaxAct or a CPA can model both scenarios in minutes." },
  { keywords:["w4","w-4","withholding","paycheck"], topic:"taxes",
    q:"Do I need to update my W-4 after getting married?",
    a:"Yes — and most couples forget. Your employer is still withholding as if you're single. File a new W-4 within 30 days of getting married. If you skip it, expect a surprise in April.",
    tip:"This takes 10 minutes. Do it before the honeymoon haze wears off." },
  { keywords:["standard deduction","deduction","itemize"], topic:"taxes",
    q:"How does the standard deduction change when married?",
    a:"The 2024 standard deduction for married filing jointly is $29,200 — exactly double the single amount. Itemizing only makes sense if your combined deductions exceed that. Very few couples cross this bar unless they have a large mortgage or significant charitable giving.",
    tip:"Don't stress about itemizing unless you own a home or give heavily to charity." },
  { keywords:["bank","account","combine","separate","finances","money system"], topic:"accounts",
    q:"Should we combine our bank accounts?",
    a:"Research consistently shows couples with joint accounts report less financial conflict. The most popular approach is the 3-account method: keep individual accounts, open a joint account for shared bills, and both contribute a set amount each month. What's left in your personal account is yours — no questions asked.",
    tip:"The system matters less than the transparency you build into it." },
  { keywords:["3 account","three account","yours mine ours","split bills"], topic:"accounts",
    q:"How does the 3-account method work?",
    a:"Simple: each person keeps their own checking account and you open a joint account for shared expenses — rent, groceries, utilities. Contribute either a fixed amount or a percentage of income monthly. Discretionary spending from personal accounts is judgment-free.",
    tip:"Percentage contributions tend to feel fairer when incomes are unequal." },
  { keywords:["emergency fund","emergency","savings","rainy day"], topic:"accounts",
    q:"How much should we save in an emergency fund?",
    a:"Target 6 months of combined household expenses. Add up rent/mortgage, utilities, food, insurance, and debt minimums — then multiply by 6. Keep it in a high-yield savings account (HYSA), not checking. Top options: SoFi, Marcus, Ally — typically 4–5% APY.",
    tip:"On a $20K emergency fund, 4.5% APY earns ~$900/year more than a standard savings account." },
  { keywords:["financial infidelity","hiding money","secret","hidden purchases"], topic:"accounts",
    q:"What is financial infidelity?",
    a:"Hiding financial activity from your partner — secret spending, undisclosed debt, hidden accounts. It's a factor in roughly 40% of divorces. It almost never starts maliciously; it starts with one purchase someone felt they couldn't explain. Monthly money check-ins are the simplest prevention.",
    tip:"The system you set up in year one tends to stick. Build transparency in from the start." },
  { keywords:["debt","inherit","partner's debt","responsible for"], topic:"debt",
    q:"Do I inherit my partner's debt when we get married?",
    a:"No — pre-existing debt stays with whoever took it on. Student loans, credit cards, car loans from before marriage are legally theirs. The exception: community property states (CA, TX, AZ, and 6 others) where debt taken on during marriage is jointly owned.",
    tip:"Even if you don't legally inherit it, their debt affects your household cash flow. Build it into your shared budget." },
  { keywords:["credit score","credit","score","mortgage rate"], topic:"debt",
    q:"How does my partner's credit score affect me?",
    a:"When you apply for a joint mortgage, lenders use the lower of your two middle scores to set the interest rate. On a $400K 30-year mortgage, a 100-point score difference can mean $70,000+ in additional interest. Know both scores before applying for anything together.",
    tip:"Check both scores free at AnnualCreditReport.com. If one needs work, start improving it 6–12 months before applying for a mortgage." },
  { keywords:["student loans","student loan","idr","income driven","repayment"], topic:"debt",
    q:"How does marriage affect student loan repayment?",
    a:"If you're on income-driven repayment, your combined income on a joint return can significantly increase your required payments. Filing separately preserves lower payments — but costs you the tax benefits of filing jointly. Run both scenarios carefully before your first tax season.",
    tip:"Use the StudentAid.gov loan simulator to model how marriage affects your payments." },
  { keywords:["prenup","prenuptial","premarital"], topic:"legal",
    q:"Do we need a prenup?",
    a:"You don't legally need one, but more couples should consider it. A prenup is a financial agreement made while you actually like each other and can think clearly. Worth considering if either of you owns a business, has significant assets or debt, has children from a previous relationship, or expects an inheritance.",
    tip:"51% of millennials think everyone should have a prenup. The gap is mostly just the awkwardness of starting the conversation." },
  { keywords:["prenup cost","how much prenup","prenup price"], topic:"legal",
    q:"How much does a prenup cost?",
    a:"Traditional prenups through separate attorneys: $2,500–$10,000+ total. Online services like HelloPrenup have brought costs to $599–$1,500 for straightforward situations. Both partners should still get independent legal review for the agreement to hold up in court.",
    tip:"The cost of a prenup is almost always less than the cost of litigation without one." },
  { keywords:["name change","last name","change name"], topic:"legal",
    q:"How do I change my name after getting married?",
    a:"The order matters: (1) Social Security Administration first, (2) Driver's license, (3) Passport, (4) Banks and everything else. Out-of-order changes create mismatches that delay processing. The full process takes 4–8 weeks.",
    tip:"Don't book international travel in the first two months post-wedding if you're changing your name." },
  { keywords:["beneficiary","401k beneficiary","retirement beneficiary","life insurance beneficiary"], topic:"legal",
    q:"What beneficiary accounts do I need to update?",
    a:"Update: 401(k)/403(b), IRAs, life insurance policies, and bank TOD accounts. These pass directly to whoever you named — bypassing your will entirely. Most people set them once years ago and forgot. Do this the week after your honeymoon.",
    tip:"Your will does NOT override beneficiary designations on retirement accounts. They're completely separate." },
  { keywords:["will","estate","power of attorney","trust"], topic:"legal",
    q:"Do we need a will after getting married?",
    a:"Yes. Without a will, your assets may not go to your spouse depending on your state's default intestacy rules. A basic will, durable power of attorney, and healthcare directive can be set up online through Trust & Will or Tomorrow for under $300. Do it in your first year.",
    tip:"The ROI on a basic will is extraordinary. It becomes even more critical once you have kids or own property." },
  { keywords:["health insurance","health plan","open enrollment","medical"], topic:"insurance",
    q:"How does health insurance work after getting married?",
    a:"Marriage is a qualifying life event. You have 30–60 days to join each other's employer health plans without waiting for open enrollment. Compare both plans on premiums, deductibles, copays, and network. Adding a spouse to an employer plan is often but not always cheaper than keeping two separate plans.",
    tip:"Don't miss the enrollment window. It closes 30–60 days after the wedding and you won't get another chance until open enrollment." },
  { keywords:["auto insurance","car insurance","bundle","vehicle"], topic:"insurance",
    q:"Should we combine auto insurance?",
    a:"Almost certainly yes. Married driver discounts, multi-car policies, and the stability signal marriage sends to insurers saves couples $300–$600/year on average. Call and request a married household requote within 30 days — most insurers don't apply discounts automatically.",
    tip:"Bundling auto with renters or homeowners insurance typically adds another 5–15% discount on top." },
  { keywords:["life insurance","term life","coverage","death benefit"], topic:"insurance",
    q:"How much life insurance do we need?",
    a:"Common guideline: 10–12x your annual income each. Most employer plans provide 1–2x — a significant gap. A healthy 30-year-old can get $500K of 20-year term coverage for $20–$25/month. If either of you would struggle financially without the other's income, you almost certainly need more than your employer provides.",
    tip:"Policygenius shops 30+ insurers at once and typically takes 5 minutes to get quotes." },
  { keywords:["roth ira","ira","retirement","invest","401k"], topic:"future",
    q:"How should we handle retirement accounts together?",
    a:"Each of you can contribute $7,000/year to a Roth IRA in 2024 — $14,000 combined. Start with whoever is in the lower tax bracket; their Roth grows more efficiently. Next: make sure both are capturing the full employer 401(k) match. Then max IRAs, then max 401(k)s.",
    tip:"A non-working spouse can still contribute to a spousal IRA funded by the working spouse's income." },
  { keywords:["home","house","buy","mortgage","property"], topic:"future",
    q:"What should we know about buying a home together?",
    a:"Lenders use the lower of your two credit scores and look at your combined debt-to-income ratio (target under 43%). Get pre-approved before house hunting — it clarifies your real budget and makes your offers more competitive. If one score is dragging things down, consider applying in only the higher-score partner's name.",
    tip:"Each 50-point score improvement on the lower score can meaningfully reduce your interest rate." },
  { keywords:["kids","children","baby","childcare","cost of kids"], topic:"future",
    q:"What does having a child actually cost?",
    a:"Year one alone: $15,000–$25,000. That includes hospital delivery ($5K–$15K with insurance), infant gear ($2K–$4K), and childcare ($1,200–$3,500/month in most cities). The USDA estimates $17,000/year average through age 18 — not including college.",
    tip:"The most overlooked cost: lost income during parental leave. Check both employers' policies before you're pregnant." },
  { keywords:["money date","budget","talk money","financial goals","financial meeting"], topic:"future",
    q:"How should we talk about money together?",
    a:"Schedule a monthly money date — a calm, planned 30-minute check-in. Cover: budget tracking, savings progress, upcoming expenses, and one goal to focus on. Couples who do this consistently build significantly more wealth and report less financial conflict.",
    tip:"Set a recurring calendar event right now. Make it low-pressure. Same time each month. The habit you build in year one tends to stick." },
  { keywords:["partner","link","share","partner sync","invite partner"], topic:"general",
    q:"How does the partner sync feature work?",
    a:"From the chapter map, tap 'Invite Partner.' You'll get a unique link to share with your partner. Once they sign up and accept, you can both see each other's chapter progress and compare answers from the onboarding quiz — side by side.",
    tip:"You can see where you align and where you might want to have a conversation before the wedding." },
];

// ─── Q&A matching ─────────────────────────────────────────────────────────────
function matchQA(query) {
  if (!query.trim()) return null;
  const q = query.toLowerCase();
  const words = q.split(/\s+/);
  let best = null, bestScore = 0;
  for (const item of QA_DATABASE) {
    let score = 0;
    for (const kw of item.keywords) { if (q.includes(kw)) score += kw.split(" ").length * 2; }
    for (const w of words) {
      if (w.length > 3 && item.q.toLowerCase().includes(w)) score += 1;
      if (w.length > 3 && item.a.toLowerCase().includes(w)) score += 0.5;
    }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 1 ? best : null;
}

function personalizeAnswer(item, profile) {
  if (!item || !profile) return item;
  let extra = "";
  if (item.topic === "taxes") {
    if (profile.partnerIncome === "similar" && ["100to200","over200"].includes(profile.income))
      extra = " Given that you both earn similar incomes, you may be in the **marriage penalty** zone — worth running both filing scenarios.";
    else if (["iMore","theyMore","oneIncome"].includes(profile.partnerIncome))
      extra = " With an income gap between you, you're likely to see a **marriage bonus** — filing jointly will probably save you money.";
  }
  if (item.topic === "debt" && ["studentLoans","both"].includes(profile.debt))
    extra = " Since you have student loans, pay close attention to how IDR payments change after marriage — this is especially relevant for your situation.";
  if (item.topic === "future" && profile.children === "planKids")
    extra = " Since you're planning kids, factor $15K–$40K/year childcare into your financial planning now rather than later.";
  if (item.topic === "future" && profile.home === "buyingSoon")
    extra = " Since you're planning to buy soon, prioritizing both credit scores and getting pre-approved early puts you in the strongest position.";
  return { ...item, a: item.a + extra };
}

// ─── Chapters ─────────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    id:"taxes", icon:"📊", label:"Taxes & Filing", color:"#0F2A1E", accent:"#3DBE7A", tagline:"Could save you thousands",
    getCards:(p)=>[
      { emoji:"💰", hookLabel:"THE MARRIAGE BONUS",
        hook: ["iMore","theyMore","oneIncome"].includes(p?.partnerIncome)
          ? "Getting married could save you thousands in taxes — here's the exact math."
          : "If you earn similar salaries, marriage might actually raise your tax bill.",
        body: ["iMore","theyMore","oneIncome"].includes(p?.partnerIncome)
          ? "Here's a real example: if you earn $120,000 and your partner earns $40,000, as singles you'd each pay taxes separately and land in different brackets. Filing jointly, your combined $160,000 gets taxed starting from zero — effectively pulling the higher earner's income down. Couples in this scenario typically save $2,000–$6,000 per year. The bigger the income gap, the bigger the bonus."
          : "Here's the math: if you both earn $95,000, as singles each of you pays taxes in your own bracket. Combined at $190,000 filing jointly, more of your income gets pushed into the 24% bracket instead of the 22% bracket. That extra 2% on tens of thousands of dollars adds up to real money — sometimes $2,000–$4,000 more per year.",
        takeaway:"Use the Tax Calculator in this app (bottom of the chapter map) to run your exact numbers. It takes 30 seconds and gives you a definitive answer.", },
      { emoji:"📝", hookLabel:"UPDATE YOUR WITHHOLDING — NOW",
        hook:"Most couples owe an unexpected tax bill in their first married April. Here's why.",
        body:"Your employer calculates withholding based on your W-4, which still says you're single. When you file jointly for the first time, your combined income may push you into a higher bracket than either of you expected individually. A couple who each withheld correctly as singles can easily find themselves under-withheld by $1,500–$3,000 as a married household. The IRS charges interest and penalties on underpayment. File updated W-4s within 30 days of your wedding — both of you, with both employers.",
        takeaway:"The IRS has a free Withholding Estimator at irs.gov/W4app. Put in both incomes, your filing status, and it tells you exactly what to put on each W-4.", },
      { emoji:"🔀", hookLabel:"JOINT VS. SEPARATE — THE FULL PICTURE",
        hook:"Filing separately isn't just 'worse' — for some couples it's genuinely the right move.",
        body: ["studentLoans","both"].includes(p?.debt)
          ? "Here's the scenario that makes separate filing worth it: if you're on income-driven student loan repayment (IBR, PAYE, SAVE), your monthly payment is calculated as a percentage of your discretionary income. Filing jointly means the IRS sees your combined income — which can double or triple your required payment. Example: on a $80,000 salary with $60,000 in loans on SAVE, your payment might be $200/month filing separately vs. $650/month filing jointly if your spouse earns $100,000. That's $5,400/year in extra loan payments. Compare that to what you'd save on taxes by filing jointly — sometimes separate filing wins."
          : "Married Filing Separately (MFS) has real downsides: you lose the student loan interest deduction, can't contribute to a Roth IRA if you earn over $10,000, lose the Earned Income Credit, and pay more in taxes on Social Security income. The main scenarios where it wins: one spouse has massive medical expenses (deductible above 7.5% of AGI — your individual AGI is lower filing separately), or income-driven student loan repayment as described above.",
        takeaway:"Run both scenarios with a CPA or the IRS Free File tool before your first joint return. The answer is almost always joint — but the exceptions matter.", },
      { emoji:"📊", hookLabel:"THE STANDARD DEDUCTION MATH",
        hook:"The 2024 married standard deduction is $29,200 — and it changes everything about itemizing.",
        body:"As singles you each had a $14,600 standard deduction. Combined as married filing jointly, you get $29,200. Here's when itemizing still makes sense: mortgage interest on a home over roughly $400,000 (at today's rates), significant state and local taxes (capped at $10,000 combined), and charitable giving. A couple with a $600,000 mortgage at 7% interest pays about $42,000 in interest in year one — well above the standard deduction, making itemizing worthwhile. Without a mortgage, most couples should just take the standard deduction without even thinking about it.",
        takeaway:"If you're buying a home soon, the mortgage interest deduction becomes very relevant. Factor it into your home-buying math.", },
      { emoji:"📈", hookLabel:"CAPITAL GAINS — THE MARRIED ADVANTAGE",
        hook:"Married couples get a dramatically larger 0% capital gains bracket.",
        body:"In 2024, you pay zero federal capital gains tax on long-term investment gains if your joint taxable income is under $94,050. For singles, that threshold is only $47,025. This means a married couple can realize nearly $47,000 more in investment gains each year without paying any federal capital gains tax. If you have appreciated stocks, index funds, or real estate you're considering selling, doing so as a married couple in a lower-income year could eliminate your capital gains tax entirely.",
        takeaway:"If either of you has significant unrealized gains in a brokerage account, talk to a tax advisor about the optimal year and filing status to realize them.", },
    ],
    monetization:{ headline:"Get your personalized tax picture", sub:"See exactly how marriage changes your taxes based on your real income numbers.", cta:"Try Vow Pro Free for 7 Days", ctaSub:"Then $49 one-time · Unlock all tools & calculators", type:"upgrade" },
  },
  {
    id:"accounts", icon:"🏦", label:"Bank Accounts", color:"#0F1E2A", accent:"#4C9AF0", tagline:"The money conversation",
    getCards:(p)=>[
      { emoji:"💑", hookLabel:"THE RESEARCH — WHAT STUDIES ACTUALLY SHOW",
        hook:"Couples with fully combined finances are 15% more likely to report being happy in their relationship.",
        body:"A 2023 study from the University of Arizona tracked 230 couples over two years and found that those who pooled all finances reported significantly higher relationship satisfaction and lower financial conflict than those who kept finances separate. The researchers theorized it's not the money itself — it's the signal of commitment and shared future that pooling represents. A separate Cornell study found that couples who discuss finances weekly accumulate 25% more wealth over 10 years than those who avoid the topic.",
        takeaway:"You don't have to merge everything on day one. But the research is clear: more financial transparency = better outcomes, both financially and relationally.", },
      { emoji:"3️⃣", hookLabel:"THE 3-ACCOUNT METHOD — WITH REAL NUMBERS",
        hook:"Here's exactly how to set up the system most financial advisors recommend for married couples.",
        body: p?.partnerIncome === "similar"
          ? "Example: you both earn $80,000/year ($6,667/month each). Your shared monthly expenses — rent $2,800, groceries $600, utilities $200, subscriptions $100, car insurance $150 — total $3,850. You'd each contribute $1,925/month to the joint account. The remaining $4,742/month stays in your personal accounts for personal spending, saving, and investing. No questions asked about what either of you does with your personal money."
          : "Example: you earn $120,000 ($10,000/month), partner earns $60,000 ($5,000/month). Shared expenses total $3,850/month. Instead of splitting equally, split proportionally: you contribute 67% ($2,580) and your partner 33% ($1,270). This feels fairer and prevents resentment. Your personal accounts retain $7,420 and $3,730 respectively.",
        takeaway:"Calculate your actual shared monthly expenses this week. That number is the only thing you need to agree on to set up the system.", },
      { emoji:"🛡️", hookLabel:"EMERGENCY FUND — THE EXACT TARGET",
        hook:"Here's how to calculate your household emergency fund to the dollar.",
        body:"Add up every non-negotiable monthly expense: rent or mortgage payment, utilities (electric, gas, water, internet), minimum debt payments, insurance premiums, groceries, and any subscription services you'd keep even in a crisis. Multiply by 6. That's your target. Example: rent $2,200 + utilities $300 + loan minimums $400 + insurance $350 + groceries $500 = $3,750/month × 6 = $22,500 emergency fund target. Keep it in a high-yield savings account earning 4.5%+ APY — at $22,500, that's over $1,000/year in interest just sitting there.",
        takeaway: ["buyingSoon","ownOne","ownBoth"].includes(p?.home)
          ? "As homeowners, add a separate 1–2% of your home's value per year for maintenance reserves. A $400,000 home = $4,000–$8,000/year in expected repairs."
          : "Open a dedicated joint HYSA this week. Name it something motivating like 'Security Fund.' Automate a monthly transfer into it.", },
      { emoji:"🙈", hookLabel:"FINANCIAL INFIDELITY — THE REAL STATISTICS",
        hook:"In a 2023 survey of 2,000 adults, 43% admitted to hiding a financial account or purchase from their partner.",
        body:"Financial infidelity escalates. It almost never starts with a large secret — it starts with a $200 purchase someone didn't want to explain, then grows from there. A National Endowment for Financial Education study found that 85% of people who committed financial infidelity said it negatively affected their relationship, and 16% said it led to divorce. The most common hidden items: credit card debt ($8,000 average), personal savings accounts ($12,000 average), and online shopping purchases. The antidote isn't surveillance — it's a system where transparency is the default and personal spending money is built in.",
        takeaway:"Monthly money check-ins are the single most effective prevention. 20 minutes, same night each month. Review joint accounts together, share personal account balances voluntarily.", },
      { emoji:"📱", hookLabel:"THE BEST JOINT ACCOUNTS RIGHT NOW",
        hook:"Not all joint accounts are equal — here's how the top options compare in 2024.",
        body:"SoFi Checking + Savings: 4.60% APY on savings, no monthly fees, early direct deposit, $300 welcome bonus for new accounts. Ally Bank: 4.35% APY, no minimums, excellent mobile app, no fees ever. Marcus by Goldman Sachs: 4.40% APY, savings only (no checking), simple interface. Fidelity Cash Management: 2.72% APY but incredible for couples who invest — seamlessly connects to brokerage accounts. For most couples, SoFi or Ally for everyday banking plus a Fidelity account for investing is the optimal setup.",
        takeaway:"Don't keep your emergency fund in a big bank savings account paying 0.01% APY. Moving $20,000 from Chase savings to SoFi savings earns you $920 more per year for doing nothing.", },
    ],
    monetization:{ headline:"Open a free high-yield joint account", sub:"SoFi Money gives couples a joint account with no fees and up to 4.6% APY on savings.", cta:"Open Joint Account →", ctaSub:"Vow partner offer · 5 minutes online", type:"referral", partner:"SoFi" },
  },
  {
    id:"debt", icon:"📋", label:"Debt & Credit", color:"#2A0F1E", accent:"#F04C8C", tagline:"What's yours, mine, and ours",
    getCards:(p)=>[
      { emoji:"✅", hookLabel:"THE DEBT TRANSFER MYTH — AND THE TRUTH",
        hook:"Your partner's $80,000 in student loans doesn't become yours when you marry. But it's more complicated than that.",
        body:"Pre-marital debt stays legally with whoever took it on. If your partner has $80,000 in student loans and you marry them, creditors cannot legally come after you for that debt — your wages cannot be garnished, your credit is not affected, and if you divorce, that debt remains theirs. The real complication: that $80,000 affects your household's cash flow, your ability to save jointly, and potentially your mortgage eligibility. In community property states (CA, TX, AZ, NV, WA, ID, LA, NM, WI), any debt taken on after your wedding date is considered joint — even if your name isn't on it.",
        takeaway:"Have an explicit conversation about each other's full debt picture before getting married. Not to judge — but because it directly affects your shared financial plan.", },
      { emoji:"📉", hookLabel:"THE CREDIT SCORE IMPACT — REAL MORTGAGE NUMBERS",
        hook:"On a $450,000 30-year mortgage, a 100-point score difference costs $96,000 over the life of the loan.",
        body:"Here's the math most couples don't see until it's too late. At a 780 credit score, a $450,000 30-year mortgage at today's rates might carry a 6.8% rate — roughly $2,940/month. At a 680 score (100 points lower), the same loan might be at 7.4% — $3,127/month. That's $187 more per month, $2,244 more per year, and $67,320 more over 30 years. Factor in the higher mortgage insurance premiums often required below 740, and the true gap can exceed $90,000. The fastest ways to improve a credit score: pay down revolving credit card balances (aim for under 30% utilization), dispute any errors on your credit report, and make sure every account is current.",
        takeaway: p?.home === "buyingSoon"
          ? "Check both your scores at annualcreditreport.com today — free, no credit card needed. If either is below 740, spend 6–12 months improving it before applying for a mortgage."
          : "Know both your scores now. This is the single biggest variable you control when it comes to the cost of a future mortgage.", },
      { emoji:"🎓", hookLabel:"STUDENT LOANS AFTER MARRIAGE — THE FULL CALCULATION",
        hook:"Marriage can increase your monthly student loan payment by $400+ per month. Here's exactly how.",
        body: ["studentLoans","both"].includes(p?.debt)
          ? "On the SAVE plan (the most common IDR plan as of 2024), your payment is 5–10% of your discretionary income, calculated using your tax return income. Filing jointly means the IRS sees your combined income. Example: you earn $60,000 with $55,000 in loans on SAVE. Filing single, your payment might be $180/month. If your spouse earns $90,000 and you file jointly, your payment could jump to $580/month — an extra $4,800/year. Before filing your first joint return, run both scenarios. Sometimes the tax savings from filing jointly ($2,000) are less than the increased loan payments ($4,800), making separate filing the better financial choice."
          : "The key mechanics: income-driven repayment plans (IBR, SAVE, PAYE) calculate your payment based on income from your most recent tax return. Filing jointly means higher reported income means higher required payments. This is one of the few situations where married filing separately can genuinely save money — but you have to do the math for your specific loan balance, interest rate, and income.",
        takeaway:"Use the studentaid.gov loan simulator before your first tax season together. Model your payments under joint filing vs. separate filing. The difference can be thousands per year.", },
      { emoji:"⚖️", hookLabel:"JOINT DEBT — WHAT YOU'RE ACTUALLY SIGNING",
        hook:"When you co-sign anything — a mortgage, car loan, credit card — you are 100% responsible for 100% of it.",
        body:"Joint debt is not split-responsibility debt. It's full responsibility for each party. If your spouse stops making mortgage payments, the bank can pursue you for the full balance — every dollar. This remains true even after divorce in most states, unless a court specifically assigns the debt AND the creditor agrees (which they often won't — courts can't change your credit contract). A common divorce scenario: the court orders your ex to pay the joint car loan, they don't, and the late payments appear on your credit report anyway. Before co-signing anything, ask yourself: 'If my partner was completely unable to pay this tomorrow, could I cover the full payment alone?'",
        takeaway:"Only go joint on debt you're financially prepared to own entirely by yourself. For everything else, consider keeping debt in one name and just sharing the benefit (e.g., one spouse's car that both use).", },
      { emoji:"🏠", hookLabel:"MORTGAGES — HOW LENDERS ACTUALLY EVALUATE COUPLES",
        hook:"Lenders use the lower credit score but add both incomes. Understanding this changes your strategy.",
        body:"When a married couple applies for a mortgage together, lenders pull all three credit scores for each person (Equifax, Experian, TransUnion), take the middle score for each person, and then use the lower of those two middle scores for the loan. Meanwhile, they add both gross incomes together to calculate your debt-to-income ratio (DTI). The implication: if one partner has a 820 score and one has a 660, your loan is priced as if you're a 660 borrower — but with both incomes. Sometimes the optimal strategy is for only the higher-score partner to apply, even if it means using only one income for qualification. A lower rate can easily outweigh the slightly smaller loan you qualify for.",
        takeaway:"Ask a mortgage broker to model both scenarios — joint application vs. single applicant — before you apply. The difference in interest rate can be more valuable than the higher loan amount.", },
    ],
    monetization:{ headline:"Check both your credit scores free", sub:"See exactly where you each stand before applying for anything together.", cta:"Check My Score Free →", ctaSub:"No credit card needed · Via Experian", type:"referral", partner:"Experian" },
  },
  {
    id:"legal", icon:"⚖️", label:"Legal & Documents", color:"#1E0F2A", accent:"#A04CF0", tagline:"The paperwork nobody talks about",
    getCards:(p)=>[
      { emoji:"📜", hookLabel:"PRENUPS — WHAT THEY ACTUALLY COVER",
        hook:"A prenuptial agreement isn't a divorce plan. It's a transparency document.",
        body:"A prenup can cover: how pre-marital assets are classified (your $50,000 investment account stays yours), what happens to a business either of you owns or starts during the marriage, how you'll handle debt you each bring in, what happens if one partner leaves work to raise children (spousal support provisions), and inheritance rights. What a prenup cannot do: dictate child custody or child support (courts won't enforce these), waive rights to government benefits, include non-financial terms (like who does chores), or be signed under duress. Average cost through separate attorneys: $2,500–$7,500. Through HelloPrenup or similar: $599–$1,500. Timeline: must be signed before the wedding — ideally 30+ days before to avoid claims of duress.",
        takeaway: ["ownOne","ownBoth"].includes(p?.home)
          ? "Since you own property, a prenup that explicitly classifies it as pre-marital separate property is the clearest legal protection. Without one, appreciation during the marriage may be considered marital property."
          : "Most worth considering if either of you owns a business, has over $50K in assets or debt, has children from a previous relationship, or expects a significant inheritance.", },
      { emoji:"📌", hookLabel:"BENEFICIARY UPDATES — THE COMPLETE CHECKLIST",
        hook:"These accounts pass directly to whoever you named — bypassing your will entirely.",
        body:"Accounts to update immediately after marriage: (1) 401(k) and 403(b) — log into your HR portal or benefits website; (2) Traditional and Roth IRAs — log into your brokerage (Fidelity, Vanguard, Schwab, etc.); (3) Life insurance policies — contact your insurer or HR; (4) Bank accounts with TOD (Transfer on Death) designations; (5) Brokerage accounts with TOD; (6) HSA accounts. A real example of why this matters: a woman in Texas died without updating her 401(k) beneficiary from her mother to her husband of 7 years. Her $340,000 retirement account went entirely to her mother because beneficiary designations override wills — the husband received nothing from that account.",
        takeaway:"Set a phone reminder right now: 'Update beneficiaries — week after honeymoon.' It takes 5 minutes per account. Do all of them in one sitting.", },
      { emoji:"📛", hookLabel:"NAME CHANGE — THE COMPLETE TIMELINE",
        hook:"The name change process takes 6–10 weeks total if you do it right. Here's the exact sequence.",
        body:"Step 1 — Social Security (Week 1): Fill out Form SS-5, bring your marriage certificate and ID to your local SSA office or mail it in. Takes 2–4 weeks to process. Step 2 — Driver's License (Week 3–4): Go to the DMV with your updated Social Security card (or receipt), marriage certificate, and current license. Step 3 — Passport (Week 4–6): If renewed within a year of issue, use Form DS-5504. Otherwise Form DS-82 by mail. Expedited processing: $60 extra, 5–7 weeks. Standard: 8–11 weeks. Step 4 — Everything else: Banks, employer HR, voter registration, Social Security-connected accounts, utilities, credit cards, medical providers. The order matters because each step requires proof from the previous one.",
        takeaway:"If you're planning international travel within 3 months of your wedding, either don't change your name until after, or get your passport expedited immediately after your SSA appointment.", },
      { emoji:"⚖️", hookLabel:"WILLS & ESTATE BASICS — WHAT HAPPENS WITHOUT ONE",
        hook:"In most states, dying without a will doesn't mean everything goes to your spouse automatically.",
        body:"Intestate succession laws vary dramatically by state. In many states, if you die without a will and have living parents or children from a previous relationship, your spouse doesn't automatically receive everything. Example: in some states, your spouse receives 50% and your parents receive 50% of your estate. In community property states, only your half of community property goes through probate — but separate property gets distributed under intestacy rules that may not reflect your wishes. Beyond a will, a complete estate plan includes: (1) Durable Power of Attorney — designates who manages your finances if you're incapacitated; (2) Healthcare Directive / Living Will — your medical preferences; (3) Healthcare Proxy — who makes medical decisions for you. Services like Trust & Will or Tomorrow handle all three for $150–$300.",
        takeaway: ["haveKids","planKids"].includes(p?.children)
          ? "With children involved, a will that names a guardian is non-negotiable. Without it, a court decides who raises your children — possibly not who you'd choose."
          : "Do this in your first year of marriage. If you own property or have savings, it's urgent.", },
      { emoji:"🔐", hookLabel:"TITLE & PROPERTY — HOW YOU OWN MATTERS",
        hook:"There are three ways to own property as a couple. Each has completely different legal implications.",
        body:"Joint Tenancy with Right of Survivorship (JTWROS): if one owner dies, the property automatically passes to the surviving owner without probate. Most common for married couples. Tenancy in Common: each owner has a divisible share that passes through their estate (not automatically to the other owner). Used when couples want to leave their share to children from prior relationships. Community Property (in 9 states): property acquired during marriage is automatically 50/50 regardless of who paid. How you hold title affects what happens at death, in divorce, and when you sell. If you already own a home individually and want to add your spouse, a quit claim deed transfers ownership — but be careful about triggering reassessment in some states.",
        takeaway:"When you buy property together, ask your real estate attorney which title structure makes the most sense for your situation before closing.", },
    ],
    monetization:{ headline:"Start your prenup — in plain English", sub:"HelloPrenup walks you through a legally valid prenuptial agreement from home. No attorney meetings required.", cta:"Start Your Prenup →", ctaSub:"From $599 per couple · Exclusive Vow discount applied", type:"referral", partner:"HelloPrenup", badge:"MOST POPULAR" },
  },
  {
    id:"insurance", icon:"🛡️", label:"Insurance", color:"#2A1E0F", accent:"#F0A84C", tagline:"What to combine and when",
    getCards:(p)=>[
      { emoji:"🏥", hookLabel:"HEALTH INSURANCE — HOW TO COMPARE PLANS",
        hook:"The cheapest premium is almost never the cheapest plan. Here's how to actually compare.",
        body:"When comparing health plans after marriage, calculate Total Annual Cost: (monthly premium × 12) + expected out-of-pocket costs. A plan with a $200/month premium and a $6,000 deductible costs $8,400 before insurance really kicks in. A $400/month plan with a $1,500 deductible costs $6,300 before full coverage — and may be cheaper if you use healthcare regularly. Key factors: (1) Is your current doctor in-network? Switching doctors is often the hidden cost people forget. (2) Does it cover the prescriptions you take? Check the formulary. (3) If you're planning to have children, compare maternity coverage carefully — out-of-pocket costs for delivery range from $3,000 to $15,000 depending on the plan.",
        takeaway: ["planKids","haveKids"].includes(p?.children)
          ? "Since kids are part of your plan, add the cost of a dependent to each plan's premium, and compare maternity out-of-pocket maximums carefully. The difference can be $10,000+."
          : "Don't just compare premiums. Compare Total Annual Cost under both your typical usage and a worst-case scenario (major illness or injury).", },
      { emoji:"🚗", hookLabel:"AUTO INSURANCE — THE EXACT SAVINGS",
        hook:"The average married couple saves $434 per year on auto insurance just by being married.",
        body:"Insurance companies view married drivers as statistically less risky — they file fewer claims, drive more carefully, and are more financially stable. Here's what you can stack: Multi-vehicle discount (two cars on one policy): saves $150–$300/year. Married driver discount: saves $100–$200/year. Bundle with renters/homeowners: saves another 5–15% on both. Loyalty discount if you've been with the same insurer: saves $50–$150/year. Total potential savings: $400–$700/year. Important: always get competing quotes. The married discount varies dramatically by insurer — Progressive might save you more than Geico for your specific situation.",
        takeaway:"Get quotes from at least 3 insurers within 30 days of your wedding. Use the same coverage levels for each quote so you're comparing apples to apples.", },
      { emoji:"🔒", hookLabel:"LIFE INSURANCE — WHAT YOU ACTUALLY NEED",
        hook:"Here's how to calculate your exact life insurance need in 5 minutes.",
        body: ["haveKids","planKids"].includes(p?.children)
          ? "The DIME method for couples with children: D (Debt) = all shared debt including mortgage. I (Income) = 10–12x your annual income (years your family needs income replacement). M (Mortgage) = remaining balance (already in debt, but separate for clarity). E (Education) = estimated college costs per child ($100,000–$300,000). Example: $350,000 mortgage + $90,000 annual income × 10 + $200,000 for two kids' education = $1,450,000 in coverage. A 35-year-old can get a $1.5M 20-year term policy for about $65–$80/month."
          : "For couples without kids, the simpler income replacement method: how many years would your partner need to maintain their lifestyle if your income disappeared? Multiply your annual income by that number and add any shared debt. Example: you earn $90,000, have a $300,000 mortgage, and your partner would need 10 years to rebuild financially = $900,000 + $300,000 = $1.2M in coverage. A 30-year-old gets this for about $35–$45/month as a 20-year term policy.",
        takeaway:"Term life insurance is almost always the right choice for couples — it's pure protection, not investment. Get quotes from multiple providers before buying.", },
      { emoji:"🏠", hookLabel:"RENTERS & HOMEOWNERS — THE CONSOLIDATION MATH",
        hook:"Two separate renters insurance policies at $20/month each cost $480/year. One joint policy costs $25/month.",
        body:"Most renters insurance policies cover: personal property (up to your policy limit, typically $15,000–$30,000), liability protection ($100,000+), and additional living expenses if your apartment becomes uninhabitable. When you consolidate to one joint policy post-marriage: update the named insureds on the policy to include both spouses, recalculate your personal property coverage (two people's stuff is worth more than one), and increase your liability coverage to $300,000 — it's usually only $10–$15 more per month and covers both of you. If you're buying a home, homeowners insurance is required by your lender. Bundle it with your auto insurance for a 5–15% discount on both.",
        takeaway:"Call your insurer the week after your honeymoon. Adding a spouse and consolidating policies takes one phone call and typically saves $100–$200/year.", },
      { emoji:"🩺", hookLabel:"DISABILITY INSURANCE — THE MOST OVERLOOKED COVERAGE",
        hook:"You're 3x more likely to become disabled during your working years than to die during them. Most couples have no coverage.",
        body:"Social Security disability benefits average $1,483/month — probably not enough to cover your rent. Most employer short-term disability plans cover 60% of your salary for 3–6 months. Long-term disability (LTD) coverage — which kicks in after short-term ends and can cover you for years — is where most people are underinsured. A 35-year-old earning $80,000 should have an LTD policy covering at least $4,000/month (60% of income) for a benefit period to age 65. Individual LTD policies cost $100–$300/month depending on your occupation and health. As a couple, if one income disappeared for a year, could you cover your bills? If not, LTD insurance belongs on your list.",
        takeaway:"Check your employer's LTD benefit first — many provide 60% income replacement as a standard benefit. If yours doesn't, or if it's inadequate, get an individual policy.", },
    ],
    monetization:{ headline:"Compare life insurance in 5 minutes", sub:"Policygenius shops 30+ insurers at once. Most couples get covered for less than $30/month.", cta:"Get My Quote Free →", ctaSub:"No spam. No obligation. · Via Policygenius", type:"referral", partner:"Policygenius" },
  },
  {
    id:"future", icon:"🌱", label:"Future Planning", color:"#0F2A2A", accent:"#4CF0D8", tagline:"Building a life together",
    getCards:(p)=>[
      { emoji:"📈", hookLabel:"RETIREMENT — THE MARRIED COUPLE'S ADVANTAGE",
        hook:"A married couple who maxes both Roth IRAs from age 30 to 65 ends up with $1.4M more than a single person.",
        body:"Here's the full retirement priority order for married couples: (1) Both contribute enough to get full employer 401(k) match — this is a 50–100% instant return, nothing beats it. (2) Max both Roth IRAs — $7,000 each = $14,000/year growing tax-free. At 7% average returns, $14,000/year from age 30 to 65 grows to approximately $1.9M tax-free. (3) Max both 401(k)s — $23,000 each = $46,000/year in pre-tax contributions. (4) Taxable brokerage account for any additional investing. If one partner doesn't work, a Spousal IRA allows the working spouse to fund both accounts — you don't need to have earned income to contribute to an IRA if your spouse does.",
        takeaway: p?.income === "under50"
          ? "At lower incomes, the Retirement Saver's Credit could give you a tax credit worth up to $1,000 per person just for contributing to a retirement account. Check IRS Form 8880."
          : "If either of you has a high-deductible health plan, max your HSA ($8,300 for families in 2024) before the taxable brokerage account. HSAs are the only triple-tax-advantaged account in existence.", },
      { emoji:"🏡", hookLabel:"BUYING A HOME TOGETHER — THE FULL FINANCIAL PICTURE",
        hook:"The true cost of homeownership is 1.5–2x the mortgage payment. Most first-time buyers don't know this.",
        body: p?.home === "buyingSoon"
          ? "Since you're planning to buy soon, here's what to budget beyond the mortgage: property taxes (1–2% of home value/year = $4,000–$8,000/year on a $400K home), homeowners insurance ($1,200–$2,400/year), HOA fees if applicable ($200–$800/month in many communities), and maintenance (budget 1% of home value/year = $4,000/year on a $400K home). A $400,000 home at 7% interest with 20% down costs $2,128/month in mortgage — but $2,900–$3,400/month all-in with the above. Make sure you're qualifying and budgeting for the real number, not just the mortgage payment."
          : "For context on the rent vs. buy decision: the rule of thumb is buy if the price-to-rent ratio in your city is under 20 (home price ÷ annual rent). In San Francisco it's 40+ (strongly favors renting). In Cleveland it's 10 (strongly favors buying). In NYC it's 25–30. This ratio changes everything about whether buying makes financial sense in your specific market.",
        takeaway: p?.home === "buyingSoon"
          ? "Get pre-approved by at least two lenders to compare rates — even a 0.25% rate difference on a $400K mortgage saves $20,000 over 30 years. Shopping lenders doesn't hurt your credit score if done within a 45-day window."
          : "The best time to improve your mortgage eligibility is 12–18 months before you want to buy. Pay down debt, boost credit scores, and save aggressively for a down payment.", },
      { emoji:"👶", hookLabel:"THE COMPLETE COST OF HAVING CHILDREN",
        hook:"The average American family spends $233,610 raising one child from birth to age 17. Here's where it goes.",
        body: ["planKids","haveKids"].includes(p?.children)
          ? "Breaking down the biggest costs: Childcare is the most shocking — infant care in major cities costs $18,000–$42,000 per year (yes, per year). Many families spend more on childcare than on rent. Healthcare adds $5,000–$10,000 in the first year including delivery, pediatric visits, and unexpected costs. Food and clothing costs roughly $3,000–$5,000/year in early childhood. The frequently forgotten cost: lost income during parental leave. If one parent takes 6 months at 60% pay on a $80,000 salary, that's $16,000 in lost income in year one alone. The financial preparation: 6 months of expenses saved before the baby arrives, plus the delivery deductible in cash, plus 3 months of childcare costs pre-paid."
          : "Even if kids are years away, here's why to plan now: childcare costs have increased 42% since 2019. In most major cities, infant care exceeds a college tuition payment. Building your financial cushion now — emergency fund, low debt, strong savings habit — is the single best thing you can do to prepare for eventual parenthood.",
        takeaway:"Check both employers' parental leave policies today. The gap between 6 weeks unpaid and 20 weeks paid is enormous — $30,000+ in income difference. Some employers offer additional paid leave if you ask during benefits enrollment.", },
      { emoji:"🗓️", hookLabel:"THE MONTHLY MONEY DATE — A SYSTEM THAT WORKS",
        hook:"Couples who do monthly financial check-ins accumulate 27% more wealth over 10 years than those who don't.",
        body:"Here's the exact agenda for a productive monthly money date: (1) Bank account review — 5 min. Look at joint checking and savings. Are you on track? Any surprises? (2) Budget vs. actual — 5 min. Did you overspend anywhere? Why? No judgment, just awareness. (3) Savings progress — 5 min. Emergency fund, retirement, specific goals. How close are you? (4) One financial goal to focus on this month — 5 min. Specific, actionable, agreed-upon. (5) Upcoming big expenses — 5 min. Anything in the next 30–60 days that needs planning? Total: 25 minutes. The research shows it's not the depth of the conversation but the consistency. Monthly beats quarterly by a large margin.",
        takeaway:"Set a recurring calendar event right now — before you finish this chapter. Same night each month. Call it something you'll look forward to, not dread.", },
    ],
    monetization:{ headline:"Talk to a financial planner built for couples", sub:"A 30-minute intro session with a vetted CFP who specializes in newlywed financial planning.", cta:"Book a Free Intro Call →", ctaSub:"Matched to advisors in your area · First session free", type:"advisor" },
  },
  {
    id:"social_security", icon:"🏛️", label:"Social Security", color:"#1A1A2E", accent:"#6C8EF0", tagline:"The $500,000 decision most couples ignore",
    getCards:(p)=>[
      { emoji:"💵", hookLabel:"HOW SPOUSAL BENEFITS WORK",
        hook:"As a married person, you're entitled to up to 50% of your spouse's Social Security benefit — even if you never worked.",
        body:"Social Security spousal benefits are one of the most valuable and least understood benefits available to married couples. Here's how it works: once your spouse claims their Social Security benefit, you become eligible for up to 50% of their full retirement age (FRA) benefit — regardless of your own work history. Example: your spouse has a $3,000/month Social Security benefit at full retirement age. You're entitled to up to $1,500/month as a spousal benefit, even if you never paid into Social Security yourself. This is especially significant if one partner took significant time off work to raise children or had a lower-earning career.",
        takeaway:"If one of you earns significantly more, maximizing the higher earner's Social Security benefit becomes a shared financial priority — not just a personal one.", },
      { emoji:"⏰", hookLabel:"WHEN TO CLAIM — THE $100,000+ DECISION",
        hook:"Claiming Social Security at 62 vs. 70 is a difference of 77% in your monthly benefit. For a married couple, this decision can be worth over $200,000.",
        body:"Your Social Security benefit grows approximately 8% per year for every year you delay claiming between age 62 and 70. At 62: you get 70% of your full benefit. At 67 (full retirement age for those born after 1960): 100%. At 70: 124–132% of your full benefit. For a married couple, the optimal strategy is almost always: the lower earner claims early (to provide some income), and the higher earner delays as long as possible, ideally to 70. Why? Because when one spouse dies, the surviving spouse receives the higher of the two benefits permanently. By maximizing the higher earner's benefit, you're also maximizing the survivor's income for potentially decades.",
        takeaway:"Don't make your Social Security claiming decision based on when you 'need the money.' Model the break-even point: delaying from 62 to 70 breaks even around age 80, which is close to average life expectancy.", },
      { emoji:"💍", hookLabel:"SURVIVOR BENEFITS — WHAT YOUR SPOUSE GETS IF YOU DIE",
        hook:"A surviving spouse can receive 100% of their deceased spouse's Social Security benefit. This makes the higher earner's benefit a life insurance policy.",
        body:"Survivor benefits kick in at age 60 (50 if disabled). The surviving spouse receives the higher of their own benefit or their deceased spouse's benefit — whichever is larger. Example: you have a $1,800/month benefit and your spouse has a $3,200/month benefit. If your spouse dies first, your benefit jumps from $1,800 to $3,200 — an extra $1,400/month, $16,800/year, for the rest of your life. This is why financial planners strongly encourage the higher earner to delay claiming as long as possible. Every year the higher earner delays from 62 to 70 increases the potential survivor benefit by 8%.",
        takeaway:"Think of the higher earner's Social Security delay as the cheapest life insurance available. Eight more years of working before claiming can provide $300–$500 more per month to a surviving spouse for decades.", },
      { emoji:"📋", hookLabel:"DIVORCE & SOCIAL SECURITY — WHAT MOST PEOPLE DON'T KNOW",
        hook:"If you were married for at least 10 years, you may be entitled to your ex-spouse's Social Security benefits even after divorce.",
        body:"This applies even if your ex has remarried. If your marriage lasted 10+ years and you're currently unmarried, you can claim spousal benefits based on your ex's record — up to 50% of their FRA benefit. This doesn't reduce your ex's benefit in any way. Divorced surviving spouse benefits (if your ex dies) are available at 60. The 10-year rule is a hard line: a marriage of 9 years and 11 months doesn't qualify. This provision is particularly relevant for couples with significant income disparity where one partner sacrificed career earnings for the relationship.",
        takeaway:"If you're in a long-term relationship and approaching the 10-year mark, this is worth knowing before any major decisions about the marriage.", },
    ],
    monetization:{ headline:"Model your Social Security strategy", sub:"A fee-only financial advisor can show you exactly when each of you should claim to maximize lifetime income.", cta:"Book a Strategy Session →", ctaSub:"Free 30-min intro · Fee-only, no commissions", type:"advisor" },
  },
  {
    id:"estate", icon:"📜", label:"Estate Planning", color:"#1A0F0F", accent:"#E07040", tagline:"The documents you hope you never need",
    getCards:(p)=>[
      { emoji:"📄", hookLabel:"THE FOUR DOCUMENTS EVERY MARRIED COUPLE NEEDS",
        hook:"A complete estate plan isn't just a will. It's four documents that cover you in four different crisis scenarios.",
        body:"(1) Last Will & Testament: Directs where your assets go after death. Without it, your state decides — possibly not how you'd want. Also names a guardian for minor children. (2) Durable Power of Attorney (Financial): Designates who manages your bank accounts, pays your bills, and handles financial decisions if you're incapacitated but alive — a coma, severe illness, accident. Without this, your spouse may need a court-ordered conservatorship just to access joint accounts. (3) Healthcare Directive / Living Will: Documents your medical preferences — life support, resuscitation, organ donation. Removes an agonizing decision from your family during the worst moment of their lives. (4) Healthcare Proxy / Medical Power of Attorney: Names who makes medical decisions for you when you can't. Without this document, your spouse may not have automatic legal authority in some states.",
        takeaway:"Services like Trust & Will ($199/couple), Tomorrow (free basic), or Fabric handle all four documents online in under 2 hours. If you have significant assets or business interests, use an estate attorney.", },
      { emoji:"🏠", hookLabel:"WHAT HAPPENS TO YOUR HOME WHEN YOU DIE",
        hook:"How you hold title to your home determines whether your spouse gets it immediately or spends 18 months in probate.",
        body:"If you own your home as Joint Tenants with Right of Survivorship (JTWROS) — the most common form for married couples — the property automatically transfers to the surviving spouse at death, bypassing probate entirely. If you own as Tenants in Common (common in second marriages), your share goes through your estate and could be tied up in probate for 12–24 months while your surviving spouse still lives there. The fix is simple: check your deed and make sure it says 'Joint Tenants with Right of Survivorship.' If it doesn't — or if you're unsure — a real estate attorney can update your title for $300–$500.",
        takeaway:"Pull out your deed and read how ownership is listed. This is one of the simplest and highest-impact things you can do in your first year of marriage.", },
      { emoji:"💼", hookLabel:"TRUSTS — WHEN YOU ACTUALLY NEED ONE",
        hook:"Most married couples don't need a trust. But if any of these apply to you, you probably do.",
        body:"You likely need a revocable living trust if: (1) Your total assets exceed $1–2 million (varies by state), as probate costs and delays become significant. (2) You own real estate in multiple states — without a trust, each state requires its own probate proceeding. (3) You have children from a previous relationship and want to ensure your assets ultimately go to them. (4) You want to provide for a beneficiary with special needs without disqualifying them from government benefits. (5) You want to maintain privacy — wills become public record through probate, trusts do not. Revocable living trusts are typically $1,500–$3,000 through an estate attorney. The trust holds your assets during your lifetime and distributes them according to your instructions at death — without probate.",
        takeaway:"If none of those apply to you, a simple will + JTWROS titling on your home handles most married couples' estate planning needs.", },
      { emoji:"💰", hookLabel:"THE ESTATE TAX — WHO ACTUALLY PAYS IT",
        hook:"In 2024, the federal estate tax only applies to estates over $13.61 million. 99.9% of Americans will never pay it.",
        body:"The federal estate tax is one of the most misunderstood concepts in personal finance. Here's the reality: the exemption is $13.61 million per person, $27.22 million per couple with proper planning. Only estates larger than this pay any federal estate tax — and it applies only to the amount above the exemption. Additionally, the unlimited marital deduction means you can leave any amount to a U.S. citizen spouse with zero estate tax, regardless of the estate size. Most people's estate planning concern isn't the estate tax — it's avoiding probate, ensuring their wishes are followed, and protecting a surviving spouse or children.",
        takeaway:"Unless your combined net worth is approaching $10M+, estate tax planning is not your priority. Will, POA, and beneficiary updates are.", },
      { emoji:"🎁", hookLabel:"GIFTING STRATEGIES — TRANSFERRING WEALTH TAX-FREE",
        hook:"In 2024, you can gift $18,000 per person per year completely tax-free. As a married couple, that doubles to $36,000.",
        body:"The annual gift tax exclusion allows each person to give up to $18,000 to any individual — children, parents, friends — without any gift tax consequences and without reducing your lifetime exemption. A married couple can give $36,000 per recipient per year. Example: if you want to help your parents or children financially, you can transfer $36,000/year to each of them completely tax-free. Over 10 years, that's $360,000 transferred tax-free per recipient. This strategy is most valuable for high-net-worth couples who want to reduce the size of their taxable estate while helping family members during their lifetime.",
        takeaway:"You don't need to file any paperwork for gifts under $18,000 per recipient per year. Gifts above this amount require a gift tax return (Form 709) — though you won't owe tax unless you've exceeded your $13.61M lifetime exemption.", },
    ],
    monetization:{ headline:"Get your estate plan done this week", sub:"Trust & Will creates legally valid wills, POAs, and healthcare directives for couples in under 2 hours.", cta:"Start Your Estate Plan →", ctaSub:"$199 per couple · Attorney-reviewed · Vow discount applied", type:"referral", partner:"Trust & Will" },
  },
  {
    id:"business", icon:"💼", label:"Business & Marriage", color:"#1A2A0F", accent:"#8ECC4C", tagline:"When one of you is an entrepreneur",
    getCards:(p)=>[
      { emoji:"🏢", hookLabel:"IS YOUR SPOUSE'S BUSINESS MARITAL PROPERTY?",
        hook:"In most states, a business started during marriage is considered marital property — even if only one spouse works in it.",
        body:"Business ownership in marriage is one of the most legally complex areas of family law. The general rule: a business started during marriage using marital funds or marital labor is marital property, subject to equitable division in divorce. This is true even if your spouse never worked in the business, never owned shares, and has no idea how it operates. The valuation methods for business division include: book value (balance sheet), earnings multiple (most common for operating businesses), and discounted cash flow. A business generating $200,000/year in profit might be valued at $600,000–$1,000,000 in a divorce — representing a major asset subject to division.",
        takeaway:"If either of you owns a business or plans to start one, a prenuptial agreement that classifies the business as separate property (or specifies a division methodology) is the single most important document you can have.", },
      { emoji:"💰", hookLabel:"TAX ADVANTAGES FOR ENTREPRENEURIAL COUPLES",
        hook:"A married couple where one spouse runs a business has access to significant tax strategies unavailable to single business owners.",
        body:"Key strategies: (1) Employing your spouse: If you legitimately employ your spouse in your business, their salary is deductible. More importantly, you can provide them with health insurance, which becomes deductible as a business expense — potentially saving $5,000–$15,000/year in taxes. (2) Solo 401(k) for the self-employed spouse: Contribution limits up to $69,000/year ($76,500 if over 50) — dramatically more than an employee's 401(k). (3) HSA eligibility through a self-employed health plan: If your spouse's employer health insurance doesn't cover the business owner, they can get a high-deductible plan and max an HSA. (4) Home office deduction: If one spouse works from home, a portion of rent/mortgage interest, utilities, and insurance becomes deductible.",
        takeaway:"A CPA who specializes in small business + personal tax planning is worth $3,000–$5,000/year in fees for entrepreneurial couples — they typically find $10,000–$30,000 in legal tax savings.", },
      { emoji:"⚖️", hookLabel:"PROTECTING A PRE-EXISTING BUSINESS IN MARRIAGE",
        hook:"A business you owned before marriage can still become partially marital property without a prenup.",
        body:"Even a pre-marital business can acquire 'marital character' during your marriage in two ways: (1) Active appreciation: if the business grows in value during the marriage due to your spouse's direct or indirect contributions (supporting you, managing the household, allowing you to focus on work), courts in many states consider the increase in value to be marital property. (2) Commingling: if you mix personal and business finances — paying personal bills from business accounts, paying business expenses from joint accounts — you blur the line between separate and marital property. A prenup that specifies 'all appreciation in my business during the marriage remains my separate property' is the most reliable protection.",
        takeaway:"Keep meticulous business finances separate from personal finances. Separate business bank accounts, separate credit cards, clear documentation of salaries you pay yourself. This alone significantly reduces commingling risk.", },
      { emoji:"🤝", hookLabel:"RUNNING A BUSINESS TOGETHER — THE REAL RISKS",
        hook:"About 30% of small businesses are co-owned by married couples. The ones that thrive have very different structures than the ones that fail.",
        body:"The research on couple-owned businesses is clear: the ones that succeed have explicit role definitions (who owns which decisions), separate operational domains (you don't both manage the same team), agreed-upon compensation (salaries, not just draws), and a clear mechanism for business disputes that doesn't become a marriage dispute. The ones that struggle blur every line. Practical structures that work: one spouse is CEO, one is COO with clearly different domains. Or one spouse owns the operating business while the other has equity but a different primary career. The business partnership agreement and buy-sell agreement are as important as your marriage license when you co-own a business.",
        takeaway:"If you're starting or already running a business together, write a formal partnership agreement — even a simple one. Spell out who decides what, how profits are distributed, and what happens if you ever want to exit the business (together or separately).", },
    ],
    monetization:{ headline:"Protect your business with a prenup", sub:"HelloPrenup's business protection plan is specifically designed for entrepreneurs and business owners.", cta:"Get Business Protection →", ctaSub:"From $799 · Includes business asset classification", type:"referral", partner:"HelloPrenup" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function VAvatar({ size=40, pulse=false }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`conic-gradient(from 180deg, ${C.gold}, ${C.goldLight}, ${C.gold})`,
      display:"flex", alignItems:"center", justifyContent:"center",
      animation: pulse ? "pulse 2.5s ease-in-out infinite, glow 2.5s ease-in-out infinite" : "none",
      boxShadow:`0 0 ${size*.45}px ${C.gold}33` }}>
      <span style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:600, fontSize:size*.38, color:C.navy }}>V</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width:20, height:20, border:`2px solid ${C.creamFaint}`,
      borderTop:`2px solid ${C.gold}`, borderRadius:"50%", animation:"spin .8s linear infinite" }} />
  );
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const { error: err } = mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onAuth();
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"40px 24px",
      background:`radial-gradient(ellipse at 40% 30%, #1C2E42 0%, ${C.navy} 65%)`,
      position:"relative", overflow:"hidden" }}>
      {[220,380,540].map((r,i)=>(
        <div key={i} style={{ position:"absolute", width:r, height:r, borderRadius:"50%",
          border:`1px solid ${C.gold}${["18","10","08"][i]}`,
          top:"50%", left:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }} />
      ))}
      <div style={{ maxWidth:400, width:"100%", textAlign:"center", animation:"fadeUp .8s ease forwards", position:"relative" }}>
        <VAvatar size={60} pulse />
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:68, fontWeight:300,
          letterSpacing:"-3px", color:C.cream, marginTop:16, lineHeight:.9 }}>Vow</h1>
        <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontStyle:"italic",
          color:C.gold, marginTop:10 }}>The things your wedding planner won't tell you.</p>

        <div style={{ display:"flex", gap:8, marginTop:36, marginBottom:24,
          background:C.creamFaint, borderRadius:100, padding:4 }}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>{ setMode(m); setError(""); }}
              style={{ flex:1, padding:"10px", borderRadius:100, border:"none", cursor:"pointer",
                background: mode===m ? C.gold : "transparent",
                color: mode===m ? C.navy : `${C.cream}66`,
                fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif", transition:"all .2s" }}>
              {m==="login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="your@email.com" type="email"
            style={{ width:"100%", padding:"14px 20px", borderRadius:100,
              background:C.navyMid, border:`1px solid ${C.creamFaint}`,
              color:C.cream, fontSize:14, fontFamily:"'DM Sans',sans-serif",
              outline:"none", textAlign:"center" }} />
          <input value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Password (min 6 characters)" type="password"
            style={{ width:"100%", padding:"14px 20px", borderRadius:100,
              background:C.navyMid, border:`1px solid ${error ? "#F04C8C66" : C.creamFaint}`,
              color:C.cream, fontSize:14, fontFamily:"'DM Sans',sans-serif",
              outline:"none", textAlign:"center" }} />
          {error && <p style={{ fontSize:12, color:"#F04C8C" }}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width:"100%", padding:"15px", borderRadius:100, background:C.gold,
              color:C.navy, border:"none", fontSize:15, fontWeight:500, cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center",
              justifyContent:"center", gap:10, boxShadow:`0 8px 28px ${C.gold}44`, marginTop:4 }}>
            {loading ? <Spinner /> : mode==="login" ? "Sign in →" : "Create account →"}
          </button>
        </div>
        <p style={{ fontSize:11, color:`${C.cream}33`, marginTop:16 }}>
          Free · Your progress syncs across devices
        </p>
      </div>
    </div>
  );
}


// ─── Onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const savedAnswers = (() => { try { return JSON.parse(localStorage.getItem("vow_onboarding") || "{}"); } catch { return {}; } })();
  const savedStep = Object.keys(savedAnswers).length;
  const [step, setStep] = useState(Math.min(savedStep, PROFILE_QUESTIONS.length - 1));
  const [answers, setAnswers] = useState(savedAnswers);
  const [selected, setSelected] = useState(null);
  const q = PROFILE_QUESTIONS[step];

  const pick = (val) => {
    setSelected(val);
    setTimeout(() => {
      const next = { ...answers, [q.id]: val };
      setAnswers(next);
      localStorage.setItem("vow_onboarding", JSON.stringify(next));
      setSelected(null);
      if (step < PROFILE_QUESTIONS.length - 1) setStep(s=>s+1);
      else { localStorage.removeItem("vow_onboarding"); onComplete(next); }
    }, 280);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"40px 20px", background:C.navy }}>
      <div style={{ maxWidth:440, width:"100%", animation:"fadeUp .5s ease forwards" }}>
        <div style={{ display:"flex", gap:5, marginBottom:32 }}>
          {PROFILE_QUESTIONS.map((_,i)=>(
            <div key={i} style={{ flex:1, height:3, borderRadius:2,
              background: i<=step ? C.gold : `${C.cream}15`, transition:"background .3s" }} />
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <VAvatar size={38} />
          <div style={{ fontSize:11, color:`${C.cream}55`, fontWeight:300 }}>
            Personalizing your experience · {step+1} of {PROFILE_QUESTIONS.length}
          </div>
        </div>
        <div key={step} style={{ animation:"slideLeft .35s ease forwards" }}>
          <div style={{ fontSize:36, marginBottom:16 }}>{q.emoji}</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:300,
            color:C.cream, lineHeight:1.25, marginBottom:28 }}>{q.question}</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {q.options.map(opt=>(
              <button key={opt.value} onClick={()=>pick(opt.value)}
                style={{ padding:"16px 20px", borderRadius:12, cursor:"pointer", textAlign:"left",
                  border:`1px solid ${selected===opt.value ? C.gold+"88" : C.creamFaint}`,
                  background: selected===opt.value ? `${C.gold}18` : C.creamFaint,
                  color:C.cream, fontSize:14, fontFamily:"'DM Sans',sans-serif",
                  transition:"all .15s", fontWeight: selected===opt.value ? 500 : 400 }}
                onMouseEnter={e=>{if(selected!==opt.value){e.target.style.borderColor=`${C.cream}30`;}}}
                onMouseLeave={e=>{if(selected!==opt.value){e.target.style.borderColor=C.creamFaint;}}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Partner Invite Modal ─────────────────────────────────────────────────────
function PartnerModal({ userId, onClose }) {
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState("invite"); // invite | join
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(()=>{
    // Check for existing invite code
    (async()=>{
      const { data } = await supabase.from("partner_links")
        .select("invite_code").eq("created_by", userId).is("partner_id", null).single();
      if (data) setCode(data.invite_code);
      else {
        const newCode = generateCode();
        await supabase.from("partner_links").insert({ created_by: userId, invite_code: newCode });
        setCode(newCode);
      }
    })();
  }, [userId]);

  const copyLink = () => {
    const link = `${window.location.origin}?partner=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  const joinPartner = async () => {
    if (!joinCode.trim()) return;
    setLoading(true); setError("");
    const { data, error: err } = await supabase.from("partner_links")
      .update({ partner_id: userId })
      .eq("invite_code", joinCode.toUpperCase().trim())
      .is("partner_id", null)
      .select().single();
    setLoading(false);
    if (err || !data) { setError("Code not found or already used. Double-check with your partner."); return; }
    setSuccess("You're linked! Your partner's progress is now visible on your map.");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(13,24,36,.85)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20, zIndex:100 }}>
      <div style={{ background:C.navyLight, borderRadius:20, padding:"28px 24px", maxWidth:420,
        width:"100%", border:`1px solid ${C.creamFaint}`, animation:"pop .35s ease forwards" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <VAvatar size={34} />
            <div style={{ fontSize:15, fontWeight:500, color:C.cream }}>Partner Sync</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:`${C.cream}55`,
            cursor:"pointer", fontSize:22 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:24 }}>
          {["invite","join"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{ flex:1, padding:"10px", borderRadius:100, cursor:"pointer",
                background: tab===t ? C.gold : C.creamFaint,
                color: tab===t ? C.navy : `${C.cream}66`,
                border:"none", fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>
              {t==="invite" ? "Invite partner" : "Join partner"}
            </button>
          ))}
        </div>

        {tab==="invite" ? (
          <div>
            <p style={{ fontSize:13, color:`${C.cream}66`, lineHeight:1.7, marginBottom:20, fontWeight:300 }}>
              Share this link with your partner. Once they sign up and join, you'll both see each other's chapter progress and quiz answers side-by-side.
            </p>
            <div style={{ padding:"14px 18px", borderRadius:12, background:C.creamFaint,
              border:`1px solid ${C.creamFaint}`, display:"flex", alignItems:"center", justifyContent:"space-between",
              gap:12, marginBottom:14 }}>
              <span style={{ fontSize:13, color:C.cream, fontFamily:"monospace" }}>
                {window.location.origin}?partner=<strong style={{ color:C.gold }}>{code}</strong>
              </span>
            </div>
            <button onClick={copyLink} style={{ width:"100%", padding:"13px", borderRadius:100,
              background: copied ? `${C.gold}22` : C.gold, color: copied ? C.gold : C.navy,
              border: copied ? `1px solid ${C.gold}66` : "none",
              fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
              transition:"all .2s" }}>
              {copied ? "✓ Copied!" : "Copy Invite Link"}
            </button>
            <p style={{ fontSize:11, color:`${C.cream}30`, textAlign:"center", marginTop:12 }}>
              Your partner code: <strong style={{ color:`${C.cream}55` }}>{code}</strong>
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:13, color:`${C.cream}66`, lineHeight:1.7, marginBottom:20, fontWeight:300 }}>
              If your partner already has an account, enter their invite code below to link your profiles.
            </p>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value)}
              placeholder="Enter partner's 6-digit code"
              style={{ width:"100%", padding:"14px 20px", borderRadius:100,
                background:C.navyMid, border:`1px solid ${error ? "#F04C8C66" : C.creamFaint}`,
                color:C.cream, fontSize:15, fontFamily:"'DM Sans',sans-serif",
                outline:"none", textAlign:"center", marginBottom:10,
                letterSpacing:"3px", textTransform:"uppercase" }} />
            {error && <p style={{ fontSize:12, color:"#F04C8C", marginBottom:10 }}>{error}</p>}
            {success && <p style={{ fontSize:12, color:"#3DBE7A", marginBottom:10 }}>{success}</p>}
            {!success && (
              <button onClick={joinPartner} disabled={loading || !joinCode.trim()}
                style={{ width:"100%", padding:"13px", borderRadius:100,
                  background: joinCode.trim() ? C.gold : C.creamFaint,
                  color: joinCode.trim() ? C.navy : `${C.cream}33`,
                  border:"none", fontSize:14, fontWeight:500, cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                {loading ? <Spinner /> : "Link Accounts →"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Edit Modal ──────────────────────────────────────────────────────
function ProfileModal({ profile, userId, onSave, onClose }) {
  const [answers, setAnswers] = useState({ ...profile });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const q = PROFILE_QUESTIONS[step];
  const isLast = step === PROFILE_QUESTIONS.length - 1;

  const pick = async (val) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    if (!isLast) { setStep(s => s + 1); return; }
    setSaving(true);
    await supabase.from("profiles").upsert({
      id: userId, stage: next.stage, income: next.income,
      partner_income: next.partnerIncome, children: next.children,
      debt: next.debt, home: next.home,
    });
    localStorage.setItem("vow_profile", JSON.stringify(next));
    setSaving(false);
    onSave(next);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(13,24,36,.92)", backdropFilter:"blur(10px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20, zIndex:200 }}>
      <div style={{ background:C.navyLight, borderRadius:24, padding:"28px 24px", maxWidth:440,
        width:"100%", border:`1px solid ${C.creamFaint}`, animation:"pop .3s ease forwards",
        maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:13, color:`${C.cream}55` }}>Edit your profile · {step+1}/{PROFILE_QUESTIONS.length}</div>
          <button onClick={onClose} style={{ background:"none", border:"none",
            color:`${C.cream}44`, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:"flex", gap:4, marginBottom:24 }}>
          {PROFILE_QUESTIONS.map((_,i) => (
            <div key={i} onClick={() => setStep(i)} style={{ flex:1, height:3, borderRadius:2,
              background: i<=step ? C.gold : `${C.cream}15`, cursor:"pointer", transition:"background .2s" }} />
          ))}
        </div>
        <div style={{ fontSize:28, marginBottom:12 }}>{q.emoji}</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300,
          color:C.cream, lineHeight:1.3, marginBottom:20 }}>{q.question}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {q.options.map(opt => {
            const selected = answers[q.id] === opt.value;
            return (
              <button key={opt.value} onClick={() => pick(opt.value)}
                style={{ padding:"14px 18px", borderRadius:12, cursor:"pointer", textAlign:"left",
                  border:`1px solid ${selected ? C.gold+"88" : C.creamFaint}`,
                  background: selected ? `${C.gold}22` : C.creamFaint,
                  color:C.cream, fontSize:14, fontFamily:"'DM Sans',sans-serif",
                  fontWeight: selected ? 500 : 400, transition:"all .15s",
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                {opt.label}
                {selected && <span style={{ color:C.gold, fontSize:14 }}>✓</span>}
              </button>
            );
          })}
        </div>
        {isLast && (
          <button onClick={() => { onSave(answers); onClose(); }} disabled={saving}
            style={{ width:"100%", marginTop:16, padding:"14px", borderRadius:100,
              background:C.gold, color:C.navy, border:"none", fontSize:14, fontWeight:500,
              cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {saving ? "Saving..." : "Save changes ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Chapter Map ──────────────────────────────────────────────────────────────
function ChapterMap({ profile, completed, userId, onSelect, onChat, onOpenTax, onSignOut, onProfileUpdate }) {
  const [showPartner, setShowPartner] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [partnerProgress, setPartnerProgress] = useState(null);
  const pct = Math.round((completed.length / CHAPTERS.length) * 100);

  useEffect(()=>{
    (async()=>{
      const { data: link } = await supabase.from("partner_links")
        .select("created_by, partner_id")
        .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
        .not("partner_id", "is", null)
        .single();
      if (!link) return;
      const partnerId = link.created_by === userId ? link.partner_id : link.created_by;
      const { data: prog } = await supabase.from("progress")
        .select("completed_chapters").eq("id", partnerId).single();
      if (prog) setPartnerProgress(prog.completed_chapters);
    })();
  }, [userId]);

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if (params.get("partner")) setShowPartner(true);
  }, []);

  const stageLabel = {
    engaged:"💍 Engaged", planning:"💫 Planning to propose",
    married:"🥂 Newly married", curious:"👀 Just exploring"
  }[profile?.stage] || "Your profile";

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(170deg, #0D1F2D 0%, #0D1824 60%)`, paddingBottom:80 }}>
      {showPartner && <PartnerModal userId={userId} onClose={()=>setShowPartner(false)} />}
      {showProfile && <ProfileModal profile={profile} userId={userId}
        onSave={(p)=>{ onProfileUpdate(p); setShowProfile(false); }}
        onClose={()=>setShowProfile(false)} />}

      {/* Hero header */}
      <div style={{ padding:"0 20px", paddingTop:48, paddingBottom:32,
        background:"linear-gradient(180deg, #0F2235 0%, transparent 100%)",
        borderBottom:`1px solid ${C.creamFaint}` }}>
        <div style={{ maxWidth:460, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <VAvatar size={44} pulse={pct < 100} />
              <div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32,
                  fontWeight:300, color:C.cream, lineHeight:1 }}>Vow</div>
                <div style={{ fontSize:11, color:C.gold, marginTop:3, letterSpacing:".5px" }}>{stageLabel}</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setShowProfile(true)}
                style={{ width:36, height:36, borderRadius:"50%", background:C.creamFaint,
                  border:`1px solid ${C.creamFaint}`, cursor:"pointer", fontSize:16,
                  display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}
                title="Edit profile"
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.gold}66`; e.currentTarget.style.background=`${C.gold}18`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.creamFaint; e.currentTarget.style.background=C.creamFaint;}}>
                👤
              </button>
              <button onClick={onSignOut}
                style={{ width:36, height:36, borderRadius:"50%", background:C.creamFaint,
                  border:`1px solid ${C.creamFaint}`, cursor:"pointer", fontSize:14,
                  display:"flex", alignItems:"center", justifyContent:"center", color:`${C.cream}55`,
                  fontFamily:"'DM Sans',sans-serif", transition:"all .2s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.cream}22`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.creamFaint;}}>
                ↩
              </button>
            </div>
          </div>

          {/* Progress arc */}
          <div style={{ padding:"16px 20px", borderRadius:16,
            background:"linear-gradient(135deg, #1C2E42 0%, #152233 100%)",
            border:`1px solid ${C.creamFaint}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:12, color:`${C.cream}66` }}>
                {completed.length === 0 ? "Ready to start?" : completed.length === CHAPTERS.length ? "All chapters complete 🎉" : `${CHAPTERS.length - completed.length} chapters remaining`}
              </span>
              <span style={{ fontSize:13, fontWeight:500, color:pct===100?C.green:C.gold }}>{pct}%</span>
            </div>
            <div style={{ height:6, background:`${C.cream}10`, borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:3,
                background: pct===100 ? `linear-gradient(90deg,${C.green},#6EE8A0)` : `linear-gradient(90deg,${C.gold},${C.goldLight})`,
                width:`${pct}%`, transition:"width .8s cubic-bezier(.4,0,.2,1)" }} />
            </div>
            <div style={{ display:"flex", gap:4, marginTop:10, flexWrap:"wrap" }}>
              {CHAPTERS.map(ch => (
                <div key={ch.id} style={{ width:8, height:8, borderRadius:"50%",
                  background: completed.includes(ch.id) ? ch.accent : `${C.cream}15`,
                  transition:"background .3s" }} title={ch.label} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:460, margin:"0 auto", padding:"24px 20px" }}>

        {/* Chapter grid */}
        <div style={{ fontSize:10, fontWeight:500, letterSpacing:"2px", color:`${C.cream}33`,
          textTransform:"uppercase", marginBottom:14 }}>Your chapters</div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {CHAPTERS.map((ch,i)=>{
            const done = completed.includes(ch.id);
            const partnerDone = partnerProgress?.includes(ch.id);
            return (
              <div key={ch.id} onClick={()=>onSelect(ch)}
                style={{ borderRadius:16, cursor:"pointer", overflow:"hidden",
                  border:`1px solid ${done ? ch.accent+"44" : ch.accent+"18"}`,
                  background: done
                    ? `linear-gradient(135deg, ${ch.color} 0%, ${ch.accent}18 100%)`
                    : `linear-gradient(135deg, ${ch.color} 0%, #0D1824 100%)`,
                  animation:`fadeUp ${.4+i*.06}s ease forwards`, opacity:0,
                  transition:"transform .15s, border-color .2s, box-shadow .2s",
                  boxShadow: done ? `0 2px 20px ${ch.accent}18` : "none" }}
                onMouseEnter={e=>{
                  e.currentTarget.style.transform="translateY(-2px)";
                  e.currentTarget.style.borderColor=ch.accent+"77";
                  e.currentTarget.style.boxShadow=`0 8px 24px ${ch.accent}22`;
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.transform="";
                  e.currentTarget.style.borderColor=done?ch.accent+"44":ch.accent+"18";
                  e.currentTarget.style.boxShadow=done?`0 2px 20px ${ch.accent}18`:"none";
                }}>
                <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
                    background:`${ch.accent}18`, border:`1px solid ${ch.accent}33`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                    {ch.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:C.cream }}>{ch.label}</div>
                    <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2, fontWeight:300 }}>
                      {ch.tagline}
                    </div>
                    {(partnerDone) && (
                      <div style={{ fontSize:10, color: done ? "#3DBE7A88" : `${C.gold}77`, marginTop:4 }}>
                        {done ? "✓ Both complete" : "Partner completed"}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink:0 }}>
                    {done
                      ? <div style={{ width:26, height:26, borderRadius:"50%",
                          background:`linear-gradient(135deg, ${ch.accent}, ${ch.accent}AA)`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          boxShadow:`0 2px 8px ${ch.accent}44` }}>
                          <span style={{ fontSize:12, color:C.navy, fontWeight:700 }}>✓</span>
                        </div>
                      : <div style={{ width:26, height:26, borderRadius:"50%",
                          background:`${ch.accent}18`, border:`1px solid ${ch.accent}33`,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:12, color:ch.accent }}>›</span>
                        </div>}
                  </div>
                </div>
                {done && (
                  <div style={{ height:2, background:`linear-gradient(90deg, ${ch.accent}66, transparent)` }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Tools section */}
        <div style={{ fontSize:10, fontWeight:500, letterSpacing:"2px", color:`${C.cream}33`,
          textTransform:"uppercase", marginTop:28, marginBottom:14 }}>Tools</div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {/* Ask V */}
          <div onClick={onChat} style={{ borderRadius:16, cursor:"pointer",
            background:`linear-gradient(135deg, #1A1408 0%, #0D1824 100%)`,
            border:`1px solid ${C.gold}33`, transition:"all .2s",
            boxShadow:`0 2px 16px ${C.gold}0A` }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.gold}66`; e.currentTarget.style.boxShadow=`0 8px 24px ${C.gold}18`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=`${C.gold}33`; e.currentTarget.style.boxShadow=`0 2px 16px ${C.gold}0A`;}}>
            <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
              <VAvatar size={44} />
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:C.gold }}>Ask V anything</div>
                <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>Personalized answers for your situation</div>
              </div>
              <span style={{ marginLeft:"auto", fontSize:12, color:`${C.gold}55` }}>›</span>
            </div>
          </div>

          {/* Tax Calculator */}
          <div onClick={()=>onOpenTax()} style={{ borderRadius:16, cursor:"pointer",
            background:`linear-gradient(135deg, #0F2A1E 0%, #0D1824 100%)`,
            border:"1px solid #3DBE7A33", transition:"all .2s" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#3DBE7A66"; e.currentTarget.style.boxShadow="0 8px 24px #3DBE7A18";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#3DBE7A33"; e.currentTarget.style.boxShadow="";}}>
            <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12,
                background:"#3DBE7A18", border:"1px solid #3DBE7A33",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📊</div>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:C.cream }}>Tax Calculator</div>
                <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>Joint vs. separate — see your exact savings</div>
              </div>
              <span style={{ marginLeft:"auto", fontSize:12, color:`${C.cream}33` }}>›</span>
            </div>
          </div>

          {/* Partner sync */}
          <div onClick={()=>setShowPartner(true)} style={{ borderRadius:16, cursor:"pointer",
            background:`linear-gradient(135deg, #1A0F2A 0%, #0D1824 100%)`,
            border:"1px solid #A04CF033", transition:"all .2s" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#A04CF066"; e.currentTarget.style.boxShadow="0 8px 24px #A04CF018";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#A04CF033"; e.currentTarget.style.boxShadow="";}}>
            <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12,
                background:"#A04CF018", border:"1px solid #A04CF033",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>💍</div>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:C.cream }}>
                  {partnerProgress ? "Partner linked ✓" : "Invite your partner"}
                </div>
                <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>
                  {partnerProgress ? "Progress visible on chapters above" : "See your progress side-by-side"}
                </div>
              </div>
              <span style={{ marginLeft:"auto", fontSize:12, color:`${C.cream}33` }}>›</span>
            </div>
          </div>
        </div>
      </div>
    </div>

// ─── Lesson Screen ────────────────────────────────────────────────────────────
function LessonScreen({ chapter, profile, onComplete, onBack }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState("right");
  const [done, setDone] = useState(false);
  const cards = chapter.getCards(profile);
  const card = cards[idx];

  const next = ()=>{ if(idx<cards.length-1){setDir("right");setIdx(i=>i+1);}else setDone(true); };
  const prev = ()=>{ if(idx>0){setDir("left");setIdx(i=>i-1);}else onBack(); };

  if (done) return <MonetizationScreen chapter={chapter} onComplete={onComplete} />;

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      background:`radial-gradient(ellipse at 20% 0%, ${chapter.color} 0%, ${C.navy} 60%)` }}>
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:`${C.cream}55`,
          cursor:"pointer", fontSize:22, padding:"4px 8px" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:chapter.accent, fontWeight:500, letterSpacing:"1px", textTransform:"uppercase" }}>{chapter.label}</div>
        </div>
        <div style={{ fontSize:12, color:`${C.cream}44` }}>{idx+1} / {cards.length}</div>
      </div>
      <div style={{ display:"flex", gap:6, padding:"0 20px 16px" }}>
        {cards.map((_,i)=>(
          <div key={i} style={{ height:3, borderRadius:2, flex:1,
            background: i<=idx ? chapter.accent : `${C.cream}18`, transition:"background .3s" }} />
        ))}
      </div>
      <div key={idx} style={{ flex:1, padding:"4px 18px 20px", display:"flex", flexDirection:"column",
        animation:`${dir==="right"?"slideLeft":"slideRight"} .35s ease forwards` }}>
        <div style={{ flex:1, padding:"24px 22px", borderRadius:20,
          background:`linear-gradient(145deg, ${chapter.color} 0%, ${C.navyLight}88 100%)`,
          border:`1px solid ${chapter.accent}33`, display:"flex", flexDirection:"column" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>{card.emoji}</div>
          <div style={{ fontSize:10, fontWeight:500, letterSpacing:"2px", textTransform:"uppercase",
            color:chapter.accent, marginBottom:10 }}>{card.hookLabel}</div>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400,
            color:C.cream, lineHeight:1.35, marginBottom:18 }}>"{card.hook}"</p>
          <p style={{ fontSize:14, color:C.creamDim, lineHeight:1.8, fontWeight:300, flex:1 }}>{card.body}</p>
          <div style={{ marginTop:20, padding:"14px 16px", borderRadius:12,
            background:`${chapter.accent}15`, border:`1px solid ${chapter.accent}33` }}>
            <div style={{ fontSize:10, fontWeight:500, letterSpacing:"1.5px", color:chapter.accent,
              textTransform:"uppercase", marginBottom:5 }}>What this means for you</div>
            <p style={{ fontSize:13, color:C.cream, lineHeight:1.65 }}>{card.takeaway}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <button onClick={prev} style={{ flex:1, padding:"14px", borderRadius:100,
            background:C.creamFaint, border:"none", color:`${C.cream}66`, cursor:"pointer",
            fontSize:14, fontFamily:"'DM Sans',sans-serif" }}
            onMouseEnter={e=>{e.target.style.background=`${C.cream}14`;}}
            onMouseLeave={e=>{e.target.style.background=C.creamFaint;}}>
            {idx===0 ? "← Back" : "← Previous"}
          </button>
          <button onClick={next} style={{ flex:2, padding:"14px", borderRadius:100,
            background:chapter.accent, border:"none", color:C.navy, cursor:"pointer",
            fontSize:14, fontWeight:500, fontFamily:"'DM Sans',sans-serif",
            boxShadow:`0 6px 22px ${chapter.accent}44` }}
            onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.target.style.transform="";}}>
            {idx===cards.length-1 ? "Finish chapter →" : "Next lesson →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Monetization ─────────────────────────────────────────────────────────────
function MonetizationScreen({ chapter, onComplete }) {
  const m = chapter.monetization;
  const tc = { upgrade:C.gold, referral:chapter.accent, advisor:"#4CF0D8" }[m.type];
  const tl = { upgrade:"VOW PRO", referral:`VOW PARTNER · ${m.partner||""}`, advisor:"EXPERT ACCESS" }[m.type];
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"32px 20px",
      background:`radial-gradient(ellipse at 50% 30%, ${chapter.color} 0%, ${C.navy} 70%)` }}>
      <div style={{ maxWidth:420, width:"100%", textAlign:"center", animation:"pop .5s ease forwards" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:`${chapter.accent}22`,
          border:`2px solid ${chapter.accent}66`, display:"flex", alignItems:"center",
          justifyContent:"center", margin:"0 auto 20px", fontSize:28 }}>✓</div>
        <div style={{ fontSize:10, fontWeight:500, letterSpacing:"2px", color:chapter.accent,
          textTransform:"uppercase", marginBottom:8 }}>Chapter complete</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:300,
          color:C.cream, lineHeight:1.2 }}>You nailed {chapter.label}.</h2>
        <p style={{ fontSize:14, color:`${C.cream}55`, marginTop:10, lineHeight:1.7, fontWeight:300 }}>
          Take the next step on what you just learned.
        </p>
        <div style={{ marginTop:28, padding:"22px", borderRadius:18, background:`${tc}12`,
          border:`1px solid ${tc}44`, textAlign:"left", position:"relative" }}>
          {m.badge && (
            <div style={{ position:"absolute", top:-10, right:18, padding:"4px 12px",
              background:tc, color:C.navy, borderRadius:100, fontSize:10, fontWeight:600, letterSpacing:"1px" }}>
              {m.badge}
            </div>
          )}
          <div style={{ fontSize:10, fontWeight:500, letterSpacing:"1.5px", color:tc,
            textTransform:"uppercase", marginBottom:8 }}>{tl}</div>
          <div style={{ fontSize:17, fontWeight:500, color:C.cream, marginBottom:6 }}>{m.headline}</div>
          <div style={{ fontSize:13, color:`${C.cream}66`, lineHeight:1.65, fontWeight:300, marginBottom:18 }}>{m.sub}</div>
          <button style={{ width:"100%", padding:"14px", borderRadius:100, background:tc,
            color:C.navy, border:"none", fontSize:14, fontWeight:500, cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif", boxShadow:`0 6px 22px ${tc}44` }}>
            {m.cta}
          </button>
          {m.ctaSub && <div style={{ fontSize:11, color:`${C.cream}30`, textAlign:"center", marginTop:10 }}>{m.ctaSub}</div>}
        </div>
        <button onClick={onComplete} style={{ marginTop:14, width:"100%", padding:"13px", borderRadius:100,
          background:"transparent", border:`1px solid ${C.creamFaint}`, color:`${C.cream}55`,
          fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
          onMouseEnter={e=>{e.target.style.color=C.cream; e.target.style.borderColor=`${C.cream}33`;}}
          onMouseLeave={e=>{e.target.style.color=`${C.cream}55`; e.target.style.borderColor=C.creamFaint;}}>
          ← Back to all chapters
        </button>
      </div>
    </div>
  );
}

// ─── Chat / Q&A ───────────────────────────────────────────────────────────────
function ChatScreen({ profile, userId, onBack }) {
  const [msgs, setMsgs] = useState([{ role:"assistant",
    content:"Hey! Ask me anything about marriage finances — taxes, prenups, accounts, debt, insurance, future planning. I'll match you to the best answer for your situation." }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  const SUGGESTIONS = [
    "Should we file taxes jointly?","Do we need a prenup?",
    "How do we split bank accounts?","Does my partner's debt affect me?",
    "How much life insurance do we need?","When should we update beneficiaries?",
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, typing]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q) return;
    setInput("");
    setMsgs(p=>[...p, { role:"user", content:q }]);
    setTyping(true);

    // Track analytics
    const match = matchQA(q);
    if (userId) {
      await supabase.from("qa_events").insert({
        user_id: userId, question: q, matched_topic: match?.topic || "unmatched"
      });
    }

    setTimeout(() => {
      const personalized = personalizeAnswer(match, profile);
      let reply;
      if (personalized) {
        reply = `**${personalized.q}**\n\n${personalized.a}`;
        if (personalized.tip) reply += `\n\n💡 ${personalized.tip}`;
      } else {
        reply = "That's a great question — let me make sure I point you in the right direction. A few topics I can help with right now: filing jointly vs. separately, prenup basics, splitting bank accounts, beneficiary updates, or life insurance needs. What would be most useful?";
      }
      setTyping(false);
      setMsgs(p=>[...p, { role:"assistant", content:reply }]);
    }, 500 + Math.random() * 400);
  };

  const renderMsg = (text) =>
    text.split("\n\n").map((para,pi)=>(
      <p key={pi} style={{ marginBottom: pi < text.split("\n\n").length-1 ? 10 : 0 }}>
        {para.split("**").map((s,i)=>
          i%2===1 ? <strong key={i} style={{ color:C.goldLight }}>{s}</strong>
          : para.startsWith("💡") ? <em key={i} style={{ color:`${C.cream}77`, fontSize:12 }}>{s}</em>
          : s
        )}
      </p>
    ));

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:C.navy }}>
      <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:10,
        borderBottom:`1px solid ${C.creamFaint}`, background:C.navyLight }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:`${C.cream}55`,
          cursor:"pointer", fontSize:20, padding:"4px 8px" }}>←</button>
        <VAvatar size={34} pulse />
        <div>
          <div style={{ fontSize:14, fontWeight:500, color:C.cream }}>Ask V</div>
          <div style={{ fontSize:10, color:C.gold, marginTop:1 }}>● Personalized to your profile</div>
        </div>
      </div>
      {msgs.length <= 1 && (
        <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.creamFaint}`,
          display:"flex", gap:8, flexWrap:"wrap" }}>
          {SUGGESTIONS.map(s=>(
            <button key={s} onClick={()=>send(s)} style={{ padding:"7px 14px", borderRadius:100,
              background:C.creamFaint, border:`1px solid ${C.creamFaint}`, color:`${C.cream}88`,
              fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s" }}
              onMouseEnter={e=>{e.target.style.background=`${C.cream}14`; e.target.style.color=C.cream;}}
              onMouseLeave={e=>{e.target.style.background=C.creamFaint; e.target.style.color=`${C.cream}88`;}}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", display:"flex", flexDirection:"column", gap:16 }}>
        {msgs.map((m,i)=>(
          <div key={i} style={{ display:"flex", gap:8,
            justifyContent:m.role==="user"?"flex-end":"flex-start", animation:"fadeUp .3s ease forwards" }}>
            {m.role==="assistant" && <VAvatar size={30} />}
            <div style={{ maxWidth:"80%", padding:"13px 17px",
              borderRadius:m.role==="user"?"20px 20px 4px 20px":"4px 20px 20px 20px",
              background:m.role==="user"?C.gold:C.creamFaint,
              color:m.role==="user"?C.navy:C.cream, fontSize:14, lineHeight:1.75,
              fontWeight:m.role==="user"?500:300,
              border:m.role==="assistant"?`1px solid ${C.creamFaint}`:"none" }}>
              {m.role==="assistant" ? renderMsg(m.content) : m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <VAvatar size={30} pulse />
            <div style={{ padding:"13px 17px", borderRadius:"4px 20px 20px 20px",
              background:C.creamFaint, border:`1px solid ${C.creamFaint}` }}>
              <div style={{ display:"flex", gap:4 }}>
                {[0,1,2].map(j=>(
                  <div key={j} style={{ width:5, height:5, borderRadius:"50%", background:C.gold,
                    animation:`shimmer 1.2s ease-in-out ${j*.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.creamFaint}`,
        background:C.navyLight, display:"flex", gap:10 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder="Ask anything about marriage finances..."
          style={{ flex:1, padding:"13px 18px", borderRadius:100,
            background:C.creamFaint, border:`1px solid ${C.creamFaint}`,
            color:C.cream, fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none" }} />
        <button onClick={()=>send()} disabled={!input.trim()}
          style={{ width:46, height:46, borderRadius:"50%", flexShrink:0,
            background:input.trim()?C.gold:`${C.cream}18`, border:"none",
            color:input.trim()?C.navy:`${C.cream}33`, fontSize:16,
            cursor:input.trim()?"pointer":"default", transition:"all .2s" }}>→</button>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function VowApp() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);

  // Auth listener + initial load
  useEffect(()=>{
    supabase.auth.getSession().then(({ data:{ session } })=>{
      if (session?.user) { setUser(session.user); loadUserData(session.user.id); }
      else setScreen("auth");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session)=>{
      if (session?.user) { setUser(session.user); loadUserData(session.user.id); }
      else { setUser(null); setScreen("auth"); }
    });
    return ()=>subscription.unsubscribe();
  }, []);

  const loadUserData = async (uid) => {
    const [{ data: prof }, { data: prog }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("progress").select("*").eq("id", uid).single(),
    ]);
    if (prof) {
      // Map snake_case DB columns back to camelCase
      const normalized = { ...prof, partnerIncome: prof.partner_income || prof.partnerIncome };
      setProfile(normalized);
      localStorage.setItem("vow_profile", JSON.stringify(normalized));
      setScreen("map");
    } else {
      // Check localStorage fallback in case Supabase save failed
      try {
        const cached = localStorage.getItem("vow_profile");
        if (cached) {
          const p = JSON.parse(cached);
          setProfile(p);
          // Re-save to Supabase now that we have a session
          await supabase.from("profiles").upsert({ id: uid, stage: p.stage, income: p.income, partner_income: p.partnerIncome, children: p.children, debt: p.debt, home: p.home });
          await supabase.from("progress").upsert({ id: uid, completed_chapters: [] });
          setScreen("map");
        } else {
          setScreen("onboarding");
        }
      } catch { setScreen("onboarding"); }
    }
    if (prog) setCompleted(prog.completed_chapters || []);
  };

  const handleProfileComplete = async (answers) => {
    setProfile(answers);
    localStorage.setItem("vow_profile", JSON.stringify(answers));
    // Map camelCase to snake_case for Supabase columns
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      stage: answers.stage,
      income: answers.income,
      partner_income: answers.partnerIncome,
      children: answers.children,
      debt: answers.debt,
      home: answers.home,
    });
    if (error) console.error("Profile save error:", error);
    await supabase.from("progress").upsert({ id: user.id, completed_chapters: [] });
    setScreen("map");
  };

  const handleChapterComplete = async () => {
    if (activeChapter && !completed.includes(activeChapter.id)) {
      const next = [...completed, activeChapter.id];
      setCompleted(next);
      await supabase.from("progress").upsert({ id: user.id, completed_chapters: next, updated_at: new Date().toISOString() });
    }
    setScreen("map");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("vow_onboarding");
    localStorage.removeItem("vow_profile");
    setUser(null); setProfile(null); setCompleted([]);
    setScreen("auth");
  };

  if (screen === "loading") {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.navy }}>
        <VAvatar size={56} pulse />
      </div>
    );
  }

  return (
    <>
      <style>{G}</style>
      {screen==="auth"        && <AuthScreen onAuth={()=>{}} />}
      {screen==="onboarding"  && <Onboarding onComplete={handleProfileComplete} />}
      {screen==="map"         && <ChapterMap profile={profile} completed={completed} userId={user?.id}
                                   onSelect={ch=>{ setActiveChapter(ch); setScreen("lesson"); }}
                                   onChat={()=>setScreen("chat")} onOpenTax={()=>setScreen("tax")} onSignOut={handleSignOut} onProfileUpdate={(p)=>setProfile(p)} />}
      {screen==="lesson"      && activeChapter && <LessonScreen chapter={activeChapter} profile={profile}
                                   onComplete={handleChapterComplete} onBack={()=>setScreen("map")} />}
      {screen==="chat"        && <ChatScreen profile={profile} userId={user?.id} onBack={()=>setScreen("map")} />}
      {screen==="tax"         && <TaxCalculator onBack={()=>setScreen("map")} />}
    </>
  );
}
