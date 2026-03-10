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
          ? "Getting married could save you thousands in taxes this year."
          : "If you both earn similar salaries, marriage might actually raise your tax bill.",
        body: ["iMore","theyMore","oneIncome"].includes(p?.partnerIncome)
          ? "Because there's an income gap between you, filing jointly will likely drop you into a lower combined bracket. This is the marriage bonus — and it's real money."
          : "When two similar incomes combine, you can get pushed into a higher bracket than you'd each be in separately. This is the marriage penalty. Couples earning $80K–$180K each are most at risk.",
        takeaway:"Run both 'joint' and 'separate' scenarios before your first tax season together. A CPA or TaxAct can model both in minutes." },
      { emoji:"📝", hookLabel:"UPDATE YOUR WITHHOLDING",
        hook:"Your W-4 is almost certainly wrong the day you get married.",
        body:"Your employer doesn't know you got married. They're still withholding as if you're single. File a new W-4 with HR within 30 days of your wedding — otherwise April comes with a surprise bill.",
        takeaway:"This one task takes 10 minutes and prevents a stressful tax season. Do it before the honeymoon haze wears off." },
      { emoji:"🔀", hookLabel:"JOINT VS. SEPARATE",
        hook:"Filing separately is almost always the wrong move — with one important exception.",
        body: ["studentLoans","both"].includes(p?.debt)
          ? "Since you have student loans: if you're on income-driven repayment, filing separately could preserve lower payments — even though it usually costs more in taxes overall. Run the math both ways."
          : "Married filing separately almost always means a higher combined bill. The exception is large medical expenses or income-driven student loan repayments.",
        takeaway:"Default to joint. But don't skip running the separate scenario if either of you is on IDR." },
      { emoji:"📊", hookLabel:"THE STANDARD DEDUCTION",
        hook:"The married standard deduction is $29,200 in 2024 — double what you each had as singles.",
        body:"You're not losing any deduction benefit by getting married. Itemizing only makes sense if your combined deductions exceed $29,200. Most couples don't cross that bar unless they have a large mortgage.",
        takeaway:"Unless you own a home or give heavily to charity, the standard deduction is almost certainly the right call." },
    ],
    monetization:{ headline:"Get your personalized tax picture", sub:"See exactly how marriage changes your taxes based on your real income numbers.", cta:"Try Vow Pro Free for 7 Days", ctaSub:"Then $49 one-time · Unlock all tools & calculators", type:"upgrade" },
  },
  {
    id:"accounts", icon:"🏦", label:"Bank Accounts", color:"#0F1E2A", accent:"#4C9AF0", tagline:"The money conversation",
    getCards:(p)=>[
      { emoji:"💑", hookLabel:"THE RESEARCH IS IN",
        hook:"Couples with joint accounts fight about money less — and build more wealth.",
        body:"Multiple studies confirm: financial transparency and shared goals are stronger predictors of relationship satisfaction than romantic compatibility alone. Combining finances (even partially) forces the conversations that matter.",
        takeaway:"You don't have to merge everything. But hiding finances from each other long-term almost always creates friction." },
      { emoji:"3️⃣", hookLabel:"THE 3-ACCOUNT METHOD",
        hook:"There's a simple system that solves most money fights before they start.",
        body:"Yours, mine, ours. Keep individual accounts for personal spending. Open a joint account for shared bills. Each month, contribute a set amount. What's left in your personal account is yours — no explanation required.",
        takeaway: p?.partnerIncome === "similar"
          ? "Since you earn similarly, equal fixed contributions to the joint account usually feel fairest."
          : "Since your incomes differ, proportional contributions — each putting in the same percentage — typically feels more equitable." },
      { emoji:"🛡️", hookLabel:"EMERGENCY FUND TARGET",
        hook:"Your emergency fund target just changed. As a household, aim for 6 months.",
        body:"Two people means two potential income disruptions, double the risk. Target 6 full months of combined expenses in a high-yield savings account — not checking. Top options: SoFi, Marcus, Ally — typically 4–5% APY.",
        takeaway: ["buyingSoon","ownOne","ownBoth"].includes(p?.home)
          ? "As homeowners (or soon-to-be), a robust emergency fund is even more critical — repairs don't give you a heads-up."
          : "Calculate joint monthly expenses and multiply by 6. That's your target." },
      { emoji:"🙈", hookLabel:"FINANCIAL INFIDELITY",
        hook:"36% of couples admit to hiding a purchase from their partner.",
        body:"Financial infidelity — hidden spending, secret accounts, undisclosed debt — contributes to roughly 40% of divorces. It almost never starts maliciously. It starts with one purchase someone couldn't explain.",
        takeaway:"A monthly money check-in, even just 20 minutes, dramatically reduces the chance of this developing." },
    ],
    monetization:{ headline:"Open a free high-yield joint account", sub:"SoFi Money gives couples a joint account with no fees and up to 4.6% APY on savings.", cta:"Open Joint Account →", ctaSub:"Vow partner offer · 5 minutes online", type:"referral", partner:"SoFi" },
  },
  {
    id:"debt", icon:"📋", label:"Debt & Credit", color:"#2A0F1E", accent:"#F04C8C", tagline:"What's yours, mine, and ours",
    getCards:(p)=>[
      { emoji:"✅", hookLabel:"DEBT DOESN'T TRANSFER",
        hook:"Your partner's pre-existing debt is not your legal responsibility after marriage.",
        body:"Student loans, credit cards, car loans from before marriage stay with whoever took them on. You don't inherit their financial past. Exception: community property states (CA, TX, AZ, and 6 others) where debt acquired during marriage is jointly owned.",
        takeaway:"Even if you don't legally inherit it, their debt affects household cash flow. Build it into your shared budget from day one." },
      { emoji:"📉", hookLabel:"CREDIT SCORES MATTER JOINTLY",
        hook:"A 100-point credit score difference can cost you $50,000+ on a mortgage.",
        body:"Lenders use the lower of your two middle scores to set the mortgage rate. On a $400K 30-year mortgage, the gap between a 680 and 780 can be $200+ per month — over $70,000 total.",
        takeaway: p?.home === "buyingSoon"
          ? "You're planning to buy soon — check both credit scores immediately. If one needs work, you may want to delay the application by 6–12 months."
          : "Check both scores free at AnnualCreditReport.com. Know where you both stand." },
      { emoji:"🎓", hookLabel:"STUDENT LOANS & MARRIAGE",
        hook: ["studentLoans","both"].includes(p?.debt)
          ? "This one matters for your situation: marriage can raise your monthly loan payments significantly."
          : "Income-driven student loan repayment gets more complicated after marriage.",
        body: ["studentLoans","both"].includes(p?.debt)
          ? "Since you're carrying student loans on IDR, your combined income on a joint return may increase your required payments. Filing separately can preserve lower payments — but usually costs more in taxes. Run both scenarios."
          : "If either of you is on income-driven repayment, your combined income may push monthly payments higher. It's a real tradeoff worth calculating before your first tax season together.",
        takeaway:"Use the StudentAid.gov loan simulator to model payments under different filing scenarios." },
      { emoji:"⚖️", hookLabel:"WHAT JOINT DEBT MEANS",
        hook:"Any debt you both sign — either of you is fully on the hook for all of it.",
        body:"A joint mortgage, car loan, or credit card means the lender can pursue either person for the full balance, regardless of who spent the money. This remains true even after divorce in most states.",
        takeaway:"Only go joint on debt you'd be comfortable owning alone if circumstances changed." },
    ],
    monetization:{ headline:"Check both your credit scores free", sub:"See exactly where you each stand before applying for anything together.", cta:"Check My Score Free →", ctaSub:"No credit card needed · Via Experian", type:"referral", partner:"Experian" },
  },
  {
    id:"legal", icon:"⚖️", label:"Legal & Documents", color:"#1E0F2A", accent:"#A04CF0", tagline:"The paperwork nobody talks about",
    getCards:(p)=>[
      { emoji:"📜", hookLabel:"THE PRENUP GAP",
        hook:"51% of millennials think everyone should have a prenup. Only 5% get one.",
        body:"The gap isn't disagreement — it's the conversation feeling taboo. A prenup isn't about planning for divorce. It's a financial agreement made while you both have clear heads and good intentions.",
        takeaway: ["ownOne","ownBoth"].includes(p?.home)
          ? "Since one or both of you own property, a prenup that classifies pre-marital assets as separate property is especially worth considering."
          : "Most worth considering if either of you runs a business, has significant assets, carries substantial debt, or has children from a previous relationship." },
      { emoji:"📌", hookLabel:"BENEFICIARY BLINDSPOT",
        hook:"Your 401k beneficiary might still be your ex. Or your mom.",
        body:"Retirement accounts, life insurance, and bank TOD designations pass directly to whoever you named — bypassing your will entirely. Most people set them once, years ago, and forgot.",
        takeaway:"Log into every financial account and update beneficiaries this week. Five minutes each, highest ROI task on this list." },
      { emoji:"📛", hookLabel:"THE NAME CHANGE ORDER",
        hook:"Name changes take longer than expected — and doing them out of order creates problems.",
        body:"Correct order: (1) Social Security, (2) Driver's license, (3) Passport, (4) Banks and everything else. Out-of-order changes cause mismatches that delay processing. Full process: 4–8 weeks.",
        takeaway:"Don't book international travel in the first two months post-wedding if you're changing your name." },
      { emoji:"⚖️", hookLabel:"DO YOU HAVE A WILL?",
        hook:"Without a will, your assets may not go to your spouse depending on your state.",
        body:"Dying without a will means your estate goes through probate under your state's default rules — which may not reflect your wishes. A basic will, power of attorney, and healthcare directive can be set up online for under $300.",
        takeaway: ["haveKids","planKids"].includes(p?.children)
          ? "With kids in the picture, a will that names a guardian is critical. Do this in your first year of marriage."
          : "Aim to have this done within your first year of marriage. It becomes even more critical once you own property." },
    ],
    monetization:{ headline:"Start your prenup — in plain English", sub:"HelloPrenup walks you through a legally valid prenuptial agreement from home. No attorney meetings required.", cta:"Start Your Prenup →", ctaSub:"From $599 per couple · Exclusive Vow discount applied", type:"referral", partner:"HelloPrenup", badge:"MOST POPULAR" },
  },
  {
    id:"insurance", icon:"🛡️", label:"Insurance", color:"#2A1E0F", accent:"#F0A84C", tagline:"What to combine and when",
    getCards:(p)=>[
      { emoji:"🏥", hookLabel:"HEALTH INSURANCE WINDOW",
        hook:"Marriage opens a 30–60 day window to join your partner's health plan — no waiting.",
        body:"Marriage is a qualifying life event. You can add each other to employer health plans immediately, without waiting for open enrollment. Miss this window and you wait until the next open enrollment period.",
        takeaway:"Compare both employers' plans before the wedding so you have a decision ready immediately after." },
      { emoji:"🚗", hookLabel:"AUTO INSURANCE SAVINGS",
        hook:"Combining auto insurance saves couples $400 per year on average.",
        body:"Married driver discounts, multi-car policies, and the stability signal marriage sends to insurers add up. Most companies don't apply discounts automatically — call and ask for a requote.",
        takeaway:"Call your insurer within 30 days of getting married. Takes 10 minutes and often saves hundreds immediately." },
      { emoji:"🔒", hookLabel:"LIFE INSURANCE GAP",
        hook: ["haveKids","planKids"].includes(p?.children)
          ? "With kids in the picture, life insurance isn't optional — it's critical."
          : "Most couples are dramatically underinsured on life insurance.",
        body:"The guideline is 10–12x your annual income each. Most employer plans offer 1–2x. A healthy 30-year-old can get $500K of 20-year term coverage for around $20–$25/month.",
        takeaway: ["over200","100to200"].includes(p?.income)
          ? "At your income level, adequate coverage could be $1–2M or more. A Policygenius quote takes 5 minutes."
          : "If your partner would struggle financially without your income for even a year, you need more than your employer provides." },
      { emoji:"🏠", hookLabel:"RENTERS INSURANCE",
        hook:"Your renters insurance likely already covers your spouse — once you're married.",
        body:"Most renters policies automatically extend to a legal spouse. Getting married is the trigger to consolidate to one policy, update your address, and review coverage limits.",
        takeaway:"One joint policy is almost always cheaper than two. Call your insurer post-wedding." },
    ],
    monetization:{ headline:"Compare life insurance in 5 minutes", sub:"Policygenius shops 30+ insurers at once. Most couples get covered for less than $30/month.", cta:"Get My Quote Free →", ctaSub:"No spam. No obligation. · Via Policygenius", type:"referral", partner:"Policygenius" },
  },
  {
    id:"future", icon:"🌱", label:"Future Planning", color:"#0F2A2A", accent:"#4CF0D8", tagline:"Building a life together",
    getCards:(p)=>[
      { emoji:"📈", hookLabel:"RETIREMENT ACCOUNTS",
        hook:"As a couple, you have two Roth IRAs — $14,000/year in tax-free retirement savings.",
        body:"Each person contributes up to $7,000/year to a Roth IRA in 2024. Start with whoever is in the lower tax bracket. Next: both of you should capture your full employer 401(k) match — that's an instant 100% return.",
        takeaway: p?.income === "under50"
          ? "At lower incomes, the Saver's Credit may give you a tax credit for contributing to retirement accounts. Worth looking up."
          : "Max both IRAs before increasing 401(k) contributions beyond the match. Roth flexibility is worth it." },
      { emoji:"🏡", hookLabel:"HOME BUYING TOGETHER",
        hook: p?.home === "buyingSoon" ? "Since you're planning to buy soon — here's what to get right." : "Buying a home is the biggest financial decision most couples make.",
        body:"Lenders use the lower of your two credit scores and look at combined debt-to-income (target under 43%). Get pre-approved before house hunting — it sets your real budget and makes offers competitive.",
        takeaway: p?.home === "buyingSoon"
          ? "Get pre-approved now, before you fall in love with a house. It takes about a week and changes the entire negotiation dynamic."
          : "Understanding what improves mortgage eligibility helps you make better decisions today, even if you're years from buying." },
      { emoji:"👶", hookLabel:"THE HONEST BABY MATH",
        hook: p?.children === "haveKids" ? "You already know — but here are numbers most parents wish they'd had earlier." : "The real cost of a first child is $15,000–$25,000 in year one.",
        body:"Hospital delivery ($5K–$15K with insurance), infant gear ($2K–$4K), and childcare ($1,200–$3,500/month in most cities). The USDA estimates $17,000/year average through age 18 — not including college.",
        takeaway:"Check both employers' parental leave policies today. The difference between 6 weeks and 20 weeks paid leave is enormous — financially and emotionally." },
      { emoji:"🗓️", hookLabel:"THE MONEY DATE",
        hook:"Couples who have regular money conversations build significantly more wealth over time.",
        body:"One 30-minute monthly check-in — calm, agenda-driven: budget review, savings progress, one upcoming goal. Research consistently shows this habit predicts long-term financial success more than income level.",
        takeaway:"Set a recurring calendar event right now. Same time each month. Make it a ritual, not a chore." },
    ],
    monetization:{ headline:"Talk to a financial planner built for couples", sub:"A 30-minute intro session with a vetted CFP who specializes in newlywed financial planning.", cta:"Book a Free Intro Call →", ctaSub:"Matched to advisors in your area · First session free", type:"advisor" },
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const q = PROFILE_QUESTIONS[step];

  const pick = (val) => {
    setSelected(val);
    setTimeout(() => {
      const next = { ...answers, [q.id]: val };
      setAnswers(next);
      setSelected(null);
      if (step < PROFILE_QUESTIONS.length - 1) setStep(s=>s+1);
      else onComplete(next);
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

// ─── Chapter Map ──────────────────────────────────────────────────────────────
function ChapterMap({ profile, completed, userId, onSelect, onChat, onOpenTax, onSignOut }) {
  const [showPartner, setShowPartner] = useState(false);
  const [partnerProgress, setPartnerProgress] = useState(null);
  const pct = Math.round((completed.length / CHAPTERS.length) * 100);

  useEffect(()=>{
    // Check if linked to a partner and fetch their progress
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

  // Check URL for partner code on load
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const code = params.get("partner");
    if (code) setShowPartner(true);
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg, ${C.navyLight} 0%, ${C.navy} 100%)`, padding:"44px 20px 100px" }}>
      {showPartner && <PartnerModal userId={userId} onClose={()=>setShowPartner(false)} />}
      <div style={{ maxWidth:460, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, animation:"fadeUp .6s ease forwards" }}>
          <VAvatar size={42} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300, color:C.cream }}>Your Vow Journey</div>
            <div style={{ fontSize:12, color:`${C.cream}44`, marginTop:2 }}>
              {completed.length}/{CHAPTERS.length} complete
              {partnerProgress && <span style={{ color:`${C.gold}88` }}> · Partner synced ✓</span>}
            </div>
          </div>
          <button onClick={onSignOut} style={{ background:"none", border:"none",
            color:`${C.cream}33`, cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
            Sign out
          </button>
        </div>

        {/* Progress */}
        <div style={{ marginTop:22, height:3, background:`${C.cream}12`, borderRadius:2 }}>
          <div style={{ height:"100%", borderRadius:2, background:`linear-gradient(90deg,${C.gold},${C.goldLight})`,
            width:`${pct}%`, transition:"width .6s ease" }} />
        </div>
        {pct > 0 && <div style={{ fontSize:11, color:C.gold, marginTop:6, textAlign:"right" }}>{pct}% complete</div>}

        {/* Chapters */}
        <div style={{ marginTop:28, display:"flex", flexDirection:"column", gap:10 }}>
          {CHAPTERS.map((ch,i)=>{
            const done = completed.includes(ch.id);
            const partnerDone = partnerProgress?.includes(ch.id);
            return (
              <div key={ch.id} onClick={()=>onSelect(ch)}
                style={{ padding:"18px 22px", borderRadius:14, cursor:"pointer",
                  background: done ? `${ch.accent}15` : ch.color,
                  border:`1px solid ${done ? ch.accent+"55" : ch.accent+"22"}`,
                  display:"flex", alignItems:"center", gap:14,
                  animation:`fadeUp ${.5+i*.07}s ease forwards`, opacity:0,
                  transition:"transform .15s, border-color .2s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateX(5px)"; e.currentTarget.style.borderColor=ch.accent+"77";}}
                onMouseLeave={e=>{e.currentTarget.style.transform=""; e.currentTarget.style.borderColor=done?ch.accent+"55":ch.accent+"22";}}>
                <span style={{ fontSize:26, flexShrink:0 }}>{ch.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:C.cream }}>{ch.label}</div>
                  <div style={{ fontSize:11, color:`${C.cream}50`, marginTop:3, fontWeight:300 }}>
                    {ch.tagline}
                    {partnerDone && !done && <span style={{ color:`${C.gold}77` }}> · Partner completed</span>}
                    {partnerDone && done && <span style={{ color:"#3DBE7A88" }}> · Both complete ✓</span>}
                  </div>
                </div>
                {done
                  ? <div style={{ width:22, height:22, borderRadius:"50%", background:ch.accent,
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:11, color:C.navy, fontWeight:600 }}>✓</span>
                    </div>
                  : <span style={{ fontSize:13, color:`${C.cream}33` }}>›</span>}
              </div>
            );
          })}
        </div>

        {/* Partner Invite */}
        <div onClick={()=>setShowPartner(true)} style={{ marginTop:14, padding:"16px 22px",
          borderRadius:14, cursor:"pointer", background:`${C.creamFaint}`,
          border:`1px solid ${C.creamFaint}`, display:"flex", alignItems:"center", gap:14,
          transition:"all .2s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.cream}22`;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.creamFaint;}}>
          <span style={{ fontSize:22 }}>💍</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:C.cream }}>
              {partnerProgress ? "Partner linked ✓" : "Invite your partner"}
            </div>
            <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>
              {partnerProgress ? "You can see their chapter progress above" : "See progress side-by-side and compare quiz answers"}
            </div>
          </div>
          <span style={{ fontSize:12, color:`${C.cream}33` }}>›</span>
        </div>

        {/* Ask V */}
        <div onClick={onChat} style={{ marginTop:10, padding:"16px 22px", borderRadius:14, cursor:"pointer",
          background:`${C.gold}12`, border:`1px solid ${C.gold}33`,
          display:"flex", alignItems:"center", gap:14, transition:"all .2s" }}
          onMouseEnter={e=>{e.currentTarget.style.background=`${C.gold}1E`;}}
          onMouseLeave={e=>{e.currentTarget.style.background=`${C.gold}12`;}}>
          <VAvatar size={34} />
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:C.gold }}>Ask V anything</div>
            <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>Answers matched to your situation</div>
          </div>
        </div>
        <div onClick={()=>onOpenTax()} style={{ marginTop:10, padding:"16px 22px", borderRadius:14, cursor:"pointer",
          background:"#0F2A1E", border:"1px solid #3DBE7A33",
          display:"flex", alignItems:"center", gap:14, transition:"all .2s" }}
          onMouseEnter={e=>{e.currentTarget.style.background="#3DBE7A15";}}
          onMouseLeave={e=>{e.currentTarget.style.background="#0F2A1E";}}>
          <span style={{fontSize:22}}>📊</span>
          <div>
            <div style={{fontSize:14, fontWeight:500, color:"#F4EFE6"}}>Tax Calculator</div>
            <div style={{fontSize:11, color:"#F4EFE644", marginTop:2}}>Should you file jointly or separately?</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    if (prof) { setProfile(prof); setScreen("map"); }
    else setScreen("onboarding");
    if (prog) setCompleted(prog.completed_chapters || []);
  };

  const handleProfileComplete = async (answers) => {
    setProfile(answers);
    await supabase.from("profiles").upsert({ id: user.id, ...answers });
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
                                   onChat={()=>setScreen("chat")} onOpenTax={()=>setScreen("tax")} onSignOut={handleSignOut} />}
      {screen==="lesson"      && activeChapter && <LessonScreen chapter={activeChapter} profile={profile}
                                   onComplete={handleChapterComplete} onBack={()=>setScreen("map")} />}
      {screen==="chat"        && <ChatScreen profile={profile} userId={user?.id} onBack={()=>setScreen("map")} />}
      {screen==="tax"         && <TaxCalculator onBack={()=>setScreen("map")} />}
    </>
  );
}
