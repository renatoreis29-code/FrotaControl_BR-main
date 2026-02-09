/**
 * reports.js — agregações para dashboard/relatórios
 */


  // ============================
  // Relatório Financeiro (Consolidado)
  // ============================

  function periodToRange(year, period){
    // Retorna {fromMonth, toMonth} em 1-12. period values follow dashboard: "all", "Q1", ...
    if(!period || period==="all") return {fromMonth:1, toMonth:12};
    const map={
      "m1":[1,1],"m2":[2,2],"m3":[3,3],"m4":[4,4],"m5":[5,5],"m6":[6,6],
      "m7":[7,7],"m8":[8,8],"m9":[9,9],"m10":[10,10],"m11":[11,11],"m12":[12,12],
      "Q1":[1,3],"Q2":[4,6],"Q3":[7,9],"Q4":[10,12],
      "H1":[1,6],"H2":[7,12],
      "OCTDEC":[10,12]
    };
    const v=map[period];
    return v?{fromMonth:v[0], toMonth:v[1]}:{fromMonth:1, toMonth:12};
  }

  function monthLabel(m){
    const names=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return names[m-1] || String(m);
  }

  function inFilterRefuel(r, f){
    if(!r) return false;
    if(f.year && (r.date||"").slice(0,4) !== String(f.year)) return false;

    // period by month
    if(f.fromMonth && f.toMonth){
      const mm = Number((r.date||"").slice(5,7) || 0);
      if(mm < f.fromMonth || mm > f.toMonth) return false;
    }

    if(f.vehicle && f.vehicle!=="all" && r.plate !== f.vehicle) return false;
    if(f.driver && f.driver!=="all" && r.driver !== f.driver) return false;
    if(f.fuel && f.fuel!=="all" && r.fuel !== f.fuel) return false;

    return true;
  }

  function inFilterExpense(e, f){
    if(!e) return false;
    if(f.year && (e.date||"").slice(0,4) !== String(f.year)) return false;
    if(f.fromMonth && f.toMonth){
      const mm = Number((e.date||"").slice(5,7) || 0);
      if(mm < f.fromMonth || mm > f.toMonth) return false;
    }
    if(f.vehicle && f.vehicle!=="all" && (e.plate||"") !== f.vehicle) return false;
    if(f.driver && f.driver!=="all" && (e.driver||"") !== f.driver) return false;
    // expense has no fuel filter
    return true;
  }

  function sumRefuels(db, f){
    const refuels=(db.refuels||[]).filter(r=>inFilterRefuel(r,f));
    const liters = refuels.reduce((a,r)=>a+(+r.liters||0),0);
    const fuelCost = refuels.reduce((a,r)=>a+(+r.total||0),0);
    const km = refuels.reduce((a,r)=>a+(+r.km||0),0); // km is computed; first record often 0
    return {refuels, liters, fuelCost, km};
  }

  function sumExtras(db, f){
    const expenses=(db.expenses||[]).filter(e=>inFilterExpense(e,f));
    const extras = expenses.reduce((a,e)=>a+(+e.amount||0),0);
    return {expenses, extras};
  }

  function fmt(n){
    return UI.fmtMoney(n||0);
  }
  function fmtNum(n){
    return UI.fmtNum(n||0);
  }

  function renderFinancialReport(db){
    const ySel = UI.qs("#finYear");
    const pSel = UI.qs("#finPeriod");
    const vSel = UI.qs("#finVehicle");
    const dSel = UI.qs("#finDriver");
    const fSel = UI.qs("#finFuel");

    if(!ySel) return;

    // Populate selects if empty
    if(ySel.options.length===0){
      const years = Array.from(new Set((db.refuels||[]).map(r=>(r.date||"").slice(0,4)).filter(Boolean))).sort();
      const cur = String(new Date().getFullYear());
      if(years.length===0) years.push(cur);
      UI.fillSelect("finYear", years.map(y=>({value:y, label:y})), years.includes(cur)?cur:years[years.length-1]);
    }

    if(pSel.options.length===0){
      const opts=[
        {value:"all", label:"Todo o ano"},
        {value:"m1", label:"Janeiro"}, {value:"m2", label:"Fevereiro"}, {value:"m3", label:"Março"},
        {value:"m4", label:"Abril"}, {value:"m5", label:"Maio"}, {value:"m6", label:"Junho"},
        {value:"m7", label:"Julho"}, {value:"m8", label:"Agosto"}, {value:"m9", label:"Setembro"},
        {value:"m10", label:"Outubro"}, {value:"m11", label:"Novembro"}, {value:"m12", label:"Dezembro"},
        {value:"Q1", label:"Jan–Mar"}, {value:"Q2", label:"Abr–Jun"}, {value:"Q3", label:"Jul–Set"}, {value:"Q4", label:"Out–Dez"},
        {value:"H1", label:"Jan–Jun"}, {value:"H2", label:"Jul–Dez"},
      ];
      UI.fillSelect("finPeriod", opts, "all");
    }

    if(vSel.options.length===0){
      const v = (db.vehicles||[]).map(x=>({value:x.plate, label:(x.plate + (x.desc?(" — "+x.desc):""))}));
      UI.fillSelect("finVehicle", [{value:"all",label:"Todos"}].concat(v), "all");
    }
    if(dSel.options.length===0){
      const d = (db.drivers||[]).map(x=>({value:x.name, label:x.name}));
      UI.fillSelect("finDriver", [{value:"all",label:"Todos"}].concat(d), "all");
    }
    if(fSel.options.length===0){
      const ff = (db.fuels||[]).map(x=>({value:x.name, label:x.name}));
      UI.fillSelect("finFuel", [{value:"all",label:"Todos"}].concat(ff), "all");
    }

    const year = ySel.value;
    const period = pSel.value;
    const rng = periodToRange(year, period);
    const f = {
      year,
      fromMonth:rng.fromMonth,
      toMonth:rng.toMonth,
      vehicle:vSel.value,
      driver:dSel.value,
      fuel:fSel.value
    };

    const s1=sumRefuels(db,f);
    const s2=sumExtras(db,f);
    const total = s1.fuelCost + s2.extras;
    const costKm = s1.km>0 ? (total / s1.km) : null;
    const kmL = s1.liters>0 ? (s1.km / s1.liters) : null;
    const rL = s1.liters>0 ? (s1.fuelCost / s1.liters) : null;

    UI.qs("#finKpiFuel").textContent = fmt(s1.fuelCost);
    UI.qs("#finKpiExtras").textContent = fmt(s2.extras);
    UI.qs("#finKpiTotal").textContent = fmt(total);
    UI.qs("#finKpiCostKm").textContent = costKm==null ? "—" : ("R$ " + UI.fmtNum(costKm, 3));
    UI.qs("#finKpiKm").textContent = fmtNum(s1.km);
    UI.qs("#finKpiLiters").textContent = fmtNum(s1.liters);
    UI.qs("#finKpiKmL").textContent = kmL==null ? "—" : UI.fmtNum(kmL, 2);
    UI.qs("#finKpiRL").textContent = rL==null ? "—" : UI.fmtNum(rL, 3);

    // Table: monthly lines within selected range
    const tbody = UI.qs("#finTbody");
    tbody.innerHTML = "";
    const months = [];
    for(let m=rng.fromMonth;m<=rng.toMonth;m++) months.push(m);

    const monthRows = months.map(m=>{
      const mf = {...f, fromMonth:m, toMonth:m};
      const a=sumRefuels(db,mf);
      const b=sumExtras(db,mf);
      const t=a.fuelCost+b.extras;
      const cpk=a.km>0 ? (t/a.km) : null;
      return {m, km:a.km, liters:a.liters, fuel:a.fuelCost, extras:b.extras, total:t, costKm:cpk};
    });

    // If period is single month, show just that month label
    monthRows.forEach(r=>{
      const tr=document.createElement("tr");
      const label = (period==="all") ? monthLabel(r.m) : monthLabel(r.m);
      tr.innerHTML = `
        <td>${label}</td>
        <td>${UI.fmtNum(r.km)}</td>
        <td>${UI.fmtNum(r.liters)}</td>
        <td>${fmt(r.fuel)}</td>
        <td>${fmt(r.extras)}</td>
        <td>${fmt(r.total)}</td>
        <td>${r.costKm==null ? "—" : ("R$ "+UI.fmtNum(r.costKm,3))}</td>
      `;
      tbody.appendChild(tr);
    });

    // Top 5 Vehicles by cost (respect year/period/driver/fuel but group by vehicle)
    const baseF = {year, fromMonth:rng.fromMonth,toMonth:rng.toMonth, driver:dSel.value, fuel:fSel.value};
    const vehicleKeys = (db.vehicles||[]).map(v=>v.plate);
    const vAgg = vehicleKeys.map(plate=>{
      const vf={...baseF, vehicle:plate};
      const a=sumRefuels(db,vf); const b=sumExtras(db,vf);
      const tot=a.fuelCost+b.extras;
      const cpk=a.km>0?tot/a.km:null;
      return {key:plate, total:tot, km:a.km, costKm:cpk};
    }).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,5);

    const vBody=UI.qs("#finTopVehicles");
    vBody.innerHTML="";
    vAgg.forEach(x=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `<td>${x.key}</td><td>${fmt(x.total)}</td><td>${UI.fmtNum(x.km)}</td><td>${x.costKm==null?"—":"R$ "+UI.fmtNum(x.costKm,3)}</td>`;
      vBody.appendChild(tr);
    });
    if(vAgg.length===0){
      vBody.innerHTML = `<tr><td colspan="4" class="meta">Sem dados no filtro aplicado.</td></tr>`;
    }

    // Top 5 Drivers by cost (respect year/period/vehicle/fuel but group by driver)
    const driverKeys = (db.drivers||[]).map(d=>d.name);
    const dAgg = driverKeys.map(name=>{
      const df={year, fromMonth:rng.fromMonth,toMonth:rng.toMonth, vehicle:vSel.value, driver:name, fuel:fSel.value};
      const a=sumRefuels(db,df); const b=sumExtras(db,df);
      const tot=a.fuelCost+b.extras;
      const cpk=a.km>0?tot/a.km:null;
      return {key:name, total:tot, km:a.km, costKm:cpk};
    }).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,5);

    const dBody=UI.qs("#finTopDrivers");
    dBody.innerHTML="";
    dAgg.forEach(x=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `<td>${x.key}</td><td>${fmt(x.total)}</td><td>${UI.fmtNum(x.km)}</td><td>${x.costKm==null?"—":"R$ "+UI.fmtNum(x.costKm,3)}</td>`;
      dBody.appendChild(tr);
    });
    if(dAgg.length===0){
      dBody.innerHTML = `<tr><td colspan="4" class="meta">Sem dados no filtro aplicado.</td></tr>`;
    }
  }

