/**
 * csv-import.js — Importação CSV "sem dor" (Excel)
 * - aceita ; ou ,
 * - aceita variações de cabeçalho
 * - aceita moeda BR (R$ 1.234,56)
 * - aceita datas BR (dd/mm/aaaa) ou ISO
 * - cria automaticamente veículo/condutor/posto/combustível inexistentes
 * - prévia + relatório de erros
 */
window.CsvImport = (() => {
  const OFFICIAL_HEADERS = [
    "Data","Horário","Placa do Veículo","Condutor","Posto de combustível","Combustível utilizado",
    "Litros abastecido","Valor total abastecido","R$/Litro","Hodômetro do veículo","Completou o tanque?","Observações"
  ];

  const headerAliases = {
    date: ["data","dt","data abastecimento"],
    time: ["horário","horario","hora"],
    plate: ["placa do veículo","placa","veiculo","veículo"],
    driver: ["condutor","motorista"],
    station: ["posto de combustível","posto","posto combustivel","posto combustível"],
    fuel: ["combustível utilizado","combustivel utilizado","combustível","combustivel"],
    liters: ["litros abastecido","litros","qtd litros","quantidade"],
    total: ["valor total abastecido","valor total","total","valor"],
    rpl: ["r$/litro","preço litro","preco litro","valor litro"],
    odo: ["hodômetro do veículo","hodometro do veiculo","hodômetro","hodometro","odometro","km hodometro","hodometro do veículo","hodômetro do veiculo"],
    full: ["completou o tanque?","completou tanque","tanque cheio","completou?","completou"],
    notes: ["observações","observacoes","obs"]
  };

  function detectDelimiter(text){
    const sample = text.slice(0, 2000);
    const sc = (sample.match(/;/g)||[]).length;
    const cc = (sample.match(/,/g)||[]).length;
    // CSV do Excel BR costuma ser ; — mas aceita os dois
    return sc >= cc ? ";" : ",";
  }

  function splitLine(line, delim){
    // simples: divide por delim, respeitando aspas duplas
    const out = [];
    let cur = "";
    let inQ = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){ inQ = !inQ; continue; }
      if(!inQ && ch === delim){
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function normalizeHeader(h){
    return String(h||"").replace(/^\ufeff/,"")
      .toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ")
      .trim();
  }

  function mapHeaders(headers){
    const norm = headers.map(normalizeHeader);
    const idx = {};
    for(const [key, aliases] of Object.entries(headerAliases)){
      idx[key] = null;
      for(let i=0;i<norm.length;i++){
        if(aliases.some(a => normalizeHeader(a) === norm[i])){
          idx[key] = i;
          break;
        }
      }
    }
    // também aceita exatamente no padrão oficial
    if(headers.length === OFFICIAL_HEADERS.length){
      // tenta mapear por posição se os nomes baterem (mesmo que com variação pequena)
      // mas só se tiver ao menos "data" detectada
      if(idx.date === null && normalizeHeader(headers[0])==="data"){
        idx.date = 0; idx.time=1; idx.plate=2; idx.driver=3; idx.station=4; idx.fuel=5;
        idx.liters=6; idx.total=7; idx.rpl=8; idx.odo=9; idx.full=10; idx.notes=11;
      }
    }
    return idx;
  }

  function parseBRMoney(s){
    if(s===null || s===undefined) return 0;
    const raw = String(s).trim()
      .replace(/[R$\s]/g,"")
      .replace(/\./g,"")
      .replace(",",".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function parseNumber(s){
    if(s===null || s===undefined) return 0;
    const raw = String(s).trim().replace(",",".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDateBR(s){
    const t0 = String(s||"").trim();
    if(!t0) return "";

    // Excel serial date (ex.: 45200) — epoch 1899-12-30
    if(/^\d+(\.\d+)?$/.test(t0)){
      const serial = Number(t0);
      if(Number.isFinite(serial) && serial > 20000 && serial < 90000){
        const epoch = new Date(Date.UTC(1899,11,30));
        const ms = epoch.getTime() + serial * 86400000;
        const dt = new Date(ms);
        const y = dt.getUTCFullYear();
        const mo = String(dt.getUTCMonth()+1).padStart(2,"0");
        const d = String(dt.getUTCDate()).padStart(2,"0");
        return `${y}-${mo}-${d}`;
      }
    }

    // ISO date
    if(/^\d{4}-\d{2}-\d{2}$/.test(t0)) return t0;

    // dd/mm/aaaa (com ou sem hora)
    const t = t0.replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, "");
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if(m){
      const d = m[1].padStart(2,"0");
      const mo = m[2].padStart(2,"0");
      let y = m[3];
      if(y.length===2) y = "20"+y;
      return `${y}-${mo}-${d}`;
    }

    // dd-mm-aaaa
    m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if(m){
      const d = m[1].padStart(2,"0");
      const mo = m[2].padStart(2,"0");
      let y = m[3];
      if(y.length===2) y = "20"+y;
      return `${y}-${mo}-${d}`;
    }

    // fallback Date()
    const dt = new Date(t0);
    if(!isNaN(dt.getTime())){
      const y = dt.getFullYear();
      const mo = String(dt.getMonth()+1).padStart(2,"0");
      const d = String(dt.getDate()).padStart(2,"0");
      return `${y}-${mo}-${d}`;
    }
    return "";
  }

  function parseBoolSimNao(s){
    const t = String(s||"").trim().toLowerCase();
    if(["sim","s","yes","y","1","true"].includes(t)) return "Sim";
    return "Não";
  }

  function preview(text, maxLines=6){
    const delim = detectDelimiter(text);
    const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
    const head = splitLine(lines[0], delim);
    const idx = mapHeaders(head);
    const sample = [];
    for(let i=1;i<Math.min(lines.length, maxLines);i++){
      const cols = splitLine(lines[i], delim);
      sample.push(cols);
    }
    return { delim, headers: head, map: idx, lines: lines.length-1, sample };
  }

  function ensureEntity(db, type, value, prop="name"){
    const v = String(value||"").trim();
    if(!v) return "";
    const arr = db[type] || [];
    const found = arr.find(x => String(x[prop]).toLowerCase() === v.toLowerCase());
    if(found) return found[prop] === "plate" ? found.plate : found.name;
    // criar
    const id = StorageLayer.cryptoRandomId();
    if(type === "vehicles"){
      const obj = {id, plate:v.toUpperCase(), desc:""};
      db.vehicles.push(obj);
      return obj.plate;
    }else if(type === "drivers"){
      const obj = {id, name:v};
      db.drivers.push(obj);
      return obj.name;
    }else if(type === "stations"){
      const obj = {id, name:v};
      db.stations.push(obj);
      return obj.name;
    }else if(type === "fuels"){
      const obj = {id, name:v};
      db.fuels.push(obj);
      return obj.name;
    }
    return v;
  }

  function importCsv(db, text){
    const res = { added:0, errors:[], warnings:[] };
    const delim = detectDelimiter(text);
    const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
    if(lines.length<2) throw new Error("CSV vazio.");
    const headers = splitLine(lines[0], delim);
    const map = mapHeaders(headers);

    // campos obrigatórios mínimos
    const required = ["date","time","plate","driver","station","fuel","liters","total","odo"];
    for(const k of required){
      if(map[k]===null) res.errors.push(`Cabeçalho não encontrado para: ${k}`);
    }
    if(res.errors.length) return res;

    for(let i=1;i<lines.length;i++){
      const cols = splitLine(lines[i], delim);

      const get = (k) => cols[map[k]] ?? "";
      const date = parseDateBR(get("date"));
      const time = String(get("time")||"").trim() || "00:00";
      const plateRaw = get("plate");
      const driverRaw = get("driver");
      const stationRaw = get("station");
      const fuelRaw = get("fuel");

      const liters = parseNumber(get("liters"));
      const total = parseBRMoney(get("total"));
      const odo = parseNumber(get("odo"));
      const full = parseBoolSimNao(get("full"));
      const notes = String(get("notes")||"").trim();

      if(!date) { res.errors.push(`Linha ${i+1}: data inválida (${get("date")}).`); continue; }
      if(!plateRaw) { res.errors.push(`Linha ${i+1}: placa vazia.`); continue; }
      if(!driverRaw) { res.errors.push(`Linha ${i+1}: condutor vazio.`); continue; }
      if(liters<=0) { res.errors.push(`Linha ${i+1}: litros inválido.`); continue; }
      if(total<=0) { res.errors.push(`Linha ${i+1}: valor total inválido.`); continue; }
      if(odo<0) { res.errors.push(`Linha ${i+1}: hodômetro inválido.`); continue; }

      // cria cadastros
      const plate = ensureEntity(db, "vehicles", plateRaw, "plate");
      const driver = ensureEntity(db, "drivers", driverRaw, "name");
      const station = ensureEntity(db, "stations", stationRaw, "name");
      const fuel = ensureEntity(db, "fuels", fuelRaw, "name");

      // monta registro
      const r = {
        id: StorageLayer.cryptoRandomId(),
        date, time,
        plate, driver, station, fuel,
        liters, total,
        pricePerLiter: 0,
        odo,
        full,
        km: "",
        consumption: "",
        notes
      };

      // calcula derivados e valida hodômetro
      const c = Calc.computeDerived(db, r);
      if(!c.ok){
        res.errors.push(`Linha ${i+1}: ${c.error}`);
        continue;
      }
      r.pricePerLiter = c.derived.pricePerLiter;
      r.km = c.derived.km;
      r.consumption = c.derived.consumption;

      db.refuels.push(r);
      res.added++;
    }

    // ao final, recalcula tudo para manter consistência (ordem temporal)
    Calc.recalcAll(db);
    return res;
  }

  return { OFFICIAL_HEADERS, preview, importCsv };
})();
