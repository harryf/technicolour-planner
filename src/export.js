/* =========================================================================
   Office exports for 🌈 Sarah's Amazing Technicolour Planner.
   Browser ES module. Builds .xlsx / .docx / .pptx in the browser and downloads
   them — nothing is uploaded. Ported from the approach-1 Node generators
   (build_xlsx.ts, build_doc_and_slides.ts) but driven by the LIVE state.

   The three libraries are loaded as UMD globals by the caller BEFORE these run:
     window.ExcelJS     (exceljs)          → exportXlsx
     window.docx        (docx)             → exportDocx
     window.PptxGenJS   (pptxgenjs)        → exportPptx
   Each function checks its global and throws a friendly Error if missing.
   ========================================================================= */

/* ---- Sarah's colour model (kept in sync with index.html) ---- */
const ARGB = { // ExcelJS wants 8-digit ARGB
  reel:"FF8B5CF6", post:"FF22C55E", story:"FF14B8A6",
  discovery:"FF9AA0A6", authority:"FFFF9DCD", conversion:"FF3B82F6", retention:"FF111111",
  brainstorm:"FF3B82F6", shoot:"FFEAB308", edit:"FF22C55E", priority:"FFEF4444", justdo:"FF8B5CF6",
  head:"FF23211E",
};
const HEX = { // 6-digit for docx / pptxgenjs
  reel:"8B5CF6", post:"22C55E", story:"14B8A6",
  discovery:"9AA0A6", authority:"FF9DCD", conversion:"3B82F6", retention:"111111",
  brainstorm:"3B82F6", shoot:"EAB308", edit:"22C55E", priority:"EF4444", justdo:"8B5CF6",
};
const TYPE_SHORT = { reel:"R", post:"P", story:"S" };
const TYPE_LABEL = { reel:"Reel", post:"Post", story:"Story" };
const TARGET_LABEL = { discovery:"Discovery", authority:"Authority", conversion:"Conversion", retention:"Retention" };
const TARGET_SHORT = { discovery:"Disc", authority:"Auth", conversion:"Conv", retention:"Ret" };
const TARGET_ORDER = ["discovery","authority","conversion","retention"];
const STAGES = ["prep","shot","edited","posted"];
const STORY_CODES = { 1:"Presence", 2:"Process", 3:"Engagement", 4:"Soft CTA", 5:"Share" };
const ACT_LABEL = { brainstorm:"Brainstorm", shoot:"Shoot", edit:"Edit", priority:"Priority", justdo:"Just do it" };
const HOOK_TABLE = [
  ["Strong first 1.5 s",["curiosity"]],["Opinion",["curiosity","pattern","identity","controversy"]],
  ["Wipe reveal",["visual"]],["Start mid-action",["visual","pattern"]],["Regional",["curiosity","identity"]],
  ["Controversy",["curiosity","pattern","controversy"]],["Movement hook",["curiosity","visual"]],
  ["Unexpected angle",["curiosity","pattern"]],["Fast cuts",["pattern"]],
  ["Bold text / statement",["curiosity","pattern","identity","controversy"]],["Hand motion",["visual"]],
  ["Linework satisfaction",["visual"]],["Tape peel satisfaction",["visual"]],["Stencil peel satisfaction",["visual"]],
  ["Before / after",["visual","curiosity"]],["Relatable content",["curiosity","pattern","identity","controversy"]],
  ["Advice",["curiosity","controversy","visual"]],["Sharable",["identity","controversy"]],["Trend",["identity"]],
  ["Funny observation",["curiosity","pattern","identity","controversy"]],["Close up",["visual"]],
  ["Colour packing",["visual"]],["Lining",["visual"]],["Sketch to skin",["visual","curiosity"]],
  ["Details (eyes/hair)",["visual"]],["Finished work",["visual"]],["Sensory satisfaction",["visual","curiosity"]],
  ["Healed vs fresh",["curiosity","visual"]],["Strong eye contact (3 s)",["pattern"]],
];

