/**
 * Vow — Tax Calculator Component
 *
 * DROP THIS FILE into /src/TaxCalculator.jsx
 *
 * Then in vow-app.jsx:
 * 1. Add this import at the top:
 *    import TaxCalculator from './TaxCalculator.jsx'
 *
 * 2. Add a state for the screen in the Root component (already has `screen` state):
 *    Just add "tax" as a possible screen value
 *
 * 3. In ChapterMap, add a button to open it (see comment below)
 *
 * 4. In the Root return, add:
 *    {screen==="tax" && <TaxCalculator onBack={()=>setScreen("map")} />}
 */

import { useState } from "react";

const C = {
  navy:"#0D1824", navyMid:"#152233", navyLight:"#1C2E42",
  gold:"#C9A84C", goldLight:"#E5C97A",
  cream:"#F4EFE6", creamDim:"#F4EFE699", creamFaint:"#F4EFE618",
  green:"#3DBE7A", red:"#F04C8C",
};

// ─── 2024 Tax Brackets ────────────────────────────────────────────────────────
// Each entry: [rate, bracket_size] — last bracket has Infinity
const BRACKETS_SINGLE = [
  [0.10, 11600],
  [0.12, 35550],  // 47150 - 11600
  [0.22, 53375],  // 100525 - 47150
  [0.24, 91425],  // 191950 - 100525
  [0.32, 51775],  // 243725 - 191950
  [0.35, 365625], // 609350 - 243725
  [0.37, Infinity],
];

const BRACKETS_MFJ = [
  [0.10, 23200],
  [0.12, 71100],  // 94300 - 23200
  [0.22, 106750], // 201050 - 94300
  [0.24, 182850], // 383900 - 201050
  [0.32, 103550], // 487450 - 383900
  [0.35, 243750], // 731200 - 487450
  [0.37, Infinity],
];

const STD_SINGLE = 14600;
const STD_MFJ    = 29200;

function calcTax(grossIncome, brackets, standardDeduction) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  let tax = 0;
  let remaining = taxable;
  for (const [rate, size] of brackets) {
    if (remaining <= 0) break;
    const inBracket = size === Infinity ? remaining : Math.min(remaining, size);
    tax += inBracket * rate;
    remaining -= inBracket;
  }
  return Math.round(tax);
}

function fmt(n) {
  return "$" + Math.abs(Math.round(n)).toLocaleString();
}

