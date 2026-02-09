/**
 * ui.js — renderização, navegação SPA e helpers de interface
 */
window.UI = (() => {
  function qs(sel, el=document){ return el.querySelector(sel); }
  function qsa(sel, el=document){ return [...el.querySelectorAll(sel)]; }

  function setText(id, text){ const el=qs("#"+id); if(el) el.textContent = text; }

  function showNotice(id, msg, kind="danger"){
    const el = qs("#"+id);
    if(!el) return;
    el.classList.remove("hidden","danger","ok");
    if(kind==="ok") el.classList.add("ok");
    if(kind==="danger") el.classList.add("danger");
    el.innerHTML = msg;
  }
  function hideNotice(id){
    const el = qs("#"+id);
    if(!el) return;
    el.classList.add("hidden");
  }

  function toastGlobal(msg, kind="danger"){
    const el = qs("#globalNotice");
    el.classList.remove("hidden","danger","ok");
    el.classList.add(kind==="ok"?"ok":"danger");
    el.textContent = msg;
    clearTimeout(window.__fc_toast);
    window.__fc_toast = setTimeout(()=>el.classList.add("hidden"), 3500);
  }

  function navTo(view){
    document.body.dataset.view = view; // usado no CSS de impressão
    qsa("section[data-view]").forEach(s => {
      s.classList.toggle("hidden", s.getAttribute("data-view") !== view);
    });
    qsa("#nav button[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    // dispara evento para permitir reações (ex.: re-render de gráficos ao abrir dashboard)
    window.dispatchEvent(new CustomEvent("fc:nav", {detail:{view}}));
    // rolar para o topo do conteúdo
    window.scrollTo({top:0, behavior:"instant"});
  }

  function fillSelect(id, arr, opts={}){
    const el = qs(`#${id}`);
    if(!el) return;

    const esc = (x) => String(x ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");

    const prev = el.value;

    // placeholder:
    // - opts.placeholder === null  => não adiciona opção de placeholder
    // - opts.placeholder string    => usa o texto informado
    // - default                   => "Selecione..."
    const usePlaceholder = opts.placeholder !== null;
    const placeholderText = (opts.placeholder && opts.placeholder !== null) ? opts.placeholder : "Selecione...";

    const options = (arr||[]).map(o=>{
      if(o && typeof o === "object"){
        const value = String(o.value ?? o.id ?? o.name ?? "");
        const label = String(o.label ?? o.name ?? o.value ?? o.id ?? "");
        return `<option value="${esc(value)}">${esc(label)}</option>`;
      }
      const v = String(o ?? "");
      return `<option value="${esc(v)}">${esc(v)}</option>`;
    }).join("");

    el.innerHTML = (usePlaceholder ? `<option value="">${esc(placeholderText)}</option>` : "") + options;
    if(prev) el.value = prev;
  }

  function fmtMoney(n){ return Calc.brMoney(n); }
  function fmtNum(n, d=2){ return Calc.brNumber(n,d); }

  function table(elId, headers, rows){
    const el = qs("#"+elId);
    if(!el) return;
    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
    const tbody = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
    el.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
  }

  function confirmDanger(message){
    return window.confirm(message);
  }

  
  function printElement(el){
    if(!el){ window.print(); return; }
    const w = window.open("", "_blank");
    const css = document.querySelector('link[href*="assets/css/style.css"]')?.href;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Imprimir</title>${css?`<link rel="stylesheet" href="${css}">`:""}</head><body></body></html>`);
    const clone = el.cloneNode(true);
    clone.classList.remove("hidden");
    // remove sidebar-like buttons inside the section
    w.document.body.appendChild(clone);
    w.document.close();
    w.focus();
    setTimeout(()=>{ w.print(); }, 300);
  }


  function download(filename, content, mime){
    const blob = new Blob([content], {type: mime || "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

return { qs, qsa, setText, showNotice, hideNotice, toastGlobal, navTo, fillSelect, fmtMoney, fmtNum, table, confirmDanger
    printElement,
    download,
};
})();
