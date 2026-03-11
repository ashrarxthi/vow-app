/**
 * Vow — Marriage Financial Checklist
 *
 * 1. Add to src/Checklist.jsx
 * 2. Add SQL in Supabase SQL Editor:
 *
 * create table public.checklist (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users,
 *   item_id text,
 *   completed boolean default false,
 *   completed_at timestamptz,
 *   unique(user_id, item_id)
 * );
 * alter table public.checklist enable row level security;
 * create policy "Own checklist" on public.checklist for all using (auth.uid() = user_id);
 *
 * 3. In vow-app.jsx add:
 *    import Checklist from './Checklist.jsx'
 *
 * 4. Add to ChapterMap tools section:
 *    <div onClick={()=>onOpenChecklist()} ...>✅ Your Checklist</div>
 *
 * 5. Add to Root return:
 *    {screen==="checklist" && <Checklist profile={profile} userId={user?.id} onBack={()=>setScreen("map")} />}
 *
 * 6. Add onOpenChecklist={()=>setScreen("checklist")} to ChapterMap in Root
 */

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const L = {
  bg:"#F7F4EF", card:"#FFFFFF", cardAlt:"#F0EBE3",
  border:"#E2DAD0", text:"#1A1A2E", textMid:"#1A1A2E88",
  textFaint:"#1A1A2E44", gold:"#B8860B", goldBg:"#FDF6E3",
  goldBorder:"#C9A84C44", green:"#16a34a", greenBg:"#F0FDF4",
  greenBorder:"#3DBE7A55",
};

