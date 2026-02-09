/**
 * app.js — inicialização e orquestração do app
 * Produto: FrotaControl (PWA offline) • v1.0
 */
(() => {
  const VERSION = "v1.5.0";
  const CHARTS_ENABLED = false; // gráficos opcionais (desativados por padrão)

  function normalizePayMode(v){
    const s = String(v||"").trim().toLowerCase();
    if(!s) return "";
    // aceita valores legados exibidos na UI
    if(s.startsWith("cr")) return "credit";
    if(s.startsWith("din") || s=="cash") return "cash";
    if(s.startsWith("car") || s=="card") return "card";
    return s;
  }

  let db = StorageLayer.load();
  UI.setText("appVersion", VERSION);
  UI.setText("year", new Date().getFullYear());

  function licenseBadge(){
    const l = db.license || License.demo();
    const plan = (l.planLabel || l.plan || "Demo");
    const company = l.company ? ` • ${l.company}` : "";
    UI.setText("licenseBadge", `Licença: ${plan}${company} (limite ${l.limit})`);
  }

  function refreshCombos(){
    const vehicles = (db.vehicles||[]).map(v => ({value:v.plate, label:`${v.plate}${v.desc?(" — "+v.desc):""}`}));
    const drivers = (db.drivers||[]).map(d => ({value:d.name, label:d.name}));
    const stations = (db.stations||[]).map(s => ({value:s.name, label:s.name}));
    const fuels = (db.fuels||[]).map(f => ({value:f.name, label:f.name}));

    UI.fillSelect("rfPlate", vehicles);
    UI.fillSelect("rfDriver", drivers);
    UI.fillSelect("rfStation", stations);
    UI.fillSelect("rfFuel", fuels);
    UI.fillSelect("stCreditStation", stations, {placeholder:"Selecione o posto"});

    // expenses optional
    UI.fillSelect("exPlate", [{value:"",label:"(Sem veículo)"}].concat(vehicles), {placeholder:null});
    UI.fillSelect("exDriver", [{value:"",label:"(Sem condutor)"}].concat(drivers), {placeholder:null});

    // dashboard filters
    const years = availableYears();
    UI.fillSelect("fYear", years.map(y=>({value:y,label:String(y)})));
    UI.fillSelect("fPlate", vehicles, {allowAll:true});
    UI.fillSelect("fDriver", drivers, {allowAll:true});
    UI.fillSelect("fFuel", fuels, {allowAll:true});

    // reports
    UI.fillSelect("rgYear", years.map(y=>({value:y,label:String(y)})));
    UI.fillSelect("rvPlate", vehicles);
    UI.fillSelect("rdDriver", drivers);
    UI.fillSelect("rfFuelSel", fuels);
    UI.fillSelect("rpStationSel", stations);

    // defaults
    const cy = new Date().getFullYear();
    if(years.includes(cy)){
      UI.qs("#fYear").value = String(cy);
      UI.qs("#rgYear").value = String(cy);
    updateStationCreditHint();
    }else if(years.length){
      UI.qs("#fYear").value = String(years[0]);
      UI.qs("#rgYear").value = String(years[0]);
    }
    UI.qs("#fPlate").value = "all";
    UI.qs("#fDriver").value = "all";
    UI.qs("#fFuel").value = "all";
  }

  function availableYears(){
    const years = new Set();
    for(const r of (db.refuels||[])){
      const y = Reports.yearOf(r.date);
      if(y) years.add(y);
    }
    for(const e of (db.expenses||[])){
      const y = Reports.yearOf(e.date);
      if(y) years.add(y);
    }
    years.add(new Date().getFullYear());
    return [...years].sort((a,b)=>a-b);
  }

  function enforceLicenseUI(){
    const info = License.enforceVehicleLimit(db);
    if(info.blocked){
      UI.toastGlobal("Limite do plano atingido — novos veículos não podem ser cadastrados.", "danger");
    }
    // nada a fazer aqui; bloqueio ocorre no cadastro
  }

  /* -------------------- NAV -------------------- */
  UI.qsa("#nav button[data-view]").forEach(b => {
    b.addEventListener("click", () => {
      UI.navTo(b.dataset.view);
      renderAll();
    });
  });

  // imprimir
  UI.qs("#btnPrint").addEventListener("click", () => {
    const v = document.body.dataset.view || "refuels";
    if(v.startsWith("report-")) { window.print(); return; }
    UI.toastGlobal("Abra um relatório (Geral / Veículo / Condutor / Combustível) para imprimir.", "danger");
  });

  /* -------------------- ABASTECIMENTOS -------------------- */
  const refuelForm = UI.qs("#refuelForm");
  const refuelErrorId = "refuelError";

  function clearRefuelForm(keepPlate=false){
    UI.qs("#refuelId").value = "";
  if(!window.__rfStationListenerBound){
    UI.qs("#rfStation")?.addEventListener("change", ()=>updateStationCreditHint());
    window.__rfStationListenerBound = true;
  }
    const plate = UI.qs("#rfPlate").value;
    refuelForm.reset();
    if(keepPlate) UI.qs("#rfPlate").value = plate;
    UI.qs("#rfPricePerLiter").value = "";
    UI.qs("#rfKm").value = "";
    UI.qs("#rfCons").value = "";
    UI.hideNotice(refuelErrorId);
    // defaults
    UI.qs("#rfFull").value = "Não";
    const pm = UI.qs("#rfPayMethod"); if(pm) pm.value = "cash";
    updateStationCreditHint();
  }

  function fillRefuelForm(r){
    UI.qs("#refuelId").value = r.id;
    UI.qs("#rfDate").value = r.date;
    UI.qs("#rfTime").value = r.time;
    UI.qs("#rfPlate").value = r.plate;
    UI.qs("#rfDriver").value = r.driver;
    UI.qs("#rfStation").value = r.station;
    updateStationCreditHint();
    UI.qs("#rfFuel").value = r.fuel;
    UI.qs("#rfLiters").value = r.liters;
    UI.qs("#rfTotal").value = r.total;
    UI.qs("#rfPricePerLiter").value = Calc.brNumber(r.pricePerLiter,3);
    UI.qs("#rfOdo").value = r.odo;
    UI.qs("#rfFull").value = r.full || "Não";
    UI.qs("#rfKm").value = r.km === "" ? "" : Calc.brNumber(r.km,1);
    UI.qs("#rfCons").value = r.consumption === "" ? "" : Calc.brNumber(r.consumption,2);
    UI.qs("#rfNotes").value = r.notes || "";
    const pm = UI.qs("#rfPayMethod"); if(pm) pm.value = r.payMethod || "Normal";
    updateStationCreditHint();
  }

  function renderRefuels(){
    const list = [...(db.refuels||[])].sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    UI.setText("refuelCount", `${list.length} registro(s)`);

    const headers = ["Data","Hora","Placa","Condutor","Combustível","Litros","Total","R$/L","Hodômetro","KM","Km/L","Ações"];
    const rows = list.map(r => ([
      Calc.brDate(r.date),
      r.time||"",
      r.plate,
      r.driver,
      r.fuel,
      UI.fmtNum(r.liters,3),
      UI.fmtMoney(r.total),
      UI.fmtNum(r.pricePerLiter,3),
      UI.fmtNum(r.odo,0),
      (r.km===""? "<span class='muted'>—</span>" : UI.fmtNum(r.km,1)),
      (r.consumption===""? "<span class='muted'>—</span>" : UI.fmtNum(r.consumption,2)),
      `<div class="actions">
        <button class="btn small secondary" data-act="edit" data-id="${r.id}">Editar</button>
        <button class="btn small danger" data-act="del" data-id="${r.id}">Excluir</button>
      </div>`
    ]));

    UI.table("refuelTable", headers, rows);

    UI.qsa("#refuelTable button").forEach(btn=>{
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if(act==="edit"){
          const r = db.refuels.find(x=>x.id===id);
          if(r) fillRefuelForm(r);
          UI.toastGlobal("Modo edição: altere e clique em Salvar.", "ok");
        }
        if(act==="del"){
          if(!UI.confirmDanger("Excluir este abastecimento?")) return;
          db.refuels = db.refuels.filter(x=>x.id!==id);
          Calc.recalcAll(db);
          StorageLayer.save(db);
          renderAll();
          UI.toastGlobal("Registro excluído.", "ok");
        }
      });
    });
  }

  function updateDerivedPreview(){
    // Atualiza campos auto ao digitar
    const liters = Number(UI.qs("#rfLiters").value)||0;
    const total = Number(UI.qs("#rfTotal").value)||0;
    const price = liters>0 ? total/liters : 0;
    UI.qs("#rfPricePerLiter").value = liters>0 ? Calc.brNumber(price,3) : "";

    const temp = {
      id: UI.qs("#refuelId").value || null,
      date: UI.qs("#rfDate").value,
      time: UI.qs("#rfTime").value,
      plate: UI.qs("#rfPlate").value,
      liters,
      total,
      odo: Number(UI.qs("#rfOdo").value)||0
    };
    if(!temp.date || !temp.plate) return;
    const c = Calc.computeDerived(db, temp);
    if(c.ok){
      UI.qs("#rfKm").value = c.derived.km==="" ? "" : Calc.brNumber(c.derived.km,1);
      UI.qs("#rfCons").value = c.derived.consumption==="" ? "" : Calc.brNumber(c.derived.consumption,2);
      UI.hideNotice(refuelErrorId);
    }else{
      UI.qs("#rfKm").value = "";
      UI.qs("#rfCons").value = "";
      UI.showNotice(refuelErrorId, c.error, "danger");
    }
  }

  ["rfLiters","rfTotal","rfOdo","rfDate","rfTime","rfPlate"].forEach(id=>{
    UI.qs("#"+id).addEventListener("input", updateDerivedPreview);
    UI.qs("#"+id).addEventListener("change", updateDerivedPreview);
  });

  refuelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    UI.hideNotice(refuelErrorId);

    const id = UI.qs("#refuelId").value || StorageLayer.cryptoRandomId();
    const r = {
      id,
      date: UI.qs("#rfDate").value,
      time: UI.qs("#rfTime").value,
      plate: UI.qs("#rfPlate").value,
      driver: UI.qs("#rfDriver").value,
      station: UI.qs("#rfStation").value,
      fuel: UI.qs("#rfFuel").value,
      payMode: normalizePayMode(UI.qs("#rfPayMethod")?.value || "cash"),
      liters: Number(UI.qs("#rfLiters").value)||0,
      total: Number(UI.qs("#rfTotal").value)||0,
      pricePerLiter: 0,
      odo: Number(UI.qs("#rfOdo").value)||0,
      full: UI.qs("#rfFull").value,
      km: "",
      consumption: "",
      notes: UI.qs("#rfNotes").value||""
    };

    const c = Calc.computeDerived(db, r);
    if(!c.ok){
      UI.showNotice(refuelErrorId, c.error, "danger");
      return;
    }
    r.pricePerLiter = c.derived.pricePerLiter;
    r.km = c.derived.km;
    r.consumption = c.derived.consumption;

    const exists = db.refuels.findIndex(x=>x.id===id);

    // --- Crédito no posto: ao editar, desfaz o lançamento anterior e aplica o novo ---
    if(exists>=0){
      const prev = db.refuels[exists];
      if(prev && (normalizePayMode(prev.payMode)==="credit" || prev.payMethod==="Crédito" || prev.payMethod==="Credito")){
        applyStationCredit(prev.station, +Number(prev.total||0), {type:"refuel-revert", refuelId: prev.id});
      }
      db.refuels[exists] = r;
    }else{
      db.refuels.push(r);
    }

    if(normalizePayMode(r.payMode)==="credit" || String(r.payMethod||"").trim()==="Crédito" || String(r.payMethod||"").trim()==="Credito"){
      applyStationCredit(r.station, -Number(r.total||0), {type:"refuel", refuelId: r.id});
      const stNow = stationById(r.station);
      if(stNow && Number(stNow.credit||0) < 0){
        UI.toastGlobal("Atenção: crédito do posto ficou negativo. Registre um aporte em Cadastros > Postos.", "danger");
      }
    }

    Calc.recalcAll(db);
    StorageLayer.save(db);

    clearRefuelForm(true);
    renderAll();
    UI.toastGlobal("Abastecimento salvo.", "ok");
  });

  UI.qs("#btnRefuelClear").addEventListener("click", () => clearRefuelForm(true));
  UI.qs("#btnRefuelDuplicate").addEventListener("click", () => {
    const currentId = UI.qs("#refuelId").value;
    if(!currentId){
      UI.toastGlobal("Selecione um registro (Editar) antes de duplicar.", "danger");
      return;
    }
    UI.qs("#refuelId").value = ""; // novo
    UI.toastGlobal("Duplicação pronta: ajuste data/hora/hodômetro e Salvar.", "ok");
  });

  /* -------------------- DESPESAS -------------------- */
  const expenseForm = UI.qs("#expenseForm");
  function clearExpenseForm(){
    UI.qs("#expenseId").value = "";
    expenseForm.reset();
  }

  function renderExpenses(){
    const list = [...(db.expenses||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    UI.setText("expenseCount", `${list.length} registro(s)`);

    const headers = ["Data","Tipo","Veículo","Condutor","Valor","Descrição","Ações"];
    const rows = list.map(e => ([
      Calc.brDate(e.date),
      e.type,
      e.plate ? e.plate : "<span class='muted'>—</span>",
      e.driver ? e.driver : "<span class='muted'>—</span>",
      UI.fmtMoney(e.value),
      e.desc || "<span class='muted'>—</span>",
      `<div class="actions">
        <button class="btn small secondary" data-act="edit" data-id="${e.id}">Editar</button>
        <button class="btn small danger" data-act="del" data-id="${e.id}">Excluir</button>
      </div>`
    ]));

    UI.table("expenseTable", headers, rows);
    UI.qsa("#expenseTable button").forEach(btn=>{
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if(act==="edit"){
          const e = db.expenses.find(x=>x.id===id);
          if(!e) return;
          UI.qs("#expenseId").value = e.id;
          UI.qs("#exDate").value = e.date;
          UI.qs("#exType").value = e.type;
          UI.qs("#exPlate").value = e.plate || "";
          UI.qs("#exDriver").value = e.driver || "";
          UI.qs("#exValue").value = e.value;
          UI.qs("#exDesc").value = e.desc || "";
          UI.toastGlobal("Modo edição: altere e clique em Salvar.", "ok");
        }
        if(act==="del"){
          if(!UI.confirmDanger("Excluir esta despesa?")) return;
          db.expenses = db.expenses.filter(x=>x.id!==id);
          StorageLayer.save(db);
          renderAll();
          UI.toastGlobal("Despesa excluída.", "ok");
        }
      });
    });
  }

  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = UI.qs("#expenseId").value || StorageLayer.cryptoRandomId();
    const item = {
      id,
      date: UI.qs("#exDate").value,
      type: UI.qs("#exType").value,
      plate: UI.qs("#exPlate").value || "",
      driver: UI.qs("#exDriver").value || "",
      value: Number(UI.qs("#exValue").value)||0,
      desc: UI.qs("#exDesc").value||""
    };
    const idx = db.expenses.findIndex(x=>x.id===id);
    if(idx>=0) db.expenses[idx]=item; else db.expenses.push(item);
    StorageLayer.save(db);
    clearExpenseForm();
    renderAll();
    UI.toastGlobal("Despesa salva.", "ok");
  });
  UI.qs("#btnExpenseClear").addEventListener("click", clearExpenseForm);

  /* -------------------- CADASTROS -------------------- */
  function renderRegisters(){
    // veículos
    UI.table("vehTable", ["Placa","Descrição","Ações"],
      db.vehicles.map(v => ([
        v.plate,
        v.desc || "<span class='muted'>—</span>",
        `<button class="btn small danger" data-id="${v.id}">Remover</button>`
      ]))
    );
    UI.qsa("#vehTable button").forEach(b=>{
      b.addEventListener("click", () => {
        const id=b.dataset.id;
        if(!UI.confirmDanger("Remover veículo? (não remove abastecimentos/despesas já lançados)")) return;
        db.vehicles = db.vehicles.filter(v=>v.id!==id);
        StorageLayer.save(db);
        refreshCombos();
        renderAll();
      });
    });

    UI.table("drvTable", ["Nome","Ações"],
      db.drivers.map(d => ([
        d.name,
        `<button class="btn small danger" data-id="${d.id}">Remover</button>`
      ]))
    );
    UI.qsa("#drvTable button").forEach(b=>{
      b.addEventListener("click", () => {
        const id=b.dataset.id;
        if(!UI.confirmDanger("Remover condutor?")) return;
        db.drivers = db.drivers.filter(d=>d.id!==id);
        StorageLayer.save(db);
        refreshCombos(); renderAll();
      });
    });

    UI.table("stTable", ["Nome","Crédito (R$)","Ações"],
      db.stations.map(s => ([
        s.name,
        UI.fmtMoney(Number(s.credit)||0),
        `<button class="btn small danger" data-id="${s.id}">Remover</button>`
      ]))
    );
UI.qsa("#stTable button").forEach(b=>{
      b.addEventListener("click", () => {
        const id=b.dataset.id;
        if(!UI.confirmDanger("Remover posto?")) return;
        db.stations = db.stations.filter(s=>s.id!==id);
        StorageLayer.save(db);
        refreshCombos(); renderAll();
      });
    });

    UI.table("fuTable", ["Nome","Ações"],
      db.fuels.map(f => ([
        f.name,
        `<button class="btn small danger" data-id="${f.id}">Remover</button>`
      ]))
    );
    UI.qsa("#fuTable button").forEach(b=>{
      b.addEventListener("click", () => {
        const id=b.dataset.id;
        if(!UI.confirmDanger("Remover combustível?")) return;
        db.fuels = db.fuels.filter(f=>f.id!==id);
        StorageLayer.save(db);
        refreshCombos(); renderAll();
      });
    });
  }

  // add vehicle (licença)
  UI.qs("#vehForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const plate = (UI.qs("#vehPlate").value||"").trim().toUpperCase();
    const desc = (UI.qs("#vehDesc").value||"").trim();
    if(!plate) return;

    const lim = License.enforceVehicleLimit(db);
    if(lim.blocked){
      UI.toastGlobal("Limite do plano atingido — não é possível cadastrar mais veículos.", "danger");
      return;
    }
    if(db.vehicles.some(v=>v.plate===plate)){
      UI.toastGlobal("Placa já cadastrada.", "danger");
      return;
    }
    db.vehicles.push({id:StorageLayer.cryptoRandomId(), plate, desc});
    StorageLayer.save(db);
    UI.qs("#vehPlate").value=""; UI.qs("#vehDesc").value="";
    refreshCombos(); renderAll();
    UI.toastGlobal("Veículo adicionado.", "ok");
  });

  UI.qs("#drvForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (UI.qs("#drvName").value||"").trim();
    if(!name) return;
    if(db.drivers.some(d=>d.name.toLowerCase()===name.toLowerCase())){
      UI.toastGlobal("Condutor já cadastrado.", "danger");
      return;
    }
    db.drivers.push({id:StorageLayer.cryptoRandomId(), name});
    StorageLayer.save(db);
    UI.qs("#drvName").value="";
    refreshCombos(); renderAll();
    UI.toastGlobal("Condutor adicionado.", "ok");
  });

  UI.qs("#stForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (UI.qs("#stName").value||"").trim();
    if(!name) return;
    if(db.stations.some(s=>s.name.toLowerCase()===name.toLowerCase())){
      UI.toastGlobal("Posto já cadastrado.", "danger");
      return;
    }
    db.stations.push({id:StorageLayer.cryptoRandomId(), name});
    StorageLayer.save(db);
    UI.qs("#stName").value="";
    refreshCombos(); renderAll();
    UI.toastGlobal("Posto adicionado.", "ok");
  });

  const stCreditForm = UI.qs("#stCreditForm");
  if(stCreditForm){
    stCreditForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const stId = (UI.qs("#stCreditStation").value || "").trim();
      const val = Number((UI.qs("#stCreditAmount").value || "0").toString().replace(",", ".") || 0);
      const obs = (UI.qs("#stCreditObs").value || "").trim();
      if(!stId){
        UI.toastGlobal("Selecione o posto para o aporte.", "danger");
        return;
      }
      if(!(val > 0)){
        UI.toastGlobal("Informe um valor de aporte maior que zero.", "danger");
        return;
      }
      applyStationCredit(stId, +val, {type:"topup", obs});
      Calc.recalcAll(db);
      StorageLayer.save(db);
      UI.qs("#stCreditAmount").value = "";
      UI.qs("#stCreditObs").value = "";
      updateStationCreditHint();
      renderAll();
      UI.toastGlobal("Crédito adicionado ao posto.", "ok");
    });
  }


  UI.qs("#fuForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (UI.qs("#fuName").value||"").trim();
    if(!name) return;
    if(db.fuels.some(f=>f.name.toLowerCase()===name.toLowerCase())){
      UI.toastGlobal("Combustível já cadastrado.", "danger");
      return;
    }
    db.fuels.push({id:StorageLayer.cryptoRandomId(), name});
    StorageLayer.save(db);
    UI.qs("#fuName").value="";
    refreshCombos(); renderAll();
    UI.toastGlobal("Combustível adicionado.", "ok");
  });

  /* -------------------- DASHBOARD -------------------- */
  function renderKpis(k){
    const grid = UI.qs("#kpiGrid");
    const items = [
      {t:"Litros totais", v:UI.fmtNum(k.liters,2)},
      {t:"KM rodados", v:UI.fmtNum(k.km,1)},
      {t:"Gastos combustível", v:UI.fmtMoney(k.fuelMoney)},
      {t:"Média R$/Litro", v:UI.fmtNum(k.avgPrice,3)},
      {t:"Média Km/L", v:UI.fmtNum(k.avgKml,2)},
      {t:"Despesas extras", v:UI.fmtMoney(k.extras)},
      {t:"Custo total geral", v:UI.fmtMoney(k.totalAll)},
    ];
    grid.innerHTML = items.map(it=>`
      <div class="card col-3">
        <h3>${it.t}</h3>
        <div class="kpi">
          <div class="big">${it.v}</div>
        </div>
      </div>
    `).join("");
  }

  function getDashFilters(){
    return {
      year: UI.qs("#fYear").value,
      period: UI.qs("#fPeriod").value,
      plate: UI.qs("#fPlate").value,
      driver: UI.qs("#fDriver").value,
      fuel: UI.qs("#fFuel").value,
    };
  }

  function renderDashboard(){
    const data = Reports.dashboard(db, getDashFilters());
    renderKpis(data.kpis);

    // charts
    MiniCharts.render("bar", "chLiters", data.months, data.litersByMonth.map(v=>Calc.round(v,2)));
    MiniCharts.render("bar", "chMoney", data.months, data.moneyByMonth.map(v=>Calc.round(v,2)));

    const byV = [...data.byVehicle.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
    MiniCharts.render("bar", "chByVehicle", byV.map(x=>x[0]), byV.map(x=>Calc.round(x[1],2)));

    const byE = [...data.byExtraType.entries()];
    MiniCharts.render("donut", "chExtras", byE.map(x=>x[0]), byE.map(x=>Calc.round(x[1],2)));
  }

  UI.qs("#btnDashApply").addEventListener("click", () => {
    renderDashboard();
    UI.toastGlobal("Filtros aplicados.", "ok");
  });

  /* -------------------- RELATÓRIOS -------------------- */
  function renderGeneralReport(){
    const y = UI.qs("#rgYear").value || String(new Date().getFullYear());
    const rows = Reports.generalMonthly(db, y);

    const headers = ["Mês","KM","Litros","Combustível (R$)","Extras (R$)","Total (R$)","Km/L","R$/L"];
    const body = rows.map(r => ([
      r.month,
      UI.fmtNum(r.km,1),
      UI.fmtNum(r.liters,2),
      UI.fmtMoney(r.fuelMoney),
      UI.fmtMoney(r.extras),
      UI.fmtMoney(r.total),
      UI.fmtNum(r.kml,2),
      UI.fmtNum(r.rpl,3),
    ]));
    UI.table("generalTable", headers, body);

    UI.qs("#btnGenExport").onclick = () => {
      const csv = [
        headers.join(";"),
        ...rows.map(r => [
          r.month, r.km, r.liters, r.fuelMoney, r.extras, r.total, r.kml, r.rpl
        ].join(";"))
      ].join("\n");
      StorageLayer.download(`relatorio-geral-${y}.csv`, csv, "text/csv;charset=utf-8");
    };
  }

  function renderVehicleReport(){
    const plate = UI.qs("#rvPlate").value;
    if(!plate){ UI.qs("#rvSummary").textContent = "Selecione um veículo."; return; }
    const list = (db.refuels||[]).filter(r=>r.plate===plate).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    const s = Reports.summarizeRefuels(list);
    UI.qs("#rvSummary").innerHTML =
      `Registros: <b>${s.count}</b> • Litros: <b>${UI.fmtNum(s.liters,2)}</b> • KM: <b>${UI.fmtNum(s.km,1)}</b> • `+
      `Gasto: <b>${UI.fmtMoney(s.money)}</b> • Média Km/L: <b>${UI.fmtNum(s.avgKml,2)}</b>`;

    const headers = ["Data","Hora","Condutor","Posto","Combustível","Litros","Total","Hodômetro","KM","Km/L","Obs."];
    const rows = list.map(r => ([
      Calc.brDate(r.date), r.time||"", r.driver, r.station, r.fuel,
      UI.fmtNum(r.liters,3), UI.fmtMoney(r.total),
      UI.fmtNum(r.odo,0),
      r.km===""? "": r.km, r.consumption===""? "": r.consumption,
      r.notes||""
    ]));
    UI.table("rvTable", headers, rows);

    UI.qs("#btnRVExport").onclick = () => {
      const csv = [
        headers.join(";"),
        ...rows.map(r => r.map(c=>String(c).replaceAll("\n"," ")).join(";"))
      ].join("\n");
      StorageLayer.download(`relatorio-veiculo-${plate}.csv`, csv, "text/csv;charset=utf-8");
    };
  }

  function renderDriverReport(){
    const driver = UI.qs("#rdDriver").value;
    if(!driver){ UI.qs("#rdSummary").textContent = "Selecione um condutor."; return; }
    const list = (db.refuels||[]).filter(r=>r.driver===driver).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    const s = Reports.summarizeRefuels(list);
    UI.qs("#rdSummary").innerHTML =
      `Registros: <b>${s.count}</b> • Litros: <b>${UI.fmtNum(s.liters,2)}</b> • KM: <b>${UI.fmtNum(s.km,1)}</b> • `+
      `Gasto: <b>${UI.fmtMoney(s.money)}</b> • Média Km/L: <b>${UI.fmtNum(s.avgKml,2)}</b>`;

    const headers = ["Data","Hora","Placa","Posto","Combustível","Litros","Total","Hodômetro","KM","Km/L","Obs."];
    const rows = list.map(r => ([
      Calc.brDate(r.date), r.time||"", r.plate, r.station, r.fuel,
      UI.fmtNum(r.liters,3), UI.fmtMoney(r.total),
      UI.fmtNum(r.odo,0),
      r.km===""? "": r.km, r.consumption===""? "": r.consumption,
      r.notes||""
    ]));
    UI.table("rdTable", headers, rows);

    UI.qs("#btnRDExport").onclick = () => {
      const csv = [
        headers.join(";"),
        ...rows.map(r => r.map(c=>String(c).replaceAll("\n"," ")).join(";"))
      ].join("\n");
      StorageLayer.download(`relatorio-condutor-${driver}.csv`, csv, "text/csv;charset=utf-8");
    };
  }

  function renderFuelReport(){
    const fuel = UI.qs("#rfFuelSel").value;
    if(!fuel){ UI.qs("#rfSummary").textContent = "Selecione um combustível."; return; }
    const list = (db.refuels||[]).filter(r=>r.fuel===fuel).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    const s = Reports.summarizeRefuels(list);
    UI.qs("#rfSummary").innerHTML =
      `Registros: <b>${s.count}</b> • Litros: <b>${UI.fmtNum(s.liters,2)}</b> • KM: <b>${UI.fmtNum(s.km,1)}</b> • `+
      `Gasto: <b>${UI.fmtMoney(s.money)}</b> • Média Km/L: <b>${UI.fmtNum(s.avgKml,2)}</b>`;

    const headers = ["Data","Hora","Placa","Condutor","Posto","Litros","Total","R$/L","Hodômetro","KM","Km/L","Obs."];
    const rows = list.map(r => ([
      Calc.brDate(r.date), r.time||"", r.plate, r.driver, r.station,
      UI.fmtNum(r.liters,3), UI.fmtMoney(r.total), UI.fmtNum(r.pricePerLiter,3),
      UI.fmtNum(r.odo,0),
      r.km===""? "": r.km, r.consumption===""? "": r.consumption,
      r.notes||""
    ]));
    UI.table("rfTable2", headers, rows);

    UI.qs("#btnRFExport").onclick = () => {
      const csv = [
        headers.join(";"),
        ...rows.map(r => r.map(c=>String(c).replaceAll("\n"," ")).join(";"))
      ].join("\n");
      StorageLayer.download(`relatorio-combustivel-${fuel}.csv`, csv, "text/csv;charset=utf-8");
    };
  }

  function renderStationReport(){
    const stationKey = UI.qs("#rpStationSel").value;
    if(!stationKey){ UI.qs("#rpSummary").textContent = "Selecione um posto."; UI.table("rpTable2", [], []); UI.table("rpCreditTable", [], []); return; }

    const stObj = stationById(stationKey) || (db.stations||[]).find(s=>s.name===stationKey) || null;
    const stationName = stObj ? stObj.name : stationKey;

    const list = (db.refuels||[])
      .filter(r => {
        const st = stationById(r.station) || null;
        const name = st ? st.name : r.station;
        return String(name||"").toLowerCase() === String(stationName||"").toLowerCase();
      })
      .sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

    const s = Reports.summarizeRefuels(list);

    const isCredit = (r)=> (normalizePayMode(r.payMode)==="credit" || String(r.payMethod||"").trim()==="Crédito" || String(r.payMethod||"").trim()==="Credito");
    const spentCredit = list.filter(isCredit).reduce((acc,r)=>acc+(Number(r.total)||0),0);
    const spentCash = list.filter(r=>!isCredit(r)).reduce((acc,r)=>acc+(Number(r.total)||0),0);

    // movimentos (se a estação não tiver id, tentamos casar pelo nome)
    const stationKey2 = stObj ? stObj.id : stationKey;
    const moves = (db.creditMovements||[])
      .filter(mv => {
        const mvSt = stationById(mv.stationId);
        const mvName = mvSt ? mvSt.name : mv.stationId;
        return String(mvName||"").toLowerCase() === String(stationName||"").toLowerCase()
            || String(mv.stationId||"") === String(stationKey2||"");
      })
      .sort((a,b)=>String(b.ts||"").localeCompare(String(a.ts||"")));

    const topups = moves.filter(mv => (mv.meta||{}).type==="topup").reduce((acc,mv)=>acc+(Number(mv.delta)||0),0);
    const debits = moves.filter(mv => (mv.meta||{}).type==="refuel").reduce((acc,mv)=>acc+Math.abs(Number(mv.delta)||0),0);
    const saldo = stObj ? (Number(stObj.credit)||0) : 0;

    UI.qs("#rpSummary").innerHTML =
      `Posto: <b>${stationName}</b> • `+
      `Registros: <b>${s.count}</b> • Litros: <b>${UI.fmtNum(s.liters,2)}</b> • KM: <b>${UI.fmtNum(s.km,1)}</b><br/>`+
      `Gasto total: <b>${UI.fmtMoney(s.money)}</b> • No crédito: <b>${UI.fmtMoney(spentCredit)}</b> • Dinheiro/cartão: <b>${UI.fmtMoney(spentCash)}</b><br/>`+
      `Crédito do posto: <b>${UI.fmtMoney(saldo)}</b> • Aportes: <b>${UI.fmtMoney(topups)}</b> • Abatimentos: <b>${UI.fmtMoney(debits)}</b>`;

    // tabela movimentos
    const mvHeaders = ["Data/Hora","Tipo","Delta (R$)","Detalhe"];
    const mvRows = moves.map(mv => {
      const dt = (mv.ts||"").replace("T"," ").slice(0,19);
      const type = (mv.meta||{}).type || "";
      const detail = (mv.meta||{}).obs ? String(mv.meta.obs) : ((mv.meta||{}).refuelId ? `Ref: ${mv.meta.refuelId}` : "");
      return [
        dt,
        type==="topup" ? "Aporte" : (type==="refuel" ? "Abastecimento (crédito)" : type),
        UI.fmtMoney(Number(mv.delta)||0),
        detail
      ];
    });
    UI.table("rpCreditTable", mvHeaders, mvRows);

    // tabela abastecimentos
    const headers = ["Data","Hora","Placa","Condutor","Combustível","Litros","Total","Pagamento","R$/L","Hodômetro","KM","Km/L","Obs."];
    const rows = list.map(r => ([
      Calc.brDate(r.date), r.time||"", r.plate, r.driver, r.fuel,
      UI.fmtNum(r.liters,3), UI.fmtMoney(r.total),
      normalizePayMode(r.payMode)==="credit" ? "Crédito" : (normalizePayMode(r.payMode)==="cash" ? "Dinheiro" : (normalizePayMode(r.payMode)==="card" ? "Cartão" : (r.payMode||""))),
      UI.fmtNum(r.pricePerLiter,3),
      UI.fmtNum(r.odo,0),
      r.km===""? "": r.km, r.consumption===""? "": r.consumption,
      r.notes||""
    ]));
    UI.table("rpTable2", headers, rows);

    UI.qs("#btnRPExport").onclick = () => {
      const csv = [
        headers.join(";"),
        ...rows.map(r => r.map(c=>String(c).replaceAll("\n"," ")).join(";"))
      ].join("\n");
      StorageLayer.download(`relatorio-posto-${stationName}.csv`, csv, "text/csv;charset=utf-8");
    };
  }


  UI.qs("#rgYear").addEventListener("change", renderGeneralReport);
  UI.qs("#rvPlate").addEventListener("change", renderVehicleReport);
  UI.qs("#rdDriver").addEventListener("change", renderDriverReport);
  UI.qs("#rfFuelSel").addEventListener("change", renderFuelReport);

  /* -------------------- IMPORT/EXPORT -------------------- */
  let csvText = "";

  UI.qs("#csvFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if(!f) return;
    csvText = await f.text();
    UI.hideNotice("csvPreview");
    UI.hideNotice("csvErrors");
  });

  UI.qs("#btnCsvPreview").addEventListener("click", () => {
    if(!csvText){ UI.toastGlobal("Selecione um arquivo CSV.", "danger"); return; }
    const p = CsvImport.preview(csvText);
    const map = p.map;
    const lines = p.sample.map(row => row.slice(0, 6).join(" | "));
    UI.showNotice("csvPreview",
      `<b>Delimitador:</b> ${p.delim === ";" ? " ; (ponto e vírgula)" : " , (vírgula)"}<br/>
       <b>Linhas de dados:</b> ${p.lines}<br/>
       <b>Mapeamento detectado:</b> ${Object.entries(map).map(([k,v])=>`${k}:${v===null?"—":v}`).join(" • ")}<br/>
       <b>Amostra:</b><br/>${lines.map(l=>`<div class="meta">${l}</div>`).join("")}`,
      "ok"
    );
  });

  UI.qs("#btnCsvImport").addEventListener("click", () => {
    if(!csvText){ UI.toastGlobal("Selecione um arquivo CSV.", "danger"); return; }
    // licença não limita importação diretamente, mas limitará cadastro manual de veículos.
    // (Importação pode criar veículos; para uso comercial, você pode bloquear importação que exceda.)
    const before = (db.vehicles||[]).length;
    const res = CsvImport.importCsv(db, csvText);

    // regra comercial opcional: após import, se exceder limite, mantém dados mas bloqueia novos cadastros
    StorageLayer.save(db);
    refreshCombos(); renderAll();

    if(res.errors.length){
      UI.showNotice("csvErrors", `<b>Erros:</b><br/>${res.errors.slice(0,12).map(e=>`• ${e}`).join("<br/>")}${res.errors.length>12?"<br/>…(mais erros)":""}`, "danger");
    }else{
      UI.hideNotice("csvErrors");
    }
    UI.toastGlobal(`Importação concluída: ${res.added} registro(s) adicionados.`, res.errors.length ? "danger" : "ok");

    const after = (db.vehicles||[]).length;
    if(after > before){
      const lim = License.enforceVehicleLimit(db);
      if(lim.count > lim.limit){
        UI.toastGlobal("Atenção: importação criou veículos acima do limite do plano. Novos cadastros serão bloqueados.", "danger");
      }
    }
  });

  function exportRefuelsCSV(){
    const headers = ["Data","Horário","Placa do Veículo","Condutor","Posto","Combustível","Litros","Valor total (R$)","R$/Litro","Hodômetro","Completou?","Km rodados","Km/L","Observações"];
    const rows = (db.refuels||[]).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)).map(r => ([
      Calc.brDate(r.date),
      r.time||"",
      r.plate,
      r.driver,
      r.station,
      r.fuel,
      r.liters,
      r.total,
      r.pricePerLiter,
      r.odo,
      r.full,
      r.km,
      r.consumption,
      (r.notes||"").replaceAll("\n"," ")
    ]));
    const csv = [headers.join(";"), ...rows.map(r=>r.join(";"))].join("\n");
    StorageLayer.download("abastecimentos.csv", csv, "text/csv;charset=utf-8");
  }

  function exportExpensesCSV(){
    const headers = ["Data","Tipo","Veículo","Condutor","Valor (R$)","Descrição"];
    const rows = (db.expenses||[]).sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(e => ([
      Calc.brDate(e.date),
      e.type,
      e.plate||"",
      e.driver||"",
      e.value,
      (e.desc||"").replaceAll("\n"," ")
    ]));
    const csv = [headers.join(";"), ...rows.map(r=>r.join(";"))].join("\n");
    StorageLayer.download("despesas.csv", csv, "text/csv;charset=utf-8");
  }

  UI.qs("#btnExpRefuels").addEventListener("click", exportRefuelsCSV);
  UI.qs("#btnExpExpenses").addEventListener("click", exportExpensesCSV);

  UI.qs("#btnBackup").addEventListener("click", () => {
    const json = StorageLayer.exportJSON(db);
    StorageLayer.download(`backup-frotacontrol-${new Date().toISOString().slice(0,10)}.json`, json, "application/json;charset=utf-8");
  });

  UI.qs("#btnRestore").addEventListener("click", async () => {
    const f = UI.qs("#jsonFile").files[0];
    if(!f){ UI.toastGlobal("Selecione um arquivo JSON.", "danger"); return; }
    if(!UI.confirmDanger("Restaurar backup e substituir todos os dados locais?")) return;
    const text = await f.text();
    db = StorageLayer.importJSON(text);
    refreshCombos(); renderAll();
    UI.toastGlobal("Backup restaurado.", "ok");
  });

  /* -------------------- LICENÇA -------------------- */
  UI.qs("#btnLicApply").addEventListener("click", () => {
    const key = UI.qs("#licKey").value;
    try{
      const ok = License.validateKey(key);
      db.license = { mode:"ACTIVE", company:ok.company, plan:ok.plan, planLabel:ok.planLabel, limit:ok.limit, key: ok.key };
      StorageLayer.save(db);
      licenseBadge();
      UI.showNotice("licResult", `Licença ativada: <b>${ok.planLabel}</b> • Empresa: <b>${ok.company}</b> • Limite: <b>${ok.limit}</b>`, "ok");
      enforceLicenseUI();
    }catch(e){
      UI.showNotice("licResult", String(e.message||e), "danger");
    }
  });

  UI.qs("#btnLicDemo").addEventListener("click", () => {
    db.license = License.demo();
    StorageLayer.save(db);
    licenseBadge();
    UI.showNotice("licResult", "Modo Demo ativado.", "ok");
  });

  /* -------------------- INICIALIZAÇÃO -------------------- */
  function renderAll(){
    licenseBadge();
    enforceLicenseUI();
    refreshCombos();

    renderRefuels();
    renderExpenses();
    renderRegisters();

    renderDashboard();
    renderGeneralReport();
    renderVehicleReport();
    renderDriverReport();
    renderFuelReport();
    renderStationReport();

    // update derived preview
    updateDerivedPreview();
  }


  // Postos / Crédito (escopo correto)
  function stationById(id){
    const key = String(id||"").trim();
    if(!key) return null;
    const byId = (db.stations||[]).find(s=>s.id===key);
    if(byId) return byId;
    const low = key.toLowerCase();
    return (db.stations||[]).find(s=>String(s.name||"").toLowerCase()===low) || null;
  }

  function updateStationCreditHint(){
    const stId = UI.qs("#rfStation")?.value || "";
    const st = stationById(stId);
    const credit = st ? Number(st.credit)||0 : 0;
    const box = UI.qs("#rfStationCredit");
    if(box) box.value = UI.fmtMoney(credit);
  }

  
  function isCreditRefuel(r){
    return !!(r && (normalizePayMode(r.payMode)==="credit" || String(r.payMethod||"").trim()==="Crédito" || String(r.payMethod||"").trim()==="Credito"));
  }