/* ---- small helpers ---- */
const white = { color:{ argb:"FFFFFFFF" } };
const fill = (argb) => ({ type:"pattern", pattern:"solid", fgColor:{ argb } });
function today(){ return new Date().toISOString().slice(0,10); }
function download(blob, name){
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function parseYMD(s){ const [y,m,d]=String(s).split("-").map(Number); return new Date(y,m-1,d); }
function addDays(s,n){ const d=parseYMD(s); d.setDate(d.getDate()+n); return ymd(d); }
function isoWeekStart(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return ymd(x); }
function weekStartOf(state){ return state && state.weekStart ? state.weekStart : isoWeekStart(new Date()); }
function projectsOf(state){ return (state && Array.isArray(state.projects)) ? state.projects : []; }

/* ========================================================================
   XLSX — Projects + Calendar + Hooks + Turn-over, colour-coded.
   ======================================================================== */
export async function exportXlsx(state){
  if(!window.ExcelJS) throw new Error("Excel export library not loaded");
  const ExcelJS = window.ExcelJS;
  const projects = projectsOf(state);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sarah's Amazing Technicolour Planner"; wb.created = new Date();

  const headerRow = (ws, cols, widths) => {
    const r = ws.getRow(1);
    cols.forEach((c,i)=>{ const cell=r.getCell(i+1); cell.value=c; cell.fill=fill(ARGB.head);
      cell.font={bold:true,...white}; cell.alignment={vertical:"middle"}; });
    r.height=22; widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
    ws.views=[{state:"frozen",ySplit:1}];
    ws.autoFilter={ from:{row:1,column:1}, to:{row:1,column:cols.length} };
  };

  /* ----- Projects ----- */
  const ws = wb.addWorksheet("Projects");
  headerRow(ws,
    ["Project","Type","Disc","Auth","Conv","Ret","Date","Music","Hook","Description","Prep","Shot","Edited","Posted","Notes"],
    [26,7,6,6,6,6,12,26,22,40,6,6,7,7,28]);
  projects.forEach((p,i)=>{
    const r = ws.getRow(i+2);
    r.getCell(1).value = p.title || "";
    const letter = TYPE_SHORT[p.type] || "?";
    const tc = r.getCell(2); tc.value = letter; tc.fill = fill(ARGB[p.type] || ARGB.reel);
    tc.font = { bold:true, ...white }; tc.alignment = { horizontal:"center" };
    const tgCols = { discovery:3, authority:4, conversion:5, retention:6 };
    (p.targets || []).forEach(k=>{ const col = tgCols[k]; if(!col) return;
      const cell = r.getCell(col); cell.value = "x"; cell.fill = fill(ARGB[k]);
      if(k==="retention") cell.font = white; cell.alignment = { horizontal:"center" }; });
    r.getCell(7).value = p.date || "";
    r.getCell(8).value = p.music || "";
    r.getCell(9).value = p.hook || "";
    r.getCell(10).value = p.desc || "";
    STAGES.forEach((s,si)=>{ const cell=r.getCell(11+si);
      if(p.stages && p.stages[s]){ cell.value="✓"; cell.fill=fill(ARGB.post); cell.font=white; cell.alignment={horizontal:"center"}; } });
    const story = (p.storyCodes&&p.storyCodes.length) ? " · story "+p.storyCodes.join("/") : "";
    r.getCell(15).value = (p.notes || "") + story;
  });
  // conditional formatting so NEW rows auto-colour by type letter / target x
  ws.addConditionalFormatting({ ref:"B2:B500", rules:[
    {type:"containsText",operator:"containsText",text:"R",priority:1,style:{fill:fill(ARGB.reel),font:{bold:true,...white}}},
    {type:"containsText",operator:"containsText",text:"P",priority:2,style:{fill:fill(ARGB.post),font:{bold:true,...white}}},
    {type:"containsText",operator:"containsText",text:"S",priority:3,style:{fill:fill(ARGB.story),font:{bold:true,...white}}},
  ]});
  [["C2:C500",ARGB.discovery,false],["D2:D500",ARGB.authority,false],["E2:E500",ARGB.conversion,false],["F2:F500",ARGB.retention,true]]
    .forEach(([ref,color,dark],idx)=>ws.addConditionalFormatting({ ref, rules:[
      {type:"containsText",operator:"containsText",text:"x",priority:10+idx,style:{fill:fill(color),font:dark?white:undefined}}]}));

  /* ----- Calendar (current week from state.weekStart) ----- */
  const cal = wb.addWorksheet("Calendar");
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayHue=["FFF9C6C6","FFF7D9B0","FFF6EFB0","FFC8E6C0","FFBFE0E6","FFC9C6EE","FFE6C6E0"];
  const ws0 = weekStartOf(state);
  cal.getCell("A1").value="Week of:"; cal.getCell("B1").value=ws0; cal.getCell("A1").font={bold:true};
  days.forEach((d,i)=>{ const cell=cal.getCell(2,i+1); cell.value=d; cell.fill=fill(dayHue[i]); cell.font={bold:true}; cell.alignment={horizontal:"center"}; cal.getColumn(i+1).width=22; });
  for(let i=0;i<7;i++){
    const date=addDays(ws0,i);
    const hits=projects.filter(p=>p.date===date);
    if(i===5 && hits.length===0){ const c=cal.getCell(3,i+1); c.value="— NO POST —"; c.font={italic:true,color:{argb:"FF9AA0A6"}}; c.alignment={horizontal:"center"}; }
    hits.forEach((p,row)=>{ const c=cal.getCell(3+row,i+1);
      c.value=`${TYPE_SHORT[p.type]||"?"} · ${p.title}\n[${(p.targets||[]).map(k=>TARGET_SHORT[k]||k).join("/")}]`;
      c.fill=fill(ARGB[p.type]||ARGB.reel); c.font={bold:true,...(p.type==="post"?{}:white)}; c.alignment={wrapText:true,vertical:"top"}; });
  }
  for(let r=3;r<=10;r++) cal.getRow(r).height=46;

  /* ----- Hooks ----- */
  const hooks = wb.addWorksheet("Hooks");
  headerRow(hooks,["Hook","Curiosity","Pattern interrupt","Identity","Visual","Controversy"],[34,11,16,10,10,12]);
  const hkCol={curiosity:2,pattern:3,identity:4,visual:5,controversy:6};
  HOOK_TABLE.forEach(([name,types],i)=>{ const r=hooks.getRow(i+2); r.getCell(1).value=name;
    types.forEach(tp=>{ const c=r.getCell(hkCol[tp]); if(!c)return; c.value="●"; c.alignment={horizontal:"center"}; c.font={color:{argb:"FF8B5CF6"}}; }); });

  /* ----- Turn-over (legend) ----- */
  const turn = wb.addWorksheet("Turn-over");
  turn.getColumn(1).width=16; turn.getColumn(2).width=14; turn.getColumn(3).width=44;
  turn.getCell("A1").value="THE FOUR TARGETS"; turn.getCell("A1").font={bold:true,size:14};
  const legend=[
    ["Discovery",ARGB.discovery,"Get seen on the For-You page (default)",false],
    ["Authority",ARGB.authority,"Turn viewers into followers",false],
    ["Conversion",ARGB.conversion,"Turn followers into customers",false],
    ["Retention",ARGB.retention,"Bring customers back",true],
  ];
  legend.forEach(([name,color,desc,dark],i)=>{ const r=turn.getRow(i+2);
    const sw=r.getCell(1); sw.value=name; sw.fill=fill(color); sw.font={bold:true,...(dark?white:{})};
    r.getCell(3).value=desc; });
  turn.getCell("A8").value="ACTIVITY COLOURS"; turn.getCell("A8").font={bold:true,size:14};
  [["Brainstorm",ARGB.brainstorm],["Shoot",ARGB.shoot],["Edit",ARGB.edit],["Priority",ARGB.priority],["Just do it",ARGB.justdo]]
    .forEach(([name,color],i)=>{ const r=turn.getRow(i+9); const sw=r.getCell(1); sw.value=name; sw.fill=fill(color); sw.font={bold:true,...white}; });
  turn.getCell("A15").value="STORY CODES"; turn.getCell("A15").font={bold:true,size:14};
  Object.entries(STORY_CODES).forEach(([n,d],i)=>{ const r=turn.getRow(i+16); r.getCell(1).value=n; r.getCell(1).font={bold:true}; r.getCell(3).value=d; });

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), "Technicolour-Planner-"+today()+".xlsx");
}