// ─── Checklist items database ─────────────────────────────────────────────────
// Each item: id, category, title, description, urgency (high/medium/low),
//            condition: fn(profile) => bool (whether to show this item)
const ALL_ITEMS = [
  // TAXES
  { id:"w4_update", category:"Taxes", icon:"📝", urgency:"high",
    title:"Update your W-4 at work",
    description:"File a new W-4 with your employer within 30 days of getting married. Your withholding is still calculated as if you're single.",
    link:"https://www.irs.gov/pub/irs-pdf/fw4.pdf", linkLabel:"Download W-4",
    condition: p => true },
  { id:"tax_scenario", category:"Taxes", icon:"🔢", urgency:"high",
    title:"Run joint vs. separate filing scenarios",
    description:"Use the Vow Tax Calculator to see exactly how much you save (or pay) under each filing status before your first married tax season.",
    condition: p => true },
  { id:"idr_check", category:"Taxes", icon:"🎓", urgency:"high",
    title:"Model student loan payments under joint filing",
    description:"If you're on income-driven repayment, your monthly payment could increase significantly when you file jointly. Run both scenarios at studentaid.gov before filing.",
    condition: p => ["studentLoans","both"].includes(p?.debt) },
  { id:"capital_gains", category:"Taxes", icon:"📈", urgency:"medium",
    title:"Review unrealized investment gains",
    description:"As a married couple you have a larger 0% capital gains bracket ($94,050). If you have appreciated investments, this year may be optimal to realize gains.",
    condition: p => ["100to200","over200"].includes(p?.income) },

  // ACCOUNTS
  { id:"joint_account", category:"Accounts", icon:"🏦", urgency:"high",
    title:"Open a joint bank account",
    description:"Set up a joint checking or high-yield savings account for shared expenses. SoFi and Ally offer no-fee accounts with 4.5%+ APY.",
    condition: p => true },
  { id:"emergency_fund", category:"Accounts", icon:"🛡️", urgency:"high",
    title:"Calculate and fund your emergency fund",
    description:"Add up monthly household expenses, multiply by 6. That's your joint emergency fund target. Keep it in a high-yield savings account.",
    condition: p => true },
  { id:"three_account", category:"Accounts", icon:"3️⃣", urgency:"medium",
    title:"Set up the 3-account system",
    description:"Decide on your monthly joint contribution amount and automate it. Each person keeps a personal account — what's left after contributing is yours to spend freely.",
    condition: p => true },
  { id:"money_date", category:"Accounts", icon:"🗓️", urgency:"medium",
    title:"Schedule your first monthly money date",
    description:"Put a recurring 30-minute calendar event in for the same night each month. Review accounts, progress, and set one shared goal.",
    condition: p => true },

  // LEGAL
  { id:"beneficiaries", category:"Legal", icon:"📌", urgency:"high",
    title:"Update all beneficiary designations",
    description:"Update: 401(k), IRA, life insurance, bank TOD, brokerage TOD, HSA. These override your will — do it within the first week after your honeymoon.",
    condition: p => true },
  { id:"will", category:"Legal", icon:"⚖️", urgency:"high",
    title:"Create a basic will and POA",
    description:"Set up a Last Will & Testament, Durable Power of Attorney, and Healthcare Directive. Trust & Will does all three online for couples for ~$199.",
    condition: p => true },
  { id:"prenup", category:"Legal", icon:"📜", urgency:"high",
    title:"Consider a prenuptial agreement",
    description:"Worth discussing if either of you owns a business, has significant assets or debt, or expects an inheritance. Must be done before the wedding.",
    condition: p => ["ownOne","ownBoth"].includes(p?.home) || ["iMore","theyMore"].includes(p?.partnerIncome) },
  { id:"name_change", category:"Legal", icon:"📛", urgency:"medium",
    title:"Complete name change (in order)",
    description:"Step 1: Social Security. Step 2: Driver's license. Step 3: Passport. Step 4: Banks and everything else. The order matters.",
    condition: p => true },
  { id:"title_check", category:"Legal", icon:"🏠", urgency:"medium",
    title:"Check how your home is titled",
    description:"Pull out your deed and make sure it says 'Joint Tenants with Right of Survivorship.' If not, a real estate attorney can update it for ~$300.",
    condition: p => ["ownOne","ownBoth"].includes(p?.home) },

  // INSURANCE
  { id:"health_insurance", category:"Insurance", icon:"🏥", urgency:"high",
    title:"Compare health insurance plans",
    description:"Marriage is a qualifying life event — you have 30–60 days to join each other's employer health plans. Compare total annual cost, not just premiums.",
    condition: p => true },
  { id:"auto_insurance", category:"Insurance", icon:"🚗", urgency:"high",
    title:"Get a married driver auto insurance requote",
    description:"Call your insurer and ask for a married household requote. Most couples save $300–$600/year. Don't wait for them to apply the discount automatically.",
    condition: p => true },
  { id:"life_insurance", category:"Insurance", icon:"🔒", urgency:"high",
    title:"Get life insurance quotes",
    description:"Compare quotes for $500K–$1M in 20-year term coverage. A 30-year-old pays ~$20–$25/month. Use Policygenius to compare 30+ insurers at once.",
    condition: p => true },
  { id:"disability_insurance", category:"Insurance", icon:"🩺", urgency:"medium",
    title:"Review disability insurance coverage",
    description:"Check your employer's long-term disability benefit. If it covers less than 60% of your income or has a short benefit period, consider a supplemental policy.",
    condition: p => ["100to200","over200"].includes(p?.income) },
  { id:"renters_consolidate", category:"Insurance", icon:"🏠", urgency:"medium",
    title:"Consolidate renters insurance to one policy",
    description:"Two separate policies cost more than one joint policy. Call your insurer, add your spouse, and cancel the duplicate. Takes one phone call.",
    condition: p => p?.home === "rent" },

  // RETIREMENT
  { id:"roth_ira", category:"Future Planning", icon:"📈", urgency:"high",
    title:"Open and max both Roth IRAs",
    description:"$7,000 each = $14,000/year growing tax-free. Start with whoever is in the lower tax bracket. Open at Fidelity, Vanguard, or Schwab.",
    condition: p => true },
  { id:"401k_match", category:"Future Planning", icon:"💼", urgency:"high",
    title:"Confirm both of you get the full 401(k) match",
    description:"Employer match is an instant 50–100% return. Make sure both of you are contributing at least enough to get the full match — this is the highest-priority investment.",
    condition: p => true },
  { id:"spousal_ira", category:"Future Planning", icon:"💑", urgency:"medium",
    title:"Set up a spousal IRA if one partner doesn't work",
    description:"A non-working spouse can still contribute $7,000/year to a Roth IRA funded by the working spouse's income. Don't leave this on the table.",
    condition: p => p?.partnerIncome === "oneIncome" },

  // HOME BUYING
  { id:"credit_scores", category:"Home Buying", icon:"📉", urgency:"high",
    title:"Check both credit scores",
    description:"Go to AnnualCreditReport.com — free, no credit card. Lenders use the lower of your two scores for mortgage pricing. Know where you both stand.",
    condition: p => ["buyingSoon","rent"].includes(p?.home) },
  { id:"mortgage_preapproval", category:"Home Buying", icon:"🏡", urgency:"high",
    title:"Get mortgage pre-approval from 2+ lenders",
    description:"Get pre-approved before house hunting. Compare at least two lenders — even 0.25% rate difference saves $20,000+ over 30 years. Shopping doesn't hurt your credit within 45 days.",
    condition: p => p?.home === "buyingSoon" },
  { id:"down_payment", category:"Home Buying", icon:"💰", urgency:"medium",
    title:"Set a down payment savings goal",
    description:"Target 20% to avoid PMI. On a $400K home, that's $80,000. Calculate your monthly savings rate to hit your target timeline and automate transfers.",
    condition: p => ["buyingSoon","rent"].includes(p?.home) },

  // KIDS
  { id:"parental_leave", category:"Family Planning", icon:"👶", urgency:"high",
    title:"Review both employers' parental leave policies",
    description:"Check paid leave weeks, whether it's full or partial pay, and any requirements (tenure, notice). The difference between policies can be $30,000+ in income.",
    condition: p => ["planKids","haveKids"].includes(p?.children) },
  { id:"childcare_budget", category:"Family Planning", icon:"🧸", urgency:"medium",
    title:"Research childcare costs in your area",
    description:"Infant care costs $18,000–$42,000/year in major cities. Research options now: daycare waitlists are 12–18 months long in many cities.",
    condition: p => ["planKids","haveKids"].includes(p?.children) },
  { id:"529_plan", category:"Family Planning", icon:"🎓", urgency:"medium",
    title:"Open a 529 college savings account",
    description:"529 contributions grow tax-free when used for education. You can open one before a child is born using your own SSN, then change the beneficiary.",
    condition: p => ["planKids","haveKids"].includes(p?.children) },
];

