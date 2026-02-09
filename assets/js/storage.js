/**
 * storage.js — persistência local (LocalStorage) + backup/restore
 * Tudo offline, sem backend.
 */
window.StorageLayer = (() => {
  const KEY = "FrotaControl::db::v1";
  const META = {
    product: "FrotaControl",
    version: "1.2",
    schema: 1,
    createdAt: null
  };

  function nowISO(){ return new Date().toISOString(); }

  function defaultDB(){
    return {
      meta: {...META, createdAt: nowISO(), updatedAt: nowISO()},
      license: { mode:"DEMO", company:"", plan:"DEMO", limit: 10, key:"" },
      vehicles: [
        { id: cryptoRandomId(), plate:"AAA0A00", desc:"Exemplo • Caminhonete" },
      ],
      drivers: [
        { id: cryptoRandomId(), name:"Motorista 1" }
      ],
      stations: [
        { id: cryptoRandomId(), name:"Posto Central", credit: 0 }
      ],
      fuels: [
        { id: cryptoRandomId(), name:"Diesel S10" },
        { id: cryptoRandomId(), name:"Gasolina" }
      ],
      refuels: [],
      expenses: [],
      creditMovements: []
    };
  }

  function cryptoRandomId(){
    // ID curto e suficiente para uso local
    return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaultDB();
      const db = JSON.parse(raw);
      // upgrades simples
      db.meta = db.meta || {...META, createdAt: nowISO()};
      db.meta.updatedAt = nowISO();
      db.vehicles ||= [];
      db.drivers ||= [];
      db.stations ||= [];
      db.fuels ||= [];
      db.refuels ||= [];
      db.expenses ||= [];
      db.creditMovements ||= [];
      // garante campo "credit" nos postos
      db.stations.forEach(s => { if(typeof s.credit !== "number") s.credit = Number(s.credit)||0; });
      db.license ||= { mode:"DEMO", company:"", plan:"DEMO", limit:10, key:"" };
      return db;
    }catch(e){
      console.warn("DB corrompido, reiniciando", e);
      return defaultDB();
    }
  }

  function save(db){
    db.meta.updatedAt = nowISO();
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function wipe(){
    localStorage.removeItem(KEY);
  }

  function exportJSON(db){
    return JSON.stringify(db, null, 2);
  }

  function importJSON(jsonText){
    const obj = JSON.parse(jsonText);
    // validação mínima
    if(!obj || typeof obj !== "object") throw new Error("JSON inválido.");
    if(!obj.meta) obj.meta = {...META, createdAt: nowISO()};
    if(!obj.license) obj.license = { mode:"DEMO", company:"", plan:"DEMO", limit:10, key:"" };
    obj.vehicles ||= [];
    obj.drivers ||= [];
    obj.stations ||= [];
    obj.fuels ||= [];
    obj.refuels ||= [];
    obj.expenses ||= [];
    save(obj);
    return obj;
  }

  function download(filename, content, mime="text/plain;charset=utf-8"){
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { KEY, load, save, wipe, exportJSON, importJSON, download, cryptoRandomId };
})();
