import { useState, useEffect } from "react";

// ── Scandi palette ──────────────────────────────────────────────
// Warm birch whites, slate blues, dusty sage, soft terracotta, charcoal
const S = {
  bg:       "#F5F0EB",
  surface:  "#FDFAF7",
  border:   "#DDD6CC",
  charcoal: "#2C2C2C",
  slate:    "#4A6274",
  sage:     "#7A9E87",
  clay:     "#C47C5A",
  straw:    "#D4A847",
  mist:     "#B8C9D4",
  textMid:  "#6B6560",
  textSoft: "#A09890",
};

const CAT = {
  protein: { icon: "⬡", label: "Protein", color: S.clay,  soft: "#F5E6DF", border: "#E8C4B0" },
  veg:     { icon: "⬡", label: "Veg",     color: S.sage,  soft: "#EAF2EC", border: "#C0D9C6" },
  grain:   { icon: "⬡", label: "Grain",   color: S.straw, soft: "#FAF3DF", border: "#E8D59A" },
  sauce:   { icon: "⬡", label: "Sauce",   color: S.slate, soft: "#E6EDF2", border: "#B5C8D5" },
};

const DEFAULTS = {
  protein: ["Chicken","Salmon","Tofu","Beef","Shrimp","Eggs","Lentils","Halloumi"],
  veg:     ["Broccoli","Spinach","Zucchini","Bell Pepper","Mushrooms","Kale","Asparagus","Fennel"],
  grain:   ["Rice","Quinoa","Pasta","Farro","Rye Bread","Couscous","Barley","Oats"],
  sauce:   ["Tahini","Miso Glaze","Lemon Herb","Pesto","Yoghurt Dill","Teriyaki","Tomato","Harissa"],
};

const TABS = ["planner","saved","shopping"];

// ── Helpers ──────────────────────────────────────────────────────
function useLocalStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

function Chip({ label, selected, onToggle, onRemove, color, soft, border }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", borderRadius:4,
      border:`1px solid ${selected ? color : border}`,
      background: selected ? color : soft,
      overflow:"hidden", transition:"all .15s" }}>
      <button onClick={onToggle} style={{ padding:"5px 11px", background:"none", border:"none",
        color: selected ? "#fff" : S.charcoal, fontSize:13, cursor:"pointer",
        fontFamily:"'Crimson Pro', Georgia, serif", letterSpacing:.3 }}>
        {label}
      </button>
      <button onClick={onRemove} style={{ padding:"5px 8px 5px 0", background:"none", border:"none",
        color: selected ? "rgba(255,255,255,.7)" : S.textSoft, fontSize:11, cursor:"pointer",
        lineHeight:1 }}>✕</button>
    </span>
  );
}

function SectionLabel({ text }) {
  return <div style={{ fontSize:10, letterSpacing:3, color:S.textSoft,
    textTransform:"uppercase", marginBottom:10 }}>{text}</div>;
}

// ── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [ingredients, setIngredients] = useLocalStorage("mkp_ingredients", DEFAULTS);
  const [selected, setSelected] = useState({ protein:[], veg:[], grain:[], sauce:[] });
  const [openCat, setOpenCat] = useState(null);
  const [newItem, setNewItem] = useState("");
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useLocalStorage("mkp_saved", []);
  const [shopping, setShopping] = useLocalStorage("mkp_shopping", []);
  const [tab, setTab] = useState("planner");
  const [newShopItem, setNewShopItem] = useState("");
  const [viewRecipe, setViewRecipe] = useState(null);

  const toggle = (cat, item) => setSelected(p => ({
    ...p, [cat]: p[cat].includes(item) ? p[cat].filter(i=>i!==item) : [...p[cat], item]
  }));

  const addIngredient = (cat) => {
    const v = newItem.trim();
    if (!v || ingredients[cat].includes(v)) return;
    setIngredients(p => ({ ...p, [cat]: [...p[cat], v] }));
    setNewItem("");
  };

  const removeIngredient = (cat, item) => {
    setIngredients(p => ({ ...p, [cat]: p[cat].filter(i=>i!==item) }));
    setSelected(p => ({ ...p, [cat]: p[cat].filter(i=>i!==item) }));
  };

  const canBuild = selected.protein.length && selected.veg.length && selected.grain.length;

  const buildRecipe = async () => {
    setLoading(true); setError(null); setRecipe(null);
    try {
      const parts = [`Protein: ${selected.protein.join(", ")}`,
        `Vegetables: ${selected.veg.join(", ")}`,
        `Grains: ${selected.grain.join(", ")}`];
      if (selected.sauce.length) parts.push(`Sauce/flavour: ${selected.sauce.join(", ")}`);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{ role:"user", content:
            `Create a practical, delicious recipe using:\n${parts.join("\n")}\n\nReturn ONLY valid JSON (no markdown, no backticks):\n{"name":"...","time":"...","servings":"2","description":"One appetising sentence.","steps":["...","...","...","...","..."],"tip":"One useful chef tip.","shoppingList":["item 1","item 2","item 3"]}` }]
        })
      });
      const data = await res.json();
      const text = data.content.map(b=>b.text||"").join("");
      setRecipe(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setError("Couldn't generate recipe — try again."); }
    setLoading(false);
  };

  const saveRecipe = () => {
    if (!recipe) return;
    const entry = { ...recipe, id: Date.now(), ingredients: { ...selected } };
    setSaved(p => [entry, ...p]);
  };

  const deleteRecipe = (id) => setSaved(p => p.filter(r=>r.id!==id));

  const addToShopping = (items) => {
    const fresh = items.filter(i => !shopping.find(s=>s.label===i));
    setShopping(p => [...p, ...fresh.map(i=>({ id:Date.now()+Math.random(), label:i, done:false }))]);
    setTab("shopping");
  };

  const reset = () => {
    setSelected({ protein:[], veg:[], grain:[], sauce:[] });
    setRecipe(null); setOpenCat(null);
  };

  // ── Nav ────────────────────────────────────────────────────────
  const navStyle = (t) => ({
    flex:1, padding:"10px 0", border:"none", background:"none", cursor:"pointer",
    color: tab===t ? S.slate : S.textSoft,
    borderTop: tab===t ? `2px solid ${S.slate}` : "2px solid transparent",
    fontSize:11, letterSpacing:2, textTransform:"uppercase",
    fontFamily:"'Crimson Pro', Georgia, serif", transition:"all .15s",
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:S.bg, fontFamily:"'Crimson Pro', Georgia, serif",
      maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ padding:"32px 24px 20px", background:S.surface, borderBottom:`1px solid ${S.border}` }}>
        <div style={{ fontSize:10, letterSpacing:5, color:S.textSoft, textTransform:"uppercase", marginBottom:4 }}>
          Köket · The Kitchen
        </div>
        <h1 style={{ margin:0, fontSize:30, fontWeight:400, color:S.charcoal, letterSpacing:.5 }}>
          Meal Planner
        </h1>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", background:S.surface, borderBottom:`1px solid ${S.border}` }}>
        {TABS.map(t => (
          <button key={t} style={navStyle(t)} onClick={()=>setTab(t)}>
            {t==="planner"?"Planner":t==="saved"?`Saved (${saved.length})`:`Shopping (${shopping.filter(i=>!i.done).length})`}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px 40px" }}>

        {/* ── PLANNER TAB ── */}
        {tab==="planner" && (
          <>
            {/* Category buttons */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {Object.entries(CAT).map(([cat, cfg]) => {
                const isOpen = openCat===cat;
                const n = selected[cat].length;
                return (
                  <button key={cat} onClick={()=>setOpenCat(isOpen?null:cat)} style={{
                    padding:"16px 12px", border:`1.5px solid ${isOpen ? cfg.color : cfg.border}`,
                    borderRadius:8, background: isOpen ? cfg.soft : S.surface,
                    cursor:"pointer", textAlign:"left", transition:"all .15s",
                  }}>
                    <div style={{ fontSize:11, letterSpacing:2, color: isOpen ? cfg.color : S.textSoft,
                      textTransform:"uppercase", marginBottom:4 }}>{cfg.label}</div>
                    <div style={{ fontSize:13, color: n ? S.charcoal : S.textSoft }}>
                      {n ? selected[cat].join(", ") : "tap to choose"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Expanded panel */}
            {openCat && (() => {
              const cfg = CAT[openCat];
              return (
                <div style={{ background:cfg.soft, border:`1px solid ${cfg.border}`,
                  borderRadius:10, padding:18, marginBottom:20 }}>
                  <SectionLabel text={`${cfg.label} · select & manage`} />
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:14 }}>
                    {ingredients[openCat].map(item => (
                      <Chip key={item} label={item}
                        selected={selected[openCat].includes(item)}
                        onToggle={()=>toggle(openCat,item)}
                        onRemove={()=>removeIngredient(openCat,item)}
                        {...cfg} />
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={newItem} onChange={e=>setNewItem(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addIngredient(openCat)}
                      placeholder={`Add ${openCat}…`}
                      style={{ flex:1, padding:"8px 12px", border:`1px solid ${cfg.border}`,
                        borderRadius:6, background:"#fff", fontSize:14, outline:"none",
                        fontFamily:"'Crimson Pro', Georgia, serif", color:S.charcoal }} />
                    <button onClick={()=>addIngredient(openCat)} style={{
                      padding:"8px 16px", border:"none", borderRadius:6,
                      background:cfg.color, color:"#fff", cursor:"pointer", fontSize:13 }}>
                      + Add
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Build button */}
            <button onClick={buildRecipe} disabled={!canBuild||loading} style={{
              width:"100%", padding:"15px", border:"none", borderRadius:8,
              background: canBuild ? S.slate : S.border,
              color: canBuild ? "#fff" : S.textSoft,
              fontSize:15, cursor: canBuild?"pointer":"not-allowed",
              letterSpacing:1, marginBottom:20, transition:"all .2s",
              fontFamily:"'Crimson Pro', Georgia, serif",
            }}>
              {loading ? "Preparing your recipe…" : canBuild ? "Build Recipe →" : "Select protein, veg & grain first"}
            </button>

            {error && <p style={{ color:S.clay, textAlign:"center", fontSize:14 }}>{error}</p>}

            {/* Recipe card */}
            {recipe && (
              <div style={{ background:S.surface, border:`1px solid ${S.border}`,
                borderRadius:10, padding:22, animation:"fadeIn .4s ease" }}>
                <SectionLabel text="Your recipe" />
                <h2 style={{ margin:"0 0 6px", fontSize:24, fontWeight:400, color:S.charcoal }}>
                  {recipe.name}
                </h2>
                <p style={{ color:S.textMid, fontSize:14, margin:"0 0 14px", fontStyle:"italic" }}>
                  {recipe.description}
                </p>
                <div style={{ display:"flex", gap:16, marginBottom:18 }}>
                  <span style={{ fontSize:13, color:S.slate }}>⏱ {recipe.time}</span>
                  <span style={{ fontSize:13, color:S.slate }}>◯ {recipe.servings} servings</span>
                </div>

                <SectionLabel text="Method" />
                <ol style={{ margin:"0 0 18px", paddingLeft:20 }}>
                  {recipe.steps?.map((step,i)=>(
                    <li key={i} style={{ fontSize:14, color:S.charcoal, marginBottom:9, lineHeight:1.7 }}>
                      {step}
                    </li>
                  ))}
                </ol>

                {recipe.tip && (
                  <div style={{ background:S.bg, borderLeft:`3px solid ${S.sage}`,
                    padding:"10px 14px", borderRadius:"0 6px 6px 0", marginBottom:18 }}>
                    <span style={{ fontSize:12, color:S.sage, fontWeight:700 }}>Tip — </span>
                    <span style={{ fontSize:13, color:S.textMid }}>{recipe.tip}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={saveRecipe} style={{
                    flex:1, padding:"10px", border:`1px solid ${S.sage}`, borderRadius:6,
                    background:"none", color:S.sage, cursor:"pointer", fontSize:13,
                    fontFamily:"'Crimson Pro', Georgia, serif" }}>
                    ♡ Save Recipe
                  </button>
                  {recipe.shoppingList?.length > 0 && (
                    <button onClick={()=>addToShopping(recipe.shoppingList)} style={{
                      flex:1, padding:"10px", border:`1px solid ${S.straw}`, borderRadius:6,
                      background:"none", color:S.straw, cursor:"pointer", fontSize:13,
                      fontFamily:"'Crimson Pro', Georgia, serif" }}>
                      + Shopping List
                    </button>
                  )}
                  <button onClick={reset} style={{
                    flex:1, padding:"10px", border:`1px solid ${S.border}`, borderRadius:6,
                    background:"none", color:S.textSoft, cursor:"pointer", fontSize:13,
                    fontFamily:"'Crimson Pro', Georgia, serif" }}>
                    ↩ Start Over
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SAVED TAB ── */}
        {tab==="saved" && (
          <>
            <SectionLabel text={`${saved.length} saved recipe${saved.length!==1?"s":""}`} />
            {saved.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:S.textSoft }}>
                <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
                <div style={{ fontSize:14 }}>No saved recipes yet.<br/>Build one in the Planner!</div>
              </div>
            )}
            {viewRecipe ? (
              <div style={{ background:S.surface, border:`1px solid ${S.border}`,
                borderRadius:10, padding:22 }}>
                <button onClick={()=>setViewRecipe(null)} style={{ background:"none", border:"none",
                  color:S.slate, cursor:"pointer", fontSize:13, marginBottom:14,
                  fontFamily:"'Crimson Pro', Georgia, serif" }}>
                  ← Back
                </button>
                <h2 style={{ margin:"0 0 6px", fontSize:24, fontWeight:400 }}>{viewRecipe.name}</h2>
                <p style={{ color:S.textMid, fontStyle:"italic", fontSize:14, margin:"0 0 14px" }}>
                  {viewRecipe.description}
                </p>
                <div style={{ display:"flex", gap:16, marginBottom:16 }}>
                  <span style={{ fontSize:13, color:S.slate }}>⏱ {viewRecipe.time}</span>
                  <span style={{ fontSize:13, color:S.slate }}>◯ {viewRecipe.servings} servings</span>
                </div>
                <SectionLabel text="Ingredients used" />
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                  {Object.entries(viewRecipe.ingredients||{}).flatMap(([cat,items])=>
                    items.map(i=>(
                      <span key={cat+i} style={{ fontSize:12, padding:"3px 10px",
                        borderRadius:4, background:CAT[cat]?.soft||S.bg,
                        border:`1px solid ${CAT[cat]?.border||S.border}`,
                        color:CAT[cat]?.color||S.charcoal }}>{i}</span>
                    ))
                  )}
                </div>
                <SectionLabel text="Method" />
                <ol style={{ margin:"0 0 16px", paddingLeft:20 }}>
                  {viewRecipe.steps?.map((s,i)=>(
                    <li key={i} style={{ fontSize:14, marginBottom:8, lineHeight:1.7, color:S.charcoal }}>{s}</li>
                  ))}
                </ol>
                {viewRecipe.tip && (
                  <div style={{ background:S.bg, borderLeft:`3px solid ${S.sage}`,
                    padding:"10px 14px", borderRadius:"0 6px 6px 0" }}>
                    <span style={{ fontSize:12, color:S.sage, fontWeight:700 }}>Tip — </span>
                    <span style={{ fontSize:13, color:S.textMid }}>{viewRecipe.tip}</span>
                  </div>
                )}
                {viewRecipe.shoppingList?.length > 0 && (
                  <button onClick={()=>addToShopping(viewRecipe.shoppingList)} style={{
                    marginTop:16, width:"100%", padding:"10px", border:`1px solid ${S.straw}`,
                    borderRadius:6, background:"none", color:S.straw, cursor:"pointer",
                    fontSize:13, fontFamily:"'Crimson Pro', Georgia, serif" }}>
                    + Add to Shopping List
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {saved.map(r => (
                  <div key={r.id} style={{ background:S.surface, border:`1px solid ${S.border}`,
                    borderRadius:8, padding:"14px 16px", display:"flex",
                    justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ cursor:"pointer" }} onClick={()=>setViewRecipe(r)}>
                      <div style={{ fontSize:16, color:S.charcoal, fontWeight:400 }}>{r.name}</div>
                      <div style={{ fontSize:12, color:S.textSoft, marginTop:2 }}>
                        {r.time} · {r.servings} servings
                      </div>
                    </div>
                    <button onClick={()=>deleteRecipe(r.id)} style={{ background:"none",
                      border:"none", color:S.textSoft, cursor:"pointer", fontSize:18, padding:"4px 8px" }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SHOPPING TAB ── */}
        {tab==="shopping" && (
          <>
            <SectionLabel text="Shopping list" />
            {/* Add item */}
            <div style={{ display:"flex", gap:8, marginBottom:18 }}>
              <input value={newShopItem} onChange={e=>setNewShopItem(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&newShopItem.trim()){
                  setShopping(p=>[...p,{id:Date.now(),label:newShopItem.trim(),done:false}]);
                  setNewShopItem("");
                }}}
                placeholder="Add item manually…"
                style={{ flex:1, padding:"9px 12px", border:`1px solid ${S.border}`,
                  borderRadius:6, background:S.surface, fontSize:14, outline:"none",
                  fontFamily:"'Crimson Pro', Georgia, serif", color:S.charcoal }} />
              <button onClick={()=>{
                if(!newShopItem.trim()) return;
                setShopping(p=>[...p,{id:Date.now(),label:newShopItem.trim(),done:false}]);
                setNewShopItem("");
              }} style={{ padding:"9px 16px", border:"none", borderRadius:6,
                background:S.slate, color:"#fff", cursor:"pointer", fontSize:13 }}>+ Add</button>
            </div>

            {shopping.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:S.textSoft }}>
                <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
                <div style={{ fontSize:14 }}>Your list is empty.<br/>Generate a recipe to auto-populate it!</div>
              </div>
            )}

            {/* Active items */}
            {shopping.filter(i=>!i.done).length > 0 && (
              <div style={{ marginBottom:20 }}>
                {shopping.filter(i=>!i.done).map(item=>(
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"11px 14px", background:S.surface, border:`1px solid ${S.border}`,
                    borderRadius:7, marginBottom:7, cursor:"pointer" }}
                    onClick={()=>setShopping(p=>p.map(i=>i.id===item.id?{...i,done:true}:i))}>
                    <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${S.border}`,
                      flexShrink:0 }} />
                    <span style={{ fontSize:14, color:S.charcoal }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Done items */}
            {shopping.filter(i=>i.done).length > 0 && (
              <>
                <SectionLabel text="Done" />
                {shopping.filter(i=>i.done).map(item=>(
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"10px 14px", background:S.bg, borderRadius:7, marginBottom:6,
                    opacity:.6, cursor:"pointer" }}
                    onClick={()=>setShopping(p=>p.map(i=>i.id===item.id?{...i,done:false}:i))}>
                    <div style={{ width:18, height:18, borderRadius:4, background:S.sage,
                      border:`1.5px solid ${S.sage}`, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"#fff", fontSize:11 }}>✓</div>
                    <span style={{ fontSize:14, color:S.textSoft, textDecoration:"line-through" }}>
                      {item.label}
                    </span>
                  </div>
                ))}
                <button onClick={()=>setShopping(p=>p.filter(i=>!i.done))} style={{
                  marginTop:10, width:"100%", padding:"9px", border:`1px solid ${S.border}`,
                  borderRadius:6, background:"none", color:S.textSoft, cursor:"pointer",
                  fontSize:13, fontFamily:"'Crimson Pro', Georgia, serif" }}>
                  Clear completed
                </button>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:${S.border}; border-radius:4px }
      `}</style>
    </div>
  );
}