function effectiveRate(tax, income) {
  if (income <= 0) return "0.0";
  return ((tax / income) * 100).toFixed(1);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function IncomeInput({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : value ? Number(value).toLocaleString() : "";

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:500, letterSpacing:"1.5px", textTransform:"uppercase",
        color:`${C.cream}66`, marginBottom:8 }}>{label}</div>
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:20, top:"50%", transform:"translateY(-50%)",
          color: value ? C.gold : `${C.cream}33`, fontSize:16, fontWeight:500 }}>$</span>
        <input
          type={focused ? "number" : "text"}
          value={display}
          onChange={e => onChange(e.target.value.replace(/,/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0"
          style={{ width:"100%", padding:"14px 20px 14px 36px", borderRadius:12,
            background:C.navyMid, border:`1px solid ${focused ? C.gold+"66" : C.creamFaint}`,
            color:C.cream, fontSize:18, fontFamily:"'DM Sans',sans-serif",
            outline:"none", fontWeight:500, transition:"border-color .2s" }}
        />
      </div>
    </div>
  );
}

// ─── Result Bar ───────────────────────────────────────────────────────────────
function ResultBar({ label, tax, income, accent, highlight }) {
  return (
    <div style={{ padding:"18px 20px", borderRadius:14,
      background: highlight ? `${accent}18` : C.creamFaint,
      border:`1px solid ${highlight ? accent+"55" : C.creamFaint}`,
      transition:"all .3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:11, fontWeight:500, letterSpacing:"1.5px",
            textTransform:"uppercase", color: highlight ? accent : `${C.cream}55`,
            marginBottom:6 }}>{label}</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32,
            fontWeight:400, color:C.cream, lineHeight:1 }}>{fmt(tax)}</div>
          <div style={{ fontSize:12, color:`${C.cream}55`, marginTop:4 }}>
            {effectiveRate(tax, income)}% effective rate
          </div>
        </div>
        {highlight && (
          <div style={{ padding:"6px 14px", borderRadius:100, background:accent,
            color:C.navy, fontSize:11, fontWeight:600, letterSpacing:"1px", flexShrink:0 }}>
            RECOMMENDED
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bracket Breakdown ────────────────────────────────────────────────────────
function BracketBreakdown({ income, brackets, standardDeduction, accent }) {
  const taxable = Math.max(0, income - standardDeduction);
  let remaining = taxable;
  const rows = [];

  for (const [rate, size] of brackets) {
    if (remaining <= 0) break;
    const inBracket = size === Infinity ? remaining : Math.min(remaining, size);
    if (inBracket > 0) {
      rows.push({ rate, amount: inBracket, tax: Math.round(inBracket * rate) });
    }
    remaining -= inBracket;
    if (remaining <= 0) break;
  }

  return (
    <div style={{ marginTop:8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", padding:"8px 0",
          borderBottom: i < rows.length-1 ? `1px solid ${C.creamFaint}` : "none" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:8,
              background: `${accent}${Math.round(15 + (i/rows.length)*35).toString(16).padStart(2,"0")}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:600, color:accent }}>
              {Math.round(r.rate*100)}%
            </div>
            <div style={{ fontSize:13, color:`${C.cream}77` }}>
              {fmt(r.amount)} taxed at {Math.round(r.rate*100)}%
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:500, color:C.cream }}>{fmt(r.tax)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TaxCalculator({ onBack }) {
  const [myIncome, setMyIncome] = useState("");
  const [partnerIncome, setPartnerIncome] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const my = parseFloat(myIncome) || 0;
  const partner = parseFloat(partnerIncome) || 0;
  const combined = my + partner;
  const hasInputs = my > 0 && partner > 0;

  // Scenario 1: Filing Jointly
  const taxJoint = calcTax(combined, BRACKETS_MFJ, STD_MFJ);

  // Scenario 2: Filing Separately (each files as MFS — same brackets as single)
  const taxMySeparate = calcTax(my, BRACKETS_SINGLE, STD_SINGLE);
  const taxPartnerSeparate = calcTax(partner, BRACKETS_SINGLE, STD_SINGLE);
  const taxSeparateTotal = taxMySeparate + taxPartnerSeparate;

  // Scenario 3: What they'd pay as two singles (pre-marriage baseline)
  const taxMySingle = calcTax(my, BRACKETS_SINGLE, STD_SINGLE);
  const taxPartnerSingle = calcTax(partner, BRACKETS_SINGLE, STD_SINGLE);
  const taxSingleTotal = taxMySingle + taxPartnerSingle;

  const diff = taxSeparateTotal - taxJoint; // positive = joint is cheaper
  const vsPreMarriage = taxJoint - taxSingleTotal; // negative = marriage saved money

  const jointIsBetter = taxJoint <= taxSeparateTotal;
  const recommendation = jointIsBetter ? "jointly" : "separately";
  const savings = Math.abs(diff);

  const verdictColor = jointIsBetter ? C.green : C.gold;
  const verdictEmoji = jointIsBetter ? "💚" : "⚠️";

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg, #0F2A1E 0%, ${C.navy} 50%)`,
      paddingBottom:60 }}>
      {/* Header */}
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:12,
        borderBottom:`1px solid ${C.creamFaint}` }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
          color:`${C.cream}55`, cursor:"pointer", fontSize:22, padding:"4px 8px" }}>←</button>
        <div>
          <div style={{ fontSize:11, color:C.green, fontWeight:500, letterSpacing:"1px",
            textTransform:"uppercase" }}>Tax Calculator</div>
          <div style={{ fontSize:14, fontWeight:500, color:C.cream, marginTop:2 }}>Joint vs. Separate Filing</div>
        </div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"28px 20px" }}>

        {/* Intro */}
        <div style={{ marginBottom:28 }}>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300,
            color:C.cream, lineHeight:1.3, marginBottom:10 }}>
            Enter both incomes and we'll tell you exactly how to file.
          </p>
          <p style={{ fontSize:13, color:`${C.cream}55`, lineHeight:1.7, fontWeight:300 }}>
            Based on 2024 federal tax brackets and standard deductions. State taxes not included.
          </p>
        </div>

        {/* Inputs */}
        <div style={{ padding:"22px", borderRadius:16, background:C.creamFaint,
          border:`1px solid ${C.creamFaint}`, marginBottom:20 }}>
          <IncomeInput label="Your income" value={myIncome} onChange={setMyIncome} />
          <IncomeInput label="Partner's income" value={partnerIncome} onChange={setPartnerIncome} />

          {/* Combined */}
          {hasInputs && (
            <div style={{ padding:"12px 16px", borderRadius:10, background:`${C.gold}12`,
              border:`1px solid ${C.gold}22`, display:"flex", justifyContent:"space-between",
              alignItems:"center", marginTop:4 }}>
              <span style={{ fontSize:12, color:`${C.cream}66` }}>Combined household income</span>
              <span style={{ fontSize:15, fontWeight:500, color:C.gold }}>{fmt(combined)}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {hasInputs && (
          <div style={{ animation:"fadeUp .5s ease forwards" }}>

            {/* Verdict */}
            <div style={{ padding:"22px 24px", borderRadius:16,
              background:`${verdictColor}15`, border:`2px solid ${verdictColor}44`,
              marginBottom:20, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>{verdictEmoji}</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30,
                fontWeight:400, color:C.cream, lineHeight:1.2 }}>
                You should file{" "}
                <span style={{ color:verdictColor, fontStyle:"italic" }}>{recommendation}</span>
              </div>
              <div style={{ fontSize:15, color:verdictColor, marginTop:10, fontWeight:500 }}>
                {jointIsBetter
                  ? `Filing jointly saves you ${fmt(savings)} per year`
                  : `Filing separately saves you ${fmt(savings)} per year`}
              </div>
              {vsPreMarriage !== 0 && (
                <div style={{ fontSize:12, color:`${C.cream}44`, marginTop:8 }}>
                  {vsPreMarriage < 0
                    ? `Marriage saves you ${fmt(Math.abs(vsPreMarriage))}/yr vs. filing single`
                    : `Marriage costs you ${fmt(vsPreMarriage)}/yr vs. filing single (marriage penalty)`}
                </div>
              )}
            </div>

            {/* Side by side */}
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              <ResultBar
                label="Filing jointly"
                tax={taxJoint}
                income={combined}
                accent={C.green}
                highlight={jointIsBetter}
              />
              <ResultBar
                label="Filing separately (total)"
                tax={taxSeparateTotal}
                income={combined}
                accent={C.gold}
                highlight={!jointIsBetter}
              />
            </div>

            {/* Separate breakdown */}
            {!jointIsBetter && (
              <div style={{ padding:"16px 18px", borderRadius:12, background:C.creamFaint,
                border:`1px solid ${C.creamFaint}`, marginBottom:20, fontSize:13 }}>
                <div style={{ color:`${C.cream}66`, marginBottom:6 }}>Separate breakdown</div>
                <div style={{ display:"flex", justifyContent:"space-between", color:C.cream }}>
                  <span>Your tax</span><span style={{ fontWeight:500 }}>{fmt(taxMySeparate)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", color:C.cream, marginTop:4 }}>
                  <span>Partner's tax</span><span style={{ fontWeight:500 }}>{fmt(taxPartnerSeparate)}</span>
                </div>
              </div>
            )}

            {/* Bracket breakdown toggle */}
            <button onClick={()=>setShowBreakdown(b=>!b)}
              style={{ width:"100%", padding:"13px", borderRadius:100, background:"transparent",
                border:`1px solid ${C.creamFaint}`, color:`${C.cream}66`, fontSize:13,
                cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginBottom:16,
                transition:"all .2s" }}
              onMouseEnter={e=>{e.target.style.borderColor=`${C.cream}33`; e.target.style.color=C.cream;}}
              onMouseLeave={e=>{e.target.style.borderColor=C.creamFaint; e.target.style.color=`${C.cream}66`;}}>
              {showBreakdown ? "Hide" : "Show"} bracket breakdown
            </button>

            {showBreakdown && (
              <div style={{ padding:"20px", borderRadius:14, background:C.creamFaint,
                border:`1px solid ${C.creamFaint}`, marginBottom:20,
                animation:"fadeUp .3s ease forwards" }}>
                <div style={{ fontSize:11, fontWeight:500, letterSpacing:"1.5px",
                  textTransform:"uppercase", color:C.green, marginBottom:12 }}>
                  Filing jointly · {fmt(combined)} combined
                </div>
                <BracketBreakdown
                  income={combined}
                  brackets={BRACKETS_MFJ}
                  standardDeduction={STD_MFJ}
                  accent={C.green}
                />
              </div>
            )}

            {/* Key notes */}
            <div style={{ padding:"18px 20px", borderRadius:14,
              background:`${C.gold}0A`, border:`1px solid ${C.gold}22` }}>
              <div style={{ fontSize:11, fontWeight:500, letterSpacing:"1.5px",
                textTransform:"uppercase", color:C.gold, marginBottom:12 }}>Keep in mind</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  "These are federal estimates only — state taxes vary significantly.",
                  "If either of you is on income-driven student loan repayment, filing separately may preserve lower payments even if it costs more in taxes.",
                  "Update your W-4 at work to reflect your new filing status — otherwise you may under or overwithhold.",
                  "Consider running these numbers with a CPA if you have investments, self-employment income, or significant deductions.",
                ].map((note, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ color:C.gold, flexShrink:0, marginTop:2 }}>·</span>
                    <span style={{ fontSize:13, color:`${C.cream}77`, lineHeight:1.65 }}>{note}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!hasInputs && (
          <div style={{ textAlign:"center", padding:"40px 0", color:`${C.cream}33` }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
            <div style={{ fontSize:14 }}>Enter both incomes above to see your results</div>
          </div>
        )}
      </div>
    </div>
  );
}