// Reconciliar créditos: bases antigas/importadas podem ter abastecimentos "no crédito"
  // sem o movimento de abatimento registrado. Este procedimento cria os abatimentos faltantes.
  
  function normalizeLegacyPayModes(){
    let changed = false;
    for(const r of (db.refuels||[])){
      const before = r.payMode;
      const after = normalizePayMode(before);
      if(after && before !== after){
        r.payMode = after;
        changed = true;
      }
      // alguns CSVs antigos usavam payMethod como 'Crédito'
      if(!r.payMode && r.payMethod){
        const a2 = normalizePayMode(r.payMethod);
        if(a2){ r.payMode = a2; changed = true; }
      }
    }
    if(changed){
      try{ StorageLayer.save(db); }catch(_e){}
    }
  }
function reconcileStationCredits(){
    db.stations ||= [];
    db.creditMovements ||= [];
    const movedRefuelIds = new Set(
      db.creditMovements
        .filter(m=>m.meta && m.meta.type==="refuel" && m.meta.refuelId)
        .map(m=>m.meta.refuelId)
    );
    let changed = false;
    for(const r of (db.refuels||[])){
      if(!isCreditRefuel(r)) continue;
      if(!r.station) continue;
      if(movedRefuelIds.has(r.id)) continue; // já debitado
      applyStationCredit(r.station, -Number(r.total||0), {type:"refuel", refuelId: r.id, plate: r.plate, date: r.date});
      movedRefuelIds.add(r.id);
      changed = true;
    }
    if(changed){
      try{ StorageLayer.save(db); }catch(_e){}
    }
  }

function applyStationCredit(stationId, delta, meta){
    const st = stationById(stationId);
    if(!st) return;
    st.credit = (Number(st.credit)||0) + Number(delta||0);
    db.creditMovements ||= [];
    db.creditMovements.push({
      id: "cm_" + Math.random().toString(16).slice(2) + Date.now().toString(16),
      ts: new Date().toISOString(),
      stationId,
      delta: Number(delta||0),
      meta: meta || {}
    });
  }


  // PWA
  PWA.registerSW();
  PWA.setupInstallButton();
  PWA.watchOnlineBadge();

  // Inicial
  normalizeLegacyPayModes();
  reconcileStationCredits();

  // Inicial
  renderAll();

})();
