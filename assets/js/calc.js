/**
 * calc.js — cálculos automáticos
 * - R$/Litro = total / litros
 * - Km rodados = odômetro atual - anterior (por veículo)
 * - Consumo = km / litros
 */
window.Calc = (() => {
  function toNumber(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function round(n, d=2){
    const p = Math.pow(10,d);
    return Math.round((n + Number.EPSILON) * p) / p;
  }

  function brMoney(n){
    const v = Number(n);
    return (Number.isFinite(v)?v:0).toLocaleString("pt-BR",{style:"currency", currency:"BRL"});
  }

  function brNumber(n, d=2){
    const v = Number(n);
    return (Number.isFinite(v)?v:0).toLocaleString("pt-BR",{minimumFractionDigits:d, maximumFractionDigits:d});
  }

  function brDate(iso){
    if(!iso) return "";
    // iso YYYY-MM-DD
    const [y,m,d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  }

  function sortRefuels(refuels){
    return [...refuels].sort((a,b) => {
      const da = `${a.date||""}T${a.time||"00:00"}`;
      const db = `${b.date||""}T${b.time||"00:00"}`;
      return da.localeCompare(db);
    });
  }

  function findPreviousRefuel(refuels, plate, date, time, excludeId=null){
    // considera todos do mesmo veículo ordenados
    const list = sortRefuels(refuels.filter(r => r.plate===plate && r.id!==excludeId));
    const curKey = `${date}T${time||"00:00"}`;
    let prev = null;
    for(const r of list){
      const key = `${r.date}T${r.time||"00:00"}`;
      if(key < curKey) prev = r;
      else break;
    }
    return prev;
  }

  function computeDerived(db, refuel){
    const liters = toNumber(refuel.liters);
    const total = toNumber(refuel.total);
    const odo = toNumber(refuel.odo);

    const pricePerLiter = liters>0 ? total/liters : 0;

    // km/consumo dependem do histórico
    const prev = findPreviousRefuel(db.refuels||[], refuel.plate, refuel.date, refuel.time, refuel.id);
    let km = null;
    let cons = null;
    if(prev && Number.isFinite(toNumber(prev.odo))){
      const prevOdo = toNumber(prev.odo);
      if(odo < prevOdo){
        return { ok:false, error:`Hodômetro menor que o anterior (${prevOdo}).`, derived:null, prevOdo };
      }
      km = odo - prevOdo;
      cons = liters>0 ? km/liters : null;
    }

    return {
      ok:true,
      error:"",
      derived:{
        pricePerLiter: round(pricePerLiter, 3),
        km: (km===null? "" : round(km, 1)),
        consumption: (cons===null? "" : round(cons, 2)),
      }
    };
  }

  function recalcAll(db){
    // Recalcula km/consumo para todos, por veículo, na ordem temporal
    const byPlate = {};
    for(const r of sortRefuels(db.refuels||[])){
      byPlate[r.plate] ||= [];
      byPlate[r.plate].push(r);
    }
    for(const plate of Object.keys(byPlate)){
      const list = byPlate[plate];
      let prevOdo = null;
      for(const r of list){
        const liters = toNumber(r.liters);
        const total = toNumber(r.total);
        const odo = toNumber(r.odo);
        r.pricePerLiter = liters>0 ? round(total/liters,3) : 0;
        if(prevOdo===null || !Number.isFinite(prevOdo)){
          r.km = "";
          r.consumption = "";
          prevOdo = odo;
          continue;
        }
        if(odo < prevOdo){
          // mantém vazio e não avança prevOdo para não mascarar erro
          r.km = "";
          r.consumption = "";
          continue;
        }
        const km = odo - prevOdo;
        r.km = round(km,1);
        r.consumption = liters>0 ? round(km/liters,2) : "";
        prevOdo = odo;
      }
    }
  }

  return { toNumber, round, brMoney, brNumber, brDate, computeDerived, recalcAll };
})();