const CATEGORIES = ["Taxes","Accounts","Legal","Insurance","Future Planning","Home Buying","Family Planning"];
const URGENCY_ORDER = { high:0, medium:1, low:2 };

function CheckItem({ item, done, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius:14, background:done ? L.greenBg : L.card,
      border:`1px solid ${done ? L.greenBorder : L.border}`,
      overflow:"hidden", transition:"all .2s" }}>
      <div style={{ padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:12, cursor:"pointer" }}
        onClick={()=>setExpanded(e=>!e)}>
        <button onClick={e=>{ e.stopPropagation(); onToggle(); }}
          style={{ width:22, height:22, borderRadius:6, flexShrink:0, marginTop:1,
            background: done ? L.green : "transparent",
            border:`2px solid ${done ? L.green : L.border}`,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all .2s" }}>
          {done && <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>✓</span>}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>{item.icon}</span>
            <span style={{ fontSize:14, fontWeight:500,
              color: done ? L.textMid : L.text,
              textDecoration: done ? "line-through" : "none" }}>{item.title}</span>
            {item.urgency === "high" && !done && (
              <span style={{ padding:"2px 8px", borderRadius:100, background:"#FEF3C7",
                border:"1px solid #FCD34D", fontSize:10, fontWeight:600,
                color:"#92400E", flexShrink:0 }}>PRIORITY</span>
            )}
          </div>
        </div>
        <span style={{ fontSize:12, color:L.textFaint, flexShrink:0, marginTop:2 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div style={{ padding:"0 16px 16px 50px", animation:"fadeUp .2s ease forwards" }}>
          <p style={{ fontSize:13, color:L.textMid, lineHeight:1.7, marginBottom:10 }}>
            {item.description}
          </p>
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px",
                borderRadius:100, background:L.goldBg, border:`1px solid ${L.goldBorder}`,
                color:L.gold, fontSize:12, fontWeight:500, textDecoration:"none" }}>
              {item.linkLabel} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function Checklist({ profile, userId, onBack }) {
  const [completed, setCompleted] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  const items = ALL_ITEMS.filter(item => item.condition(profile));
  const visibleCategories = ["All", ...CATEGORIES.filter(cat =>
    items.some(item => item.category === cat)
  )];
  const filtered = activeCategory === "All" ? items
    : items.filter(i => i.category === activeCategory);
  const sorted = [...filtered].sort((a,b) => {
    if (completed[a.id] !== completed[b.id]) return completed[a.id] ? 1 : -1;
    return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
  });

  const doneCount = items.filter(i => completed[i.id]).length;
  const pct = Math.round((doneCount / items.length) * 100);

  useEffect(()=>{
    if (!userId) { setLoading(false); return; }
    (async()=>{
      const { data } = await supabase.from("checklist")
        .select("item_id, completed").eq("user_id", userId);
      if (data) {
        const map = {};
        data.forEach(row => { if (row.completed) map[row.item_id] = true; });
        setCompleted(map);
      }
      setLoading(false);
    })();
  }, [userId]);

  const toggle = async (itemId) => {
    const next = !completed[itemId];
    setCompleted(prev => ({ ...prev, [itemId]: next }));
    await supabase.from("checklist").upsert({
      user_id: userId, item_id: itemId,
      completed: next, completed_at: next ? new Date().toISOString() : null
    }, { onConflict: "user_id,item_id" });
  };

  return (
    <div style={{ minHeight:"100vh", background:L.bg, paddingBottom:60 }}>
      {/* Header */}
      <div style={{ background:L.card, borderBottom:`1px solid ${L.border}`,
        padding:"16px 20px", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:480, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <button onClick={onBack} style={{ background:"none", border:"none",
              color:L.textMid, cursor:"pointer", fontSize:22, padding:"4px 8px" }}>←</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:L.gold, fontWeight:600,
                letterSpacing:"1px", textTransform:"uppercase" }}>Your checklist</div>
              <div style={{ fontSize:17, fontWeight:500, color:L.text, marginTop:1 }}>
                {doneCount}/{items.length} complete
              </div>
            </div>
            <div style={{ fontSize:18, fontWeight:600,
              color: pct === 100 ? L.green : L.gold }}>{pct}%</div>
          </div>
          {/* Progress */}
          <div style={{ height:5, background:L.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:3, transition:"width .6s ease",
              background: pct===100 ? `linear-gradient(90deg,${L.green},#4ade80)` : `linear-gradient(90deg,${L.gold},#D4A017)`,
              width:`${pct}%` }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px" }}>
        {/* Category tabs */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4,
          scrollbarWidth:"none", marginBottom:20 }}>
          {visibleCategories.map(cat => (
            <button key={cat} onClick={()=>setActiveCategory(cat)}
              style={{ padding:"7px 14px", borderRadius:100, border:"none", cursor:"pointer",
                background: activeCategory===cat ? L.gold : L.card,
                color: activeCategory===cat ? "#fff" : L.textMid,
                fontSize:12, fontWeight:500, fontFamily:"'DM Sans',sans-serif",
                flexShrink:0, border:`1px solid ${activeCategory===cat ? L.gold : L.border}`,
                transition:"all .15s" }}>
              {cat}
              {cat !== "All" && (
                <span style={{ marginLeft:5, opacity:.7 }}>
                  {items.filter(i=>i.category===cat && completed[i.id]).length}/
                  {items.filter(i=>i.category===cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:L.textFaint }}>Loading...</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sorted.map(item => (
              <CheckItem key={item.id} item={item}
                done={!!completed[item.id]}
                onToggle={()=>toggle(item.id)} />
            ))}
          </div>
        )}

        {pct === 100 && (
          <div style={{ marginTop:24, padding:"24px", borderRadius:16, textAlign:"center",
            background:L.greenBg, border:`1px solid ${L.greenBorder}` }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26,
              fontWeight:300, color:L.text }}>You're financially ready.</div>
            <div style={{ fontSize:13, color:L.textMid, marginTop:8, lineHeight:1.7 }}>
              You've completed every item on your personalized list.
              Most couples never get this far — you're in great shape.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
