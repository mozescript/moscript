

const DEFAULT_CHARS = [...'永字八法側勒努鉤策撇啄折'];
const PUNCT = new Set(['，','。','、','！','？','；','：','“','”','「','」','『','』','‘','’','《','》','〈','〉','…','—','（','）','〔','〕','【','】']);
const LEFT_PUNCT = new Set(['（','〔','【','「','『','《','〈','‘','“']);
const SCALE = 1.5;
const PW_PT = 595, PH_PT = 842;

const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
let bgColor='#FFFFFF', gridStyle='1', charOpacity=0.22, borderColor='#4A6FA5';
let fontFamily="'TWKai', serif";
let currentPage=1, totalPagesGlobal=1;
let layoutCache=null;
let selectedPoems=[], currentCat='唐詩精選';

document.getElementById('col-toggle').addEventListener('click',()=>{
  document.getElementById('col-body').classList.toggle('open');
  document.getElementById('col-arrow').classList.toggle('open');
});

document.querySelectorAll('.cat-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active'); currentCat=tab.dataset.cat;
    selectedPoems=[]; document.getElementById('poem-search').value='';
    renderGrid(''); generate();
  });
});

document.getElementById('poem-search').addEventListener('input',function(){ renderGrid(this.value); });
document.getElementById('clear-btn').addEventListener('click',()=>{
  selectedPoems=[]; document.getElementById('txt').value='';
  renderGrid(document.getElementById('poem-search').value); generate();
});

function getActivePoems(){
  if(currentCat==='宋詞精選') return CI;
  if(currentCat==='經典散文') return PROSE;
  return POEMS;
}
function getActiveCatLabel(){ return currentCat; }

function renderGrid(q){
  const grid=document.getElementById('poem-grid'); grid.innerHTML='';
  getActivePoems().forEach((p,i)=>{
    if(q&&!p.title.includes(q)&&!p.author.includes(q)) return;
    const card=document.createElement('div');
    card.className='poem-card'+(selectedPoems.includes(i)?' active':'');
    card.innerHTML='<div class="ptitle">'+p.title+'</div><div class="pauthor">'+p.author+'</div>';
    card.addEventListener('click',()=>{
      const pos=selectedPoems.indexOf(i);
      if(pos>=0) selectedPoems.splice(pos,1); else selectedPoems.push(i);
      renderGrid(document.getElementById('poem-search').value);
      generate();
    });
    grid.appendChild(card);
  });
  const n=selectedPoems.length;
  document.getElementById('sel-count').textContent=n>0?'已選 '+n+' 首':'';
  document.getElementById('clear-btn').style.display=n>0?'inline':'none';
}
renderGrid('');

function seg(id,cb){
  document.querySelectorAll('#'+id+' button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#'+id+' button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); cb(b.dataset.val); generate();
    });
  });
}
seg('grid-seg',v=>{gridStyle=v;});
seg('op-seg',v=>{charOpacity=parseFloat(v);});
seg('bg-seg',v=>{bgColor=v;generate();});
seg('font-seg',v=>{
  if(v==='kai') fontFamily="'TWKai', serif";
  else if(v==='chenyu') fontFamily="'ChenYuLuoYan', serif";
  else if(v==='zense') fontFamily="'Zense', serif";
  else if(v==='coriander') fontFamily="'Coriander', serif";
  else if(v==='iming') fontFamily="'IMing', serif";
  else fontFamily="'Huninn', sans-serif";
  if(document.fonts && document.fonts.load){
    document.fonts.load('16px '+fontFamily).then(()=>generate());
  }
});
document.querySelectorAll('#color-sw .swatch').forEach(s=>{
  s.addEventListener('click',function(){
    document.querySelectorAll('#color-sw .swatch').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); borderColor=this.dataset.c;
    document.getElementById('color-name').textContent=this.dataset.name||'';
    generate();
  });
});
document.getElementById('txt').addEventListener('input',debounce(()=>{
  selectedPoems=[]; renderGrid(document.getElementById('poem-search').value); generate();
},400));
document.getElementById('cols').addEventListener('change',generate);
document.getElementById('blank-mode').addEventListener('change',generate);
document.getElementById('btn-dl').addEventListener('click',()=>downloadPDF(false));
document.getElementById('btn-dl-print').addEventListener('click',()=>downloadPDF(true));
document.getElementById('btn-prev').addEventListener('click',()=>{if(currentPage>1)showPage(currentPage-1);});
document.getElementById('btn-next').addEventListener('click',()=>{if(currentPage<totalPagesGlobal)showPage(currentPage+1);});
document.getElementById('btn-dl-all').addEventListener('click',downloadAll);

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