/* ========================================================================
   DOCX — one notes block per project, with her colour language built in.
   ======================================================================== */
export async function exportDocx(state){
  if(!window.docx) throw new Error("Word export library not loaded");
  const docx = window.docx;
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } = docx;
  const projects = projectsOf(state);

  const chip = (txt,color)=> new TextRun({ text:" "+txt+" ", bold:true, color:"FFFFFF",
    shading:{ type:ShadingType.SOLID, color, fill:color } });
  const label = (en)=> new Paragraph({ spacing:{before:160,after:40}, children:[ new TextRun({ text:en, bold:true }) ] });
  const line = (txt)=> new Paragraph({ spacing:{after:40}, children:[ new TextRun({ text: txt || "—", color: txt?"23211E":"B8B2A8" }) ] });

  const block = (p)=>{
    const kids = [
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[ new TextRun(p.title || "Untitled") ] }),
      new Paragraph({ spacing:{after:80}, children:[
        new TextRun({ text:"Type: ", bold:true }),
        chip((TYPE_SHORT[p.type]||"?")+" "+(TYPE_LABEL[p.type]||p.type), HEX[p.type] || HEX.reel),
      ]}),
      new Paragraph({ spacing:{after:120}, children:[
        new TextRun({ text:"Targets: ", bold:true }),
        ...( (p.targets&&p.targets.length) ? p.targets : ["discovery"] ).flatMap(k=>[ chip(TARGET_LABEL[k]||k, HEX[k]||HEX.discovery), new TextRun("  ") ]),
      ]}),
    ];
    if(p.date) kids.push(label("Date"), line(p.date));
    if(p.storyCodes&&p.storyCodes.length) kids.push(label("Story structure"), line(p.storyCodes.map(c=>c+" "+(STORY_CODES[c]||"")).join(" · ")));
    kids.push(label("🎵 Music"), line(p.music));
    kids.push(label("🪝 Hook"), line(p.hook));
    kids.push(label("Description / caption"), line(p.desc));
    kids.push(label("Tasks"),
      new Paragraph({ children:[
        chip("brainstorm",HEX.brainstorm), new TextRun("  "), chip("shoot",HEX.shoot), new TextRun("  "),
        chip("edit",HEX.edit), new TextRun("  "), chip("priority",HEX.priority), new TextRun("  "), chip("just do it",HEX.justdo),
      ]}));
    ( p.tasks || [] ).forEach(tk=> kids.push(new Paragraph({ spacing:{after:20}, children:[
      new TextRun({ text:(tk.done?"☑ ":"☐ "), bold:true }),
      new TextRun({ text:"("+(ACT_LABEL[tk.activity]||tk.activity)+") ", color:HEX[tk.activity]||"7C776F", bold:true }),
      new TextRun(tk.text || ""),
    ]})));
    if(p.notes) kids.push(label("Notes"), line(p.notes));
    kids.push(new Paragraph({ border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:"E3DDD3", space:8 } }, spacing:{after:220}, children:[ new TextRun("") ] }));
    return kids;
  };

  const head = [
    new Paragraph({ heading:HeadingLevel.TITLE, children:[ new TextRun("Sarah — Project Notes") ] }),
    new Paragraph({ spacing:{after:200}, children:[ new TextRun({ text:"One block per project, with your colour language built in. Exported "+today()+".", italics:true, color:"7C776F" }) ] }),
  ];
  const body = projects.length ? projects.flatMap(block) : [ new Paragraph({ children:[ new TextRun("No projects yet.") ] }) ];
  const doc = new Document({ styles:{ default:{ document:{ run:{ font:"Calibri", size:22 } } } }, sections:[{ children:[ ...head, ...body ] }] });

  const blob = await Packer.toBlob(doc);
  download(blob, "Technicolour-Planner-Notes-"+today()+".docx");
}

