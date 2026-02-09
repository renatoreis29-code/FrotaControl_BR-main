# FrotaControl (PWA offline) — v1.3.2

Produto comercial (frontend-only) no formato **PWA** para **Gestão de Combustível e Despesas de Frota**, com foco em pequenas e médias empresas, agronegócio e transportadores locais.

✅ **Sem backend**  
✅ **Sem internet** (após o primeiro carregamento / cache)  
✅ **Dados locais** (LocalStorage)  
✅ **Instalável no Android** (PWA)  
✅ **Importa CSV do Excel “sem dor”**  
✅ **Controle de licença por plano (offline)**

---

## 1) Estrutura de arquivos

```
index.html
manifest.webmanifest
sw.js
/assets
  /css/style.css
  /js/
    app.js
    storage.js
    license.js
    csv-import.js
    calc.js
    reports.js
    charts.js
    ui.js
    pwa.js
  /icons/
    icon-192.png
    icon-512.png
README.md
```

---

## 2) Como rodar localmente (PC) e testar no celular

### Opção A — Servidor local (recomendado)
PWA exige **servido via HTTP** (não funciona bem via `file://`).

1. Abra um terminal na pasta do projeto
2. Rode um servidor simples:

**Python**
```bash
python -m http.server 8080
```

Acesse no navegador:
- `http://localhost:8080`

### Opção B — Hospedar no GitHub Pages (ideal para vender como “aplicativo instalável”)
1. Crie um repositório
2. Envie todos os arquivos
3. Ative **Settings → Pages**
4. Abra o link publicado no Android

---

## 3) Instalar no Android (PWA)

1. Abra o link do app no **Chrome**
2. Toque no botão **Instalar** (no topo) ou no menu do Chrome → **Instalar app**
3. O ícone aparecerá na tela inicial
4. Abra o app instalado (funciona offline)

---

## 4) Importação CSV (Excel) “sem dor”

Na tela **Importar / Exportar**:

- Aceita delimitador `;` ou `,`
- Aceita datas BR (dd/mm/aaaa) ou ISO (aaaa-mm-dd)
- Aceita moeda brasileira (R$ 1.234,56)
- **Cria automaticamente** veículos, condutores, postos e combustíveis que não existirem
- Mostra **Prévia** e **erros** (se houver)

### Cabeçalho oficial do CSV (padrão Excel)
```
Data;Horário;Placa do Veículo;Condutor;Posto de combustível;Combustível utilizado;Litros abastecido;Valor total abastecido;R$/Litro;Hodômetro do veículo;Completou o tanque?;Observações
```

---

## 5) Exportação / Backup

- Exportar CSV (abastecimentos)
- Exportar CSV (despesas)
- Exportar JSON (backup completo)
- Importar JSON (restaurar)

> Restaurar backup substitui todo o banco local.

---

## 6) Controle de licença (offline)

Tela: **Licença / Sobre**

Chave no formato:

```
EMPRESA|PLANO|LIMITE|HASH
```

Planos sugeridos:
- **BASICO** → até 10 veículos
- **PRO** → até 30 veículos
- **AVANCADO** → até 100 veículos

### Gerar chaves
O algoritmo está em `assets/js/license.js` (função `makeHash`).

Exemplo (no console do navegador):
```js
License.makeHash("Minha Empresa", "PRO", 30)
```

Depois monte a chave:
```
Minha Empresa|PRO|30|<HASH>
```

---

## 7) Observações comerciais (pronto para venda)
- O controle de licença é **local** (sem servidor).
- Para uma estratégia mais “forte”, você pode:
  - ofuscar o `SALT` em `license.js`
  - trocar o algoritmo do hash
  - adicionar “fingerprint” local (ex.: storage + userAgent)
  - distribuir builds diferentes por cliente

---

## 8) Suporte
Se quiser evoluir para:
- multi-empresas,
- múltiplos usuários locais,
- mais gráficos,
- impressão em PDF,
- temas e marca do cliente,

o projeto já está modularizado para crescer.


---

## Impressão de relatórios

- Abra um relatório (Geral / Veículo / Condutor / Combustível)
- Clique em **Imprimir** no topo
- O app gera uma impressão limpa (sem menu e sem cabeçalho)


- Novo: **Relatório por Posto** (resumo, abastecimentos e movimentação de crédito).