function parseText(raw){
  const chars=[],puncts={};
  let i=0;
  while(i<raw.length){
    const ch=raw[i];
    if(ch==='\n'||ch===' '){i++;continue;}
    // Handle 刪節號 …… (two chars)
    if(ch==='…'&&raw[i+1]==='…'){
      if(chars.length>0){const pi=chars.length-1;if(!puncts[pi])puncts[pi]='……';}
      i+=2;continue;
    }
    if(PUNCT.has(ch)){
      if(chars.length>0){const pi=chars.length-1;if(!puncts[pi])puncts[pi]=ch;}
      i++;continue;
    }
    chars.push(ch);
    i++;
  }
  return {chars,puncts};
}

function isBlankMode(){
  return document.getElementById('blank-mode').checked;
}

function getItems(){
  if(isBlankMode()){
    const cols=Math.max(8,Math.min(14,parseInt(document.getElementById('cols').value)||12));
    const PW=PW_PT*SCALE, PH=PH_PT*SCALE;
    const margin=28*SCALE, cellSize=Math.floor((PW-margin*2)/cols);
    const rows=Math.floor((PH-margin*2)/cellSize);
    const total=cols*rows;
    const chars=Array(total).fill('\u3000');
    return [{chars,puncts:{},title:''}];
  }
  if(selectedPoems.length>0){
    return selectedPoems.map(i=>{
      const p=getActivePoems()[i],{chars,puncts}=parseText(p.text);
      return {chars,puncts,title:p.title+'\u3000'+p.author+'\u3000｜\u3000'+getActiveCatLabel()};
    });
  }
  const raw=document.getElementById('txt').value;
  if(!raw.trim()) return [{chars:DEFAULT_CHARS,puncts:{},title:''}];
  const {chars,puncts}=parseText(raw);
  return [{chars,puncts,title:''}];
}

function buildLayout(items,cols){
  const rows=[];
  items.forEach(item=>{
    if(item.title) rows.push({type:'title',text:item.title});
    const len=item.chars.length;
    const nRows=Math.max(1,Math.ceil(len/cols));
    for(let r=0;r<nRows;r++) rows.push({type:'chars',chars:item.chars,puncts:item.puncts,start:r*cols});
  });
  return rows;
}

function paginateRows(rows,cols,PW,PH,margin,cellSize,titleH){
  const pages=[]; let page=[],usedH=0,usable=PH-margin*2;
  rows.forEach(row=>{
    const rh=row.type==='title'?titleH:cellSize;
    if(usedH+rh>usable&&page.length>0){pages.push(page);page=[];usedH=0;}
    page.push(row);usedH+=rh;
  });
  if(page.length>0) pages.push(page);
  return pages;
}