/* ========================================================================
   PPTX — weekly board (current week), photos drop onto day cards.
   ======================================================================== */
export async function exportPptx(state){
  if(!window.PptxGenJS) throw new Error("Slides export library not loaded");
  const PptxGenJS = window.PptxGenJS;
  const projects = projectsOf(state);
  const TYPE = { reel:"8B5CF6", post:"22C55E", story:"14B8A6" };
  const days = ["Lundi · Mon","Mardi · Tue","Mercredi · Wed","Jeudi · Thu","Vendredi · Fri","Samedi · Sat","Dimanche · Sun"];
  const hue = ["F9C6C6","F7D9B0","F6EFB0","C8E6C0","BFE0E6","C9C6EE","E6C6E0"];
  const ws0 = weekStartOf(state);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name:"BOARD", width:13.33, height:7.5 });
  pptx.layout = "BOARD";
  const slide = pptx.addSlide();
  slide.background = { color:"F4F1EC" };
  slide.addText("Week of "+ws0+" — drop your tattoo photos onto the day cards",
    { x:0.3, y:0.15, w:12.7, h:0.4, fontSize:16, bold:true, color:"23211E" });

  const cols=7, gap=0.15, x0=0.3, colW=(13.33 - x0*2 - gap*(cols-1))/cols;
  for(let i=0;i<7;i++){
    const x = x0 + i*(colW+gap);
    const date = addDays(ws0,i);
    const cards = projects.filter(p=>p.date===date);
    slide.addText(days[i], { x, y:0.7, w:colW, h:0.4, fontSize:10, bold:true, align:"center", fill:{color:hue[i]}, color:"23211E" });
    if(cards.length===0 && i===5){ slide.addText("NO POST", { x, y:1.3, w:colW, h:0.4, fontSize:11, italic:true, align:"center", color:"9AA0A6" }); }
    let y = 1.25;
    cards.forEach(c=>{
      const tgs = (c.targets||[]).map(k=>TARGET_SHORT[k]||k).join("/");
      slide.addText(`${TYPE_SHORT[c.type]||"?"} · ${c.title}\n[${tgs}]`,
        { x, y, w:colW, h:0.75, fontSize:9, bold:true, align:"center", valign:"middle",
          fill:{color:TYPE[c.type]||"8B5CF6"}, color: c.type==="post"?"10391C":"FFFFFF", line:{color:"FFFFFF",width:1} });
      y += 0.9;
    });
    slide.addText("＋", { x, y, w:colW, h:0.6, fontSize:14, align:"center", valign:"middle", color:"C9C2B6", line:{color:"E3DDD3",width:1,dashType:"dash"} });
  }
  slide.addText("R reel · P post · S story    |    Disc Auth Conv Ret = the four targets",
    { x:0.3, y:7.0, w:12.7, h:0.3, fontSize:9, italic:true, color:"7C776F" });

  const blob = await pptx.write({ outputType:"blob" });
  download(blob, "Technicolour-Planner-Board-"+today()+".pptx");
}
