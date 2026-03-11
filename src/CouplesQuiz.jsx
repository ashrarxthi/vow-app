/**
 * Vow — Couples Money Comparison Quiz
 *
 * 1. Add to src/CouplesQuiz.jsx
 * 2. Add SQL in Supabase SQL Editor:
 *
 * create table public.quiz_answers (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users,
 *   question_id text,
 *   answer text,
 *   answered_at timestamptz default now(),
 *   unique(user_id, question_id)
 * );
 * alter table public.quiz_answers enable row level security;
 * create policy "Own quiz" on public.quiz_answers for all using (auth.uid() = user_id);
 * create policy "Partner quiz read" on public.quiz_answers for select using (
 *   auth.uid() in (
 *     select created_by from public.partner_links where partner_id = user_id
 *     union
 *     select partner_id from public.partner_links where created_by = user_id
 *   )
 * );
 *
 * 3. In vow-app.jsx add:
 *    import CouplesQuiz from './CouplesQuiz.jsx'
 *
 * 4. Add to tools section in ChapterMap:
 *    onOpenQuiz button
 *
 * 5. Add to Root return:
 *    {screen==="quiz" && <CouplesQuiz userId={user?.id} onBack={()=>setScreen("map")} />}
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
  greenBorder:"#3DBE7A55", purple:"#7C3AED", purpleBg:"#F5F3FF",
  purpleBorder:"#A04CF055",
};

const QUESTIONS = [
  { id:"spending_style", emoji:"💸", category:"Money Mindset",
    question:"When you get an unexpected $1,000, what's your first instinct?",
    options:[
      { value:"save_all", label:"Save all of it immediately" },
      { value:"save_most", label:"Save most, spend a little on something fun" },
      { value:"split", label:"Split it 50/50 between saving and spending" },
      { value:"spend", label:"Spend it — that's what windfalls are for" },
    ]},
  { id:"financial_goal", emoji:"🎯", category:"Money Mindset",
    question:"What's your most important financial goal right now?",
    options:[
      { value:"home", label:"Buy a home" },
      { value:"retire_early", label:"Retire as early as possible" },
      { value:"debt_free", label:"Get completely debt-free" },
      { value:"experiences", label:"Fund experiences and travel" },
    ]},
  { id:"risk_tolerance", emoji:"📊", category:"Investing",
    question:"How would you react if your investments dropped 30% in a year?",
    options:[
      { value:"buy_more", label:"Buy more — great sale" },
      { value:"hold", label:"Hold steady and wait it out" },
      { value:"nervous", label:"Feel nervous but not sell" },
      { value:"sell", label:"Seriously consider moving to safer options" },
    ]},
  { id:"joint_finances", emoji:"🏦", category:"Money System",
    question:"How do you think couples should handle finances?",
    options:[
      { value:"fully_joint", label:"Fully combined — one pot, total transparency" },
      { value:"mostly_joint", label:"Mostly joint with small personal accounts" },
      { value:"three_account", label:"3-account method — yours, mine, ours" },
      { value:"mostly_separate", label:"Mostly separate — split shared bills" },
    ]},
  { id:"big_purchase", emoji:"🛍️", category:"Money System",
    question:"For a $500 personal purchase, should you need to tell your partner?",
    options:[
      { value:"always", label:"Yes, always — full transparency" },
      { value:"depends", label:"Depends on our budget situation" },
      { value:"no_judgment", label:"No — personal money is personal" },
      { value:"only_big", label:"Only if it's over a certain agreed amount" },
    ]},
  { id:"debt_approach", emoji:"📋", category:"Debt",
    question:"If one partner has significant debt, how should the couple approach it?",
    options:[
      { value:"together", label:"Attack it together as a team — one shared problem" },
      { value:"support", label:"The person with debt owns it, but partner provides emotional support" },
      { value:"separate", label:"Completely their responsibility — separate finances" },
      { value:"case_by_case", label:"Depends on how we got here" },
    ]},
  { id:"lifestyle_creep", emoji:"🏡", category:"Lifestyle",
    question:"As your income grows, spending should:",
    options:[
      { value:"stay_same", label:"Stay the same — invest all extra income" },
      { value:"small_increase", label:"Increase modestly — enjoy some of it" },
      { value:"proportional", label:"Increase proportionally with income" },
      { value:"spend_now", label:"Increase significantly — life is for living" },
    ]},
  { id:"financial_stress", emoji:"😰", category:"Communication",
    question:"When you're stressed about money, you tend to:",
    options:[
      { value:"talk_immediately", label:"Talk to my partner right away" },
      { value:"process_first", label:"Process it alone first, then talk" },
      { value:"research", label:"Research solutions before bringing it up" },
      { value:"avoid", label:"Try to handle it quietly and not worry them" },
    ]},
  { id:"kids_money", emoji:"👶", category:"Family",
    question:"How should kids learn about money?",
    options:[
      { value:"allowance", label:"Allowance with no strings — theirs to manage" },
      { value:"earn_it", label:"Earn it through chores and responsibilities" },
      { value:"invest_early", label:"Give them an investment account and teach investing" },
      { value:"open_books", label:"Full transparency — show them the real family finances" },
    ]},
  { id:"retirement_vision", emoji:"🌅", category:"Future",
    question:"What does retirement look like to you?",
    options:[
      { value:"early_retire", label:"As early as possible, even if we have to cut back now" },
      { value:"traditional", label:"Traditional retirement around 65 with comfort" },
      { value:"never_stop", label:"I'd keep working in some capacity — I like staying busy" },
      { value:"gradual", label:"Gradual wind-down — reduce hours over time" },
    ]},
];

const AGREE_PAIRS = {
  spending_style: { save_all:"save_all", save_most:"save_most", split:"split", spend:"spend" },
  financial_goal: true,
  risk_tolerance: true,
  joint_finances: true,
  big_purchase: true,
  debt_approach: true,
  lifestyle_creep: true,
  financial_stress: true,
  kids_money: true,
  retirement_vision: true,
};

function getAgreement(a1, a2) {
  if (!a1 || !a2) return null;
  if (a1 === a2) return "agree";
  // Near matches
  const nearMatches = {
    save_all: ["save_most"], save_most: ["save_all","split"],
    split: ["save_most"], mostly_joint: ["three_account","fully_joint"],
    three_account: ["mostly_joint"], hold: ["buy_more","nervous"],
    nervous: ["hold"],
  };
  if (nearMatches[a1]?.includes(a2) || nearMatches[a2]?.includes(a1)) return "close";
  return "differ";
}

const AGREEMENT_STYLE = {
  agree: { bg:"#F0FDF4", border:"#3DBE7A55", dot:"#16a34a", label:"You agree ✓" },
  close: { bg:"#FEF9EC", border:"#FCD34D55", dot:"#D97706", label:"Close" },
  differ: { bg:"#FFF1F2", border:"#FDA4AF55", dot:"#E11D48", label:"Different views" },
};

function QuizMode({ userId, onDone }) {
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  useEffect(()=>{
    // Load existing answers
    (async()=>{
      const { data } = await supabase.from("quiz_answers")
        .select("question_id, answer").eq("user_id", userId);
      if (data?.length) {
        const map = {};
        data.forEach(r => { map[r.question_id] = r.answer; });
        setAnswers(map);
        // Find first unanswered
        const firstUnanswered = QUESTIONS.findIndex(q => !map[q.id]);
        if (firstUnanswered === -1) onDone();
        else setStep(firstUnanswered);
      }
    })();
  }, []);

  const pick = async (val) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    await supabase.from("quiz_answers").upsert(
      { user_id: userId, question_id: q.id, answer: val },
      { onConflict: "user_id,question_id" }
    );
    if (!isLast) { setStep(s => s + 1); }
    else { setSaving(true); onDone(); }
  };

  const answered = Object.keys(answers).length;

  return (
    <div style={{ minHeight:"100vh", background:L.bg }}>
      {/* Header */}
      <div style={{ background:L.card, borderBottom:`1px solid ${L.border}`,
        padding:"16px 20px" }}>
        <div style={{ maxWidth:480, margin:"0 auto" }}>
          <div style={{ fontSize:11, color:L.purple, fontWeight:600,
            letterSpacing:"1px", textTransform:"uppercase", marginBottom:4 }}>
            {q.category}
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {QUESTIONS.map((_,i) => (
              <div key={i} style={{ flex:1, height:3, borderRadius:2,
                background: i < step ? L.purple : i === step ? L.purple : L.border,
                opacity: i < step ? 1 : i === step ? 1 : .4 }} />
            ))}
          </div>
          <div style={{ fontSize:11, color:L.textFaint, marginTop:6 }}>
            {step+1} of {QUESTIONS.length} · {answered} answered
          </div>
        </div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 20px" }}>
        <div key={step} style={{ animation:"fadeUp .3s ease forwards" }}>
          <div style={{ fontSize:44, marginBottom:16 }}>{q.emoji}</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30,
            fontWeight:300, color:L.text, lineHeight:1.3, marginBottom:28 }}>
            {q.question}
          </h2>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {q.options.map(opt => {
              const selected = answers[q.id] === opt.value;
              return (
                <button key={opt.value} onClick={()=>pick(opt.value)}
                  style={{ padding:"16px 20px", borderRadius:14, cursor:"pointer",
                    textAlign:"left", border:`1px solid ${selected ? L.purple+"88" : L.border}`,
                    background: selected ? L.purpleBg : L.card,
                    color:L.text, fontSize:14, fontFamily:"'DM Sans',sans-serif",
                    fontWeight: selected ? 500 : 400, transition:"all .15s",
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}
                  onMouseEnter={e=>{if(!selected){e.currentTarget.style.borderColor=L.purple+"55"; e.currentTarget.style.background=L.purpleBg;}}}
                  onMouseLeave={e=>{if(!selected){e.currentTarget.style.borderColor=L.border; e.currentTarget.style.background=L.card;}}}>
                  {opt.label}
                  {selected && <span style={{ color:L.purple, fontWeight:700 }}>✓</span>}
                </button>
              );
            })}
          </div>
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)}
              style={{ marginTop:16, background:"none", border:"none",
                color:L.textFaint, cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
              ← Previous question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonMode({ userId, onRetake }) {
  const [myAnswers, setMyAnswers] = useState({});
  const [partnerAnswers, setPartnerAnswers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(()=>{
    (async()=>{
      // My answers
      const { data: mine } = await supabase.from("quiz_answers")
        .select("question_id, answer").eq("user_id", userId);
      const myMap = {};
      mine?.forEach(r => { myMap[r.question_id] = r.answer; });
      setMyAnswers(myMap);

      // Partner answers via partner_links
      const { data: link } = await supabase.from("partner_links")
        .select("created_by, partner_id")
        .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
        .not("partner_id","is",null)
        .single();

      if (link) {
        const partnerId = link.created_by === userId ? link.partner_id : link.created_by;
        const { data: theirs } = await supabase.from("quiz_answers")
          .select("question_id, answer").eq("user_id", partnerId);
        const theirMap = {};
        theirs?.forEach(r => { theirMap[r.question_id] = r.answer; });
        setPartnerAnswers(theirMap);
      }
      setLoading(false);
    })();
  }, [userId]);

  const categories = ["All", ...new Set(QUESTIONS.map(q => q.category))];
  const filtered = activeFilter === "All" ? QUESTIONS
    : QUESTIONS.filter(q => q.category === activeFilter);

  const agreed = QUESTIONS.filter(q => getAgreement(myAnswers[q.id], partnerAnswers?.[q.id]) === "agree").length;
  const close = QUESTIONS.filter(q => getAgreement(myAnswers[q.id], partnerAnswers?.[q.id]) === "close").length;
  const differ = QUESTIONS.filter(q => getAgreement(myAnswers[q.id], partnerAnswers?.[q.id]) === "differ").length;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:L.bg, display:"flex",
      alignItems:"center", justifyContent:"center", color:L.textFaint }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:L.bg, paddingBottom:60 }}>
      {/* Summary card */}
      {partnerAnswers && (
        <div style={{ background:L.card, borderBottom:`1px solid ${L.border}`,
          padding:"20px", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ maxWidth:480, margin:"0 auto" }}>
            <div style={{ fontSize:11, color:L.purple, fontWeight:600,
              letterSpacing:"1px", textTransform:"uppercase", marginBottom:10 }}>
              Couples comparison
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {[
                { label:"Agree", count:agreed, color:"#16a34a", bg:"#F0FDF4" },
                { label:"Close", count:close, color:"#D97706", bg:"#FEF9EC" },
                { label:"Differ", count:differ, color:"#E11D48", bg:"#FFF1F2" },
              ].map(s => (
                <div key={s.label} style={{ flex:1, padding:"10px", borderRadius:12,
                  background:s.bg, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.count}</div>
                  <div style={{ fontSize:10, color:s.color, fontWeight:500, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px" }}>

        {!partnerAnswers && (
          <div style={{ padding:"24px", borderRadius:16, background:L.purpleBg,
            border:`1px solid ${L.purpleBorder}`, marginBottom:20, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>💑</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24,
              fontWeight:300, color:L.text, marginBottom:8 }}>
              Invite your partner to compare
            </div>
            <div style={{ fontSize:13, color:L.textMid, lineHeight:1.7 }}>
              Once your partner completes the quiz, you'll see a side-by-side comparison of every question — where you agree, where you're close, and where you see things differently.
            </div>
            <div style={{ marginTop:14, padding:"12px 16px", borderRadius:10,
              background:L.card, border:`1px solid ${L.border}`,
              fontSize:13, color:L.textMid }}>
              Share your partner invite link from the chapter map → Partner Sync
            </div>
          </div>
        )}

        {/* Category filter */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4,
          scrollbarWidth:"none", marginBottom:16 }}>
          {categories.map(cat => (
            <button key={cat} onClick={()=>setActiveFilter(cat)}
              style={{ padding:"6px 14px", borderRadius:100, border:"none", cursor:"pointer",
                background: activeFilter===cat ? L.purple : L.card,
                color: activeFilter===cat ? "#fff" : L.textMid,
                fontSize:12, fontWeight:500, fontFamily:"'DM Sans',sans-serif",
                flexShrink:0, border:`1px solid ${activeFilter===cat ? L.purple : L.border}`,
                transition:"all .15s" }}>
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(q => {
            const myA = myAnswers[q.id];
            const partnerA = partnerAnswers?.[q.id];
            const agreement = partnerAnswers ? getAgreement(myA, partnerA) : null;
            const style = agreement ? AGREEMENT_STYLE[agreement] : null;
            const myLabel = q.options.find(o => o.value === myA)?.label;
            const partnerLabel = q.options.find(o => o.value === partnerA)?.label;

            return (
              <div key={q.id} style={{ borderRadius:16, overflow:"hidden",
                background: style ? style.bg : L.card,
                border:`1px solid ${style ? style.border : L.border}` }}>
                <div style={{ padding:"16px 18px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:20 }}>{q.emoji}</span>
                      <span style={{ fontSize:11, color:L.textFaint, fontWeight:500,
                        textTransform:"uppercase", letterSpacing:"1px" }}>{q.category}</span>
                    </div>
                    {style && (
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:7, height:7, borderRadius:"50%",
                          background:style.dot }} />
                        <span style={{ fontSize:11, fontWeight:600, color:style.dot }}>
                          {style.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:14, color:L.text, fontWeight:500,
                    lineHeight:1.4, marginBottom:14 }}>{q.question}</div>

                  {/* Answers */}
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ padding:"10px 14px", borderRadius:10,
                      background:L.card, border:`1px solid ${L.border}`,
                      display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ fontSize:11, color:L.textFaint, fontWeight:500,
                        width:40, flexShrink:0 }}>You</div>
                      <div style={{ fontSize:13, color: myA ? L.text : L.textFaint,
                        fontStyle: myA ? "normal" : "italic" }}>
                        {myLabel || "Not answered yet"}
                      </div>
                    </div>
                    {partnerAnswers !== null && (
                      <div style={{ padding:"10px 14px", borderRadius:10,
                        background:L.card, border:`1px solid ${L.border}`,
                        display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ fontSize:11, color:L.purple, fontWeight:500,
                          width:40, flexShrink:0 }}>Partner</div>
                        <div style={{ fontSize:13, color: partnerA ? L.text : L.textFaint,
                          fontStyle: partnerA ? "normal" : "italic" }}>
                          {partnerLabel || "Not answered yet"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conversation starter for differences */}
                  {agreement === "differ" && (
                    <div style={{ marginTop:12, padding:"10px 14px", borderRadius:10,
                      background:"#fff", border:"1px solid #FDA4AF55" }}>
                      <div style={{ fontSize:10, fontWeight:600, color:"#E11D48",
                        letterSpacing:"1px", textTransform:"uppercase", marginBottom:4 }}>
                        💬 Good conversation to have
                      </div>
                      <div style={{ fontSize:12, color:L.textMid, lineHeight:1.6 }}>
                        {getConversationStarter(q.id)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onRetake}
          style={{ width:"100%", marginTop:20, padding:"13px", borderRadius:100,
            background:"transparent", border:`1px solid ${L.border}`, color:L.textMid,
            fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          Change my answers
        </button>
      </div>
    </div>
  );
}

function getConversationStarter(questionId) {
  const starters = {
    spending_style: "Talk about what you each do when you get unexpected money. Neither approach is wrong — but knowing each other's instinct helps you plan together.",
    financial_goal: "Your top financial priorities are different right now. Try listing your top 3 each and see where they overlap — you may be more aligned than this suggests.",
    risk_tolerance: "Your risk tolerance differs. This matters most for how you invest jointly. Talk about what a 30% portfolio drop would actually feel like for each of you.",
    joint_finances: "You have different visions for how to run your money day-to-day. This is one of the most important systems to agree on early — worth a dedicated conversation.",
    big_purchase: "You have different intuitions about financial autonomy. The key is agreeing on a threshold — what amount requires a conversation? Set that number together.",
    debt_approach: "You see debt differently. If either of you carries debt, how you approach it as a couple will matter a lot. Worth discussing your philosophy explicitly.",
    lifestyle_creep: "You have different ideas about how your lifestyle should evolve with income. This often shows up as conflict around promotions and raises — talk about it now.",
    financial_stress: "You handle financial stress differently. Knowing this about each other prevents a lot of misunderstanding when money gets tight.",
    kids_money: "You have different instincts about teaching kids about money. Not a crisis — but worth aligning on before you're in the moment.",
    retirement_vision: "Your retirement visions differ. This affects how aggressively you save now. Even a 5-year difference in target retirement age has a major financial impact.",
  };
  return starters[questionId] || "This is a good topic to explore together over your next money date.";
}

export default function CouplesQuiz({ userId, onBack }) {
  const [mode, setMode] = useState("loading"); // loading | quiz | results

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.from("quiz_answers")
        .select("question_id").eq("user_id", userId);
      if (data?.length === QUESTIONS.length) setMode("results");
      else setMode("quiz");
    })();
  }, [userId]);

  return (
    <div>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      {/* Back button */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50,
        pointerEvents:"none" }}>
        <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          pointerEvents:"all" }}>
          <button onClick={onBack} style={{ width:36, height:36, borderRadius:"50%",
            background:L.card, border:`1px solid ${L.border}`, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, color:L.textMid, boxShadow:"0 2px 8px rgba(0,0,0,.08)" }}>←</button>
          {mode === "results" && (
            <button onClick={()=>setMode("quiz")}
              style={{ padding:"8px 16px", borderRadius:100, background:L.purple,
                color:"#fff", border:"none", fontSize:12, fontWeight:500,
                cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                boxShadow:"0 2px 8px rgba(124,58,237,.3)" }}>
              Edit answers
            </button>
          )}
        </div>
      </div>

      <div style={{ paddingTop:60 }}>
        {mode === "loading" && (
          <div style={{ minHeight:"100vh", background:L.bg, display:"flex",
            alignItems:"center", justifyContent:"center", color:L.textFaint }}>
            Loading...
          </div>
        )}
        {mode === "quiz" && (
          <QuizMode userId={userId} onDone={()=>setMode("results")} />
        )}
        {mode === "results" && (
          <ComparisonMode userId={userId} onRetake={()=>setMode("quiz")} />
        )}
      </div>
    </div>
  );
}