function renderPageToCanvas(c,rows,cols,PW,PH,margin,cellSize,titleH,pageNum,totalPages,sc){
  c.fillStyle='#FFFFFF'; c.fillRect(0,0,PW,PH);
  let y=margin;
  rows.forEach(row=>{
    if(row.type==='title'){
      c.save();
      c.fillStyle='#BBBBBB';
      c.font=Math.floor(10*sc)+'px sans-serif';
      c.textAlign='left'; c.textBaseline='bottom';
      c.fillText(row.text, margin+4*sc, y+titleH-3*sc);
      c.strokeStyle='#E0E0E0'; c.lineWidth=0.5*sc; c.setLineDash([]);
      c.beginPath(); c.moveTo(margin,y+titleH); c.lineTo(PW-margin,y+titleH); c.stroke();
      c.restore();
      y+=titleH;
    } else {
      for(let ci=0;ci<cols;ci++){
        const idx=row.start+ci, x=margin+ci*cellSize;
        // bg
        c.fillStyle=bgColor; c.fillRect(x,y,cellSize,cellSize);
        // outer border
        c.strokeStyle=borderColor; c.lineWidth=0.9*sc; c.setLineDash([]);
        c.strokeRect(x+0.5,y+0.5,cellSize-1,cellSize-1);
        // inner lines
        c.strokeStyle='#BBBBBB'; c.lineWidth=0.45*sc; c.setLineDash([3*sc,3*sc]);
        if(gridStyle==='1'){
          c.beginPath();c.moveTo(x+cellSize/2,y+1);c.lineTo(x+cellSize/2,y+cellSize-1);c.stroke();
          c.beginPath();c.moveTo(x+1,y+cellSize/2);c.lineTo(x+cellSize-1,y+cellSize/2);c.stroke();
          c.beginPath();c.moveTo(x+1,y+1);c.lineTo(x+cellSize-1,y+cellSize-1);c.stroke();
          c.beginPath();c.moveTo(x+cellSize-1,y+1);c.lineTo(x+1,y+cellSize-1);c.stroke();
        } else if(gridStyle==='2'){
          c.beginPath();c.moveTo(x+cellSize/2,y+1);c.lineTo(x+cellSize/2,y+cellSize-1);c.stroke();
          c.beginPath();c.moveTo(x+1,y+cellSize/2);c.lineTo(x+cellSize-1,y+cellSize/2);c.stroke();
        } else if(gridStyle==='3'){
          c.beginPath();c.arc(x+cellSize/2,y+cellSize/2,cellSize*0.4,0,Math.PI*2);c.stroke();
        } else if(gridStyle==='4'){
          c.beginPath();c.arc(x+cellSize/2,y+cellSize/2,cellSize*0.4,0,Math.PI*2);c.stroke();
          c.beginPath();c.moveTo(x+cellSize/2,y+1);c.lineTo(x+cellSize/2,y+cellSize-1);c.stroke();
          c.beginPath();c.moveTo(x+1,y+cellSize/2);c.lineTo(x+cellSize-1,y+cellSize/2);c.stroke();
        }
        c.setLineDash([]);
        // char
        if(idx<row.chars.length && row.chars[idx] && row.chars[idx]!=='\u3000'){
          c.save(); c.globalAlpha=charOpacity; c.fillStyle='#1a1a1a';
          const fs=Math.floor(cellSize*0.72);
          c.font=fs+'px '+fontFamily; c.textAlign='center'; c.textBaseline='middle';
          c.fillText(row.chars[idx],x+cellSize/2,y+cellSize/2+Math.floor(fs*0.04)); c.restore();
          if(row.puncts[idx]){
            const pt=row.puncts[idx];
            const isLeft=LEFT_PUNCT.has(pt[0]);
            c.save(); c.globalAlpha=0.65; c.fillStyle=borderColor;
            const pfs=Math.max(10*sc,Math.floor(cellSize*0.2));
            c.font=pfs+'px serif';
            c.textBaseline='bottom';
            if(isLeft){
              c.textAlign='left';
              c.fillText(pt,x+2*sc,y+cellSize-2*sc);
            } else {
              c.textAlign='right';
              c.fillText(pt,x+cellSize-2*sc,y+cellSize-2*sc);
            }
            c.restore();
          }
        }
      }
      y+=cellSize;
    }
  });
  c.save(); c.fillStyle='#BBBBBB';
  c.font=Math.floor(10*sc)+'px sans-serif';
  c.textAlign='center'; c.textBaseline='bottom'; c.globalAlpha=1;
  c.fillText(pageNum+' / '+totalPages,PW/2,PH-6*sc); c.restore();
}

function getLayout(sc){
  const cols=Math.max(8,Math.min(14,parseInt(document.getElementById('cols').value)||12));
  const PW=PW_PT*sc, PH=PH_PT*sc;
  const margin=28*sc, cellSize=Math.floor((PW-margin*2)/cols);
  const titleH=Math.floor(cellSize*0.38);
  const items=getItems();
  const rows=buildLayout(items,cols);
  const pages=paginateRows(rows,cols,PW,PH,margin,cellSize,titleH);
  return {cols,PW,PH,margin,cellSize,titleH,pages};
}

function generate(){
  const {cols,PW,PH,margin,cellSize,titleH,pages}=getLayout(SCALE);
  canvas.width=PW; canvas.height=PH;
  const maxW = canvas.parentElement ? canvas.parentElement.clientWidth - 28 : 800;
  const dispW = Math.min(PW_PT, maxW);
  canvas.style.width = dispW + 'px';
  canvas.style.height = Math.round(dispW * PH_PT / PW_PT) + 'px';
  canvas.style.display = 'block';
  totalPagesGlobal=Math.max(1,pages.length);
  currentPage=1;
  layoutCache={cols,PW,PH,margin,cellSize,titleH,pages};
  updateNav();
  renderPageToCanvas(ctx,pages[0]||[],cols,PW,PH,margin,cellSize,titleH,1,totalPagesGlobal,SCALE);
}