window.Reports = (() => {
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  function monthIndex(dateISO){
    const m = parseInt(String(dateISO||"").split("-")[1]||"0",10);
    return m ? (m-1) : null;
  }

  function yearOf(dateISO){
    return parseInt(String(dateISO||"").split("-")[0]||"0",10) || null;
  }

  function inFilters(r, f){
    if(f.year && yearOf(r.date) !== Number(f.year)) return false;
    if(f.plate && f.plate !== "all" && r.plate !== f.plate) return false;
    if(f.driver && f.driver !== "all" && r.driver !== f.driver) return false;
    if(f.fuel && f.fuel !== "all" && r.fuel !== f.fuel) return false;

    if(f.period && f.period !== "all"){
      const idx = monthIndex(r.date);
      if(idx===null) return false;
      const q = Number(f.period);
      const start = (q-1)*3;
      const end = start+2;
      if(idx < start || idx > end) return false;
    }
    return true;
  }

  function sum(arr, key){
    return arr.reduce((a,x)=>a + (Number(x[key])||0), 0);
  }

  function avg(arr, key){
    if(!arr.length) return 0;
    return sum(arr,key)/arr.length;
  }

  function groupSum(arr, getKey, getVal){
    const map = new Map();
    for(const item of arr){
      const k = getKey(item);
      const v = getVal(item);
      map.set(k, (map.get(k)||0) + v);
    }
    return map;
  }

  function dashboard(db, filters){
    const refuels = (db.refuels||[]).filter(r => inFilters(r, filters));
    const expenses = (db.expenses||[]).filter(e => {

    const stationCreditTotal = (db.stations||[]).reduce((acc,s)=>acc+(Number(s.credit)||0),0);
      // despesas: ano/veículo/condutor aplicam; combustível não.
      if(filters.year && yearOf(e.date) !== Number(filters.year)) return false;
      if(filters.plate && filters.plate !== "all" && e.plate && e.plate !== filters.plate) return false;
      if(filters.driver && filters.driver !== "all" && e.driver && e.driver !== filters.driver) return false;
      if(filters.period && filters.period !== "all"){
        const idx = monthIndex(e.date);
        if(idx===null) return false;
        const q = Number(filters.period);
        const start = (q-1)*3;
        const end = start+2;
        if(idx < start || idx > end) return false;
      }
      return true;
    });

    const liters = sum(refuels,"liters");
    const km = sum(refuels,"km");
    const fuelMoney = sum(refuels,"total");
    const avgPrice = liters>0 ? fuelMoney/liters : 0;

    // Média km/L ponderada: km total / litros total
    const avgKml = liters>0 ? km/liters : 0;

    const extras = sum(expenses,"value");
    const totalAll = fuelMoney + extras;

    // Séries mensais
    const litersByMonth = Array(12).fill(0);
    const moneyByMonth = Array(12).fill(0);
    for(const r of refuels){
      const idx = monthIndex(r.date);
      if(idx===null) continue;
      litersByMonth[idx] += Number(r.liters)||0;
      moneyByMonth[idx] += Number(r.total)||0;
    }

    // Gastos por veículo
    const byVehicle = groupSum(refuels, r => r.plate, r => Number(r.total)||0);
    // Extras por tipo
    const byExtraType = groupSum(expenses, e => e.type, e => Number(e.value)||0);

    return {
      kpis:{ liters, km, fuelMoney, avgPrice, avgKml, extras, totalAll },
      litersByMonth, moneyByMonth, byVehicle, byExtraType,
      months
    };
  }

  function generalMonthly(db, year){
    const y = Number(year);
    const refuels = (db.refuels||[]).filter(r => yearOf(r.date)===y);
    const expenses = (db.expenses||[]).filter(e => yearOf(e.date)===y);

    const rows = [];
    for(let m=0;m<12;m++){
      const rM = refuels.filter(r => monthIndex(r.date)===m);
      const eM = expenses.filter(e => monthIndex(e.date)===m);
      const liters = sum(rM,"liters");
      const km = sum(rM,"km");
      const fuelMoney = sum(rM,"total");
      const extras = sum(eM,"value");
      const total = fuelMoney + extras;
      const kml = liters>0 ? km/liters : 0;
      const rpl = liters>0 ? fuelMoney/liters : 0;
      rows.push({
        month: months[m],
        km, liters, fuelMoney, extras, total, kml, rpl
      });
    }
    return rows;
  }

  function filterRefuels(db, predicate){
    return (db.refuels||[]).filter(predicate);
  }

  function summarizeRefuels(refuels){
    const liters = sum(refuels,"liters");
    const km = sum(refuels,"km");
    const money = sum(refuels,"total");
    const avgPrice = liters>0 ? money/liters : 0;
    const avgKml = liters>0 ? km/liters : 0;
    return {
      liters, km, money, avgPrice, avgKml, count:refuels.length };
  }

  return {
      dashboard, generalMonthly, filterRefuels, summarizeRefuels, months, yearOf };
})();
