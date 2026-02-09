/**
 * license.js — controle comercial OFFLINE (sem servidor)
 *
 * Regras:
 * - Chave: EMPRESA|PLANO|LIMITE|HASH
 * - HASH é um checksum simples (não criptográfico) para reduzir uso casual indevido.
 * - A licença limita quantidade de veículos cadastrados.
 */
window.License = (() => {
  const PLANS = {
    BASICO: {label:"Básico", limit:10},
    PRO: {label:"Profissional", limit:30},
    AVANCADO: {label:"Avançado", limit:100},
    DEMO: {label:"Demo", limit:10},
  };

  // "Sal comercial" simples — você pode trocar para gerar chaves próprias.
  const SALT = "FrotaControl::offline-license::v1";

  function normalizePlan(p){
    const up = String(p||"").trim().toUpperCase();
    if(up === "BÁSICO") return "BASICO";
    if(up === "PROFISSIONAL") return "PRO";
    if(up === "AVANÇADO") return "AVANCADO";
    return up;
  }

  function checksum(str){
    // FNV-1a 32-bit (simples e rápido)
    let h = 0x811c9dc5;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ("00000000"+h.toString(16).toUpperCase()).slice(-8);
  }

  function makeHash(company, plan, limit){
    const base = `${company}|${plan}|${limit}|${SALT}`.toUpperCase();
    return checksum(base);
  }

  function parseKey(key){
    const parts = String(key||"").trim().split("|");
    if(parts.length !== 4) throw new Error("Formato inválido. Use EMPRESA|PLANO|LIMITE|HASH");
    const company = parts[0].trim();
    const plan = normalizePlan(parts[1]);
    const limit = parseInt(parts[2],10);
    const hash = parts[3].trim().toUpperCase();
    if(!company) throw new Error("Empresa vazia.");
    if(!plan) throw new Error("Plano vazio.");
    if(!Number.isFinite(limit) || limit<=0) throw new Error("Limite inválido.");
    return {company, plan, limit, hash};
  }

  function validateKey(key){
    const p = parseKey(key);
    const expected = makeHash(p.company, p.plan, p.limit);
    const planInfo = PLANS[p.plan] || {label:p.plan, limit:p.limit};
    if(p.hash !== expected) throw new Error("HASH inválido para esta chave.");
    // regra comercial: o limite precisa ser compatível com o plano, mas você pode flexibilizar
    const min = planInfo.limit;
    if(p.limit > min && (p.plan==="BASICO" || p.plan==="PRO" || p.plan==="AVANCADO")){
      // se quiser permitir limites custom, remova esta checagem
      // Aqui, aceitamos custom desde que NÃO exceda o teto do plano oficial
      if(p.limit > PLANS[p.plan].limit) throw new Error("Limite excede o teto do plano.");
    }
    return { ok:true, company:p.company, plan:p.plan, planLabel:planInfo.label, limit:p.limit, key };
  }

  function demo(){
    return { mode:"DEMO", company:"", plan:"DEMO", planLabel:PLANS.DEMO.label, limit:PLANS.DEMO.limit, key:"" };
  }

  function enforceVehicleLimit(db){
    // Retorna {blocked:boolean, remaining:number}
    const limit = (db.license && db.license.limit) ? db.license.limit : PLANS.DEMO.limit;
    const count = (db.vehicles || []).length;
    const remaining = Math.max(0, limit - count);
    return { blocked: count >= limit, remaining, limit, count };
  }

  return { PLANS, makeHash, validateKey, demo, enforceVehicleLimit };
})();