function updateNav(){
  document.getElementById('page-indicator').textContent=currentPage+' / '+totalPagesGlobal;
  document.getElementById('btn-prev').disabled=currentPage<=1;
  document.getElementById('btn-next').disabled=currentPage>=totalPagesGlobal;
}

function showPage(p){
  currentPage=p; updateNav();
  const {cols,PW,PH,margin,cellSize,titleH,pages}=layoutCache;
  renderPageToCanvas(ctx,pages[p-1]||[],cols,PW,PH,margin,cellSize,titleH,p,totalPagesGlobal,SCALE);
}

function downloadPDF(isPrint){
  const sc=isPrint?6:SCALE;
  const {cols,PW,PH,margin,cellSize,titleH,pages}=getLayout(sc);
  let fn='描字帖'+(isPrint?'_印刷檔':'_電子檔')+'.pdf';
  if(selectedPoems.length===1) fn=getActivePoems()[selectedPoems[0]].title+(isPrint?'_印刷檔':'_電子檔')+'.pdf';
  else if(selectedPoems.length>1) fn='自選'+selectedPoems.length+'首'+(isPrint?'_印刷檔':'_電子檔')+'.pdf';
  const btn=isPrint?document.getElementById('btn-dl-print'):document.getElementById('btn-dl');
  const btnO=isPrint?document.getElementById('btn-dl'):document.getElementById('btn-dl-print');
  btn.disabled=true; btnO.disabled=true; btn.textContent='產生中…';
  setTimeout(async()=>{
    try{
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
      const off=document.createElement('canvas'); off.width=PW; off.height=PH;
      const oc=off.getContext('2d');
      for(let p=0;p<pages.length;p++){
        if(p>0) doc.addPage();
        renderPageToCanvas(oc,pages[p],cols,PW,PH,margin,cellSize,titleH,p+1,pages.length,sc);
        doc.addImage(off.toDataURL(sc>4?'image/png':'image/jpeg',sc>4?1.0:0.92),0,0,PW_PT,PH_PT);
        await new Promise(r=>setTimeout(r,10));
      }
      const blob=doc.output('blob');
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; a.click();
    }catch(e){console.error('PDF error:',e);}
    btn.textContent=isPrint?'下載印刷檔':'下載電子檔';
    btn.disabled=false; btnO.disabled=false;
  },80);
}

async function downloadAll(){
  const btn=document.getElementById('btn-dl-all');
  const btnS=document.getElementById('btn-dl');
  btn.disabled=true; btnS.disabled=true;
  const sc=SCALE;
  const cols=Math.max(8,Math.min(14,parseInt(document.getElementById('cols').value)||12));
  const PW=PW_PT*sc,PH=PH_PT*sc,margin=28*sc;
  const cellSize=Math.floor((PW-margin*2)/cols),titleH=Math.floor(cellSize*0.38);
  const allItems=getActivePoems().map(p=>{const {chars,puncts}=parseText(p.text);return{chars,puncts,title:p.title+'\u3000'+p.author+'\u3000｜\u3000'+getActiveCatLabel()};});
  const rows=buildLayout(allItems,cols),pages=paginateRows(rows,cols,PW,PH,margin,cellSize,titleH);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
  const off=document.createElement('canvas');off.width=PW;off.height=PH;
  const oc=off.getContext('2d');
  for(let p=0;p<pages.length;p++){
    if(p>0) doc.addPage();
    btn.textContent='產生中… '+(p+1)+' / '+pages.length+' 頁';
    renderPageToCanvas(oc,pages[p],cols,PW,PH,margin,cellSize,titleH,p+1,pages.length,sc);
    doc.addImage(off.toDataURL(sc>4?'image/png':'image/jpeg',sc>4?1.0:0.92),0,0,PW_PT,PH_PT);
    await new Promise(r=>setTimeout(r,5));
  }
  const blob=doc.output('blob');
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=currentCat+'完整版.pdf';a.click();
  btn.textContent='⬇ 下載完整版 PDF（電子檔）';btn.disabled=false;btnS.disabled=false;
}

if(document.fonts){
  document.fonts.ready.then(()=>generate());
} else {
  setTimeout(generate,800);
}


