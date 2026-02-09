/**
 * charts.js — gráficos leves (sem internet)
 * Implementa um "mini Chart" (bar/line/donut) usando <canvas>.
 * Observação: o requisito permite "Chart.js (ou similar leve)" — aqui usamos um similar leve embutido.
 */
window.MiniCharts = (() => {
  const registry = new Map();

  function clear(canvas){
    const ctx = canvas.getContext("2d");
    // reset transform to avoid cumulative scaling on re-render
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width, canvas.height);
  }

  function setupHiDPI(canvas){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(10, Math.floor(rect.width * dpr));
    canvas.height = Math.max(10, Math.floor(220 * dpr));
    const ctx = canvas.getContext("2d");
    // reset transform to avoid cumulative scaling on re-render
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    return ctx;
  }

  function drawAxes(ctx, w, h){
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(231,238,252,.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 10);
    ctx.lineTo(36, h-28);
    ctx.lineTo(w-10, h-28);
    ctx.stroke();
  }

  function formatCompact(n){
    const v = Number(n)||0;
    if(v>=1e6) return (v/1e6).toFixed(1)+"M";
    if(v>=1e3) return (v/1e3).toFixed(1)+"k";
    return v.toFixed(0);
  }

  function bar(canvas, labels, values, title=""){
    const ctx = setupHiDPI(canvas);
    const w = canvas.getBoundingClientRect().width;
    const h = 220;

    clear(canvas);
    drawAxes(ctx, w, h);

    const max = Math.max(1, ...values.map(v=>Number(v)||0));
    const plotW = w - 54;
    const plotH = h - 46;
    const x0 = 40;
    const y0 = h - 32;

    const n = Math.max(1, values.length);
    const gap = 6;
    const bw = Math.max(6, (plotW - gap*(n-1)) / n);

    // bars
    for(let i=0;i<n;i++){
      const v = Number(values[i])||0;
      const barH = (v/max)*plotH;
      const x = x0 + i*(bw+gap);
      const y = y0 - barH;
      ctx.fillStyle = "rgba(42,113,255,.85)";
      ctx.fillRect(x, y, bw, barH);
    }

    // y labels
    ctx.fillStyle = "rgba(168,183,216,.9)";
    ctx.font = "12px system-ui";
    ctx.fillText(formatCompact(max), 6, 18);
    ctx.fillText("0", 18, y0);

    // x labels (só alguns)
    ctx.fillStyle = "rgba(168,183,216,.9)";
    ctx.font = "11px system-ui";
    const step = Math.ceil(n/6);
    for(let i=0;i<n;i+=step){
      const x = x0 + i*(bw+gap);
      ctx.save();
      ctx.translate(x, h-12);
      ctx.rotate(-0.35);
      ctx.fillText(String(labels[i]||""), 0, 0);
      ctx.restore();
    }
  }

  function donut(canvas, labels, values){
    const ctx = setupHiDPI(canvas);
    const w = canvas.getBoundingClientRect().width;
    const h = 220;
    clear(canvas);

    const total = values.reduce((a,v)=>a+(Number(v)||0),0) || 1;
    const cx = w*0.30;
    const cy = h*0.52;
    const r = Math.min(w,h)*0.32;

    let start = -Math.PI/2;
    for(let i=0;i<values.length;i++){
      const v = Number(values[i])||0;
      const ang = (v/total) * Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.fillStyle = `rgba(42,113,255,${0.20 + (i%6)*0.10})`;
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath();
      ctx.fill();
      start += ang;
    }

    // hole
    ctx.beginPath();
    ctx.fillStyle = "#0b1220";
    ctx.arc(cx,cy,r*0.62,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = "rgba(231,238,252,.92)";
    ctx.font = "700 14px system-ui";
    ctx.fillText("Total", cx-18, cy-4);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(168,183,216,.9)";
    ctx.fillText(formatCompact(total), cx-20, cy+16);

    // legend
    ctx.font = "12px system-ui";
    let lx = w*0.58, ly = 26;
    for(let i=0;i<labels.length;i++){
      const v = Number(values[i])||0;
      if(v<=0) continue;
      ctx.fillStyle = `rgba(42,113,255,${0.20 + (i%6)*0.10})`;
      ctx.fillRect(lx, ly-10, 10, 10);
      ctx.fillStyle = "rgba(231,238,252,.9)";
      ctx.fillText(String(labels[i]), lx+16, ly);
      ctx.fillStyle = "rgba(168,183,216,.9)";
      ctx.fillText(formatCompact(v), lx+16, ly+14);
      ly += 34;
      if(ly>h-20) break;
    }
  }

  function render(type, canvasId, labels, values){
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;

    // re-render on resize: store config
    registry.set(canvasId, {type, labels, values});

    // If canvas is inside a hidden container, its size can be 0 at first render.
    // Retry a few times after the view becomes visible.
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 0;
    if(w < 50){
      const tries = Number(canvas.dataset.fcTry || "0");
      if(tries < 6){
        canvas.dataset.fcTry = String(tries + 1);
        requestAnimationFrame(() => render(type, canvasId, labels, values));
      }
      return;
    }
    canvas.dataset.fcTry = "0";

    if(type==="bar") bar(canvas, labels, values);
    else if(type==="donut") donut(canvas, labels, values);
    else bar(canvas, labels, values);
  }

  function rerenderAll(){
    for(const [id, cfg] of registry.entries()){
      render(cfg.type, id, cfg.labels, cfg.values);
    }
  }

  window.addEventListener("resize", () => {
    // debounce simples
    clearTimeout(window.__fc_resize);
    window.__fc_resize = setTimeout(rerenderAll, 150);
  });

  return { render, rerenderAll };
})();