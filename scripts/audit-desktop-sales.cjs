// Diagnostic reproductions for v1.7.0. No application or customer DB is opened.
// Run: node scripts/audit-desktop-sales.cjs <path-to-sales.csv>
// BUG results assert the observed defect, not that the behavior is acceptable.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const ts = require('typescript');
const Papa = require('papaparse');
const { PGlite } = require('@electric-sql/pglite');
process.env.DESKTOP_MODE = 'true';
process.env.TZ = 'Africa/Lagos';
const root = path.resolve(__dirname, '..');
const store = '00000000-0000-0000-0000-000000000001';
const user = { id: '00000000-0000-0000-0000-000000000002', store_id: store, role: 'owner' };
let activeDb;
let hook = null;
const results = [];
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(localRequire, mod, mod.exports);
  return mod.exports;
}
const routedQuery = async (sql, params) => {
  const run = () => activeDb.query(sql, params);
  return hook ? hook(sql, params, run) : run();
};
const routedDb = () => ({
  transaction: callback => activeDb.transaction(tx => callback({
    query: (sql, params) => hook ? hook(sql, params, () => tx.query(sql, params)) : tx.query(sql, params),
  })),
});
// Execute the actual desktop withConnection implementation, replacing only
// initialization/routing so it cannot open the user's persistent databases.
const dbModule = load('lib/db/index.ts', {
  './schema': {}, './test-mode': { isTestModeEnabled: () => false },
  './desktop-init': { desktopQuery: routedQuery, desktopTestQuery: routedQuery, getDesktopDb: async () => routedDb(), getDesktopTestDb: async () => routedDb() },
});
const auth = { getCurrentUser: async () => user, requireOwner: async () => user };
const mocks = { '@/lib/auth': auth, 'next/navigation': { redirect: () => { throw Error('unexpected redirect'); } }, '@/lib/db': dbModule,
  '@/lib/db/helpers': load('lib/db/helpers.ts'), '@/lib/sales-pricing': load('lib/sales-pricing.ts'),
  '@/lib/business-date': load('lib/business-date.ts') };
const sales = load('app/actions/sales.ts', mocks);
const analytics = load('app/actions/analytics.ts', mocks);
const exporter = load('lib/desktop-sales-export.ts');
async function fresh() {
  hook = null;
  if (activeDb) await activeDb.close();
  activeDb = new PGlite();
  await activeDb.exec(fs.readFileSync(path.join(root, 'scripts/desktop-schema.sql'), 'utf8'));
}
async function product(name, price, tracked = false) {
  const id = randomUUID();
  await activeDb.query('INSERT INTO products(id,store_id,sku,name,selling_price,track_inventory) VALUES($1,$2,$3,$4,$5,$6)', [id, store, id, name, price, tracked]);
  return id;
}
async function batch(id, qty, price, expiry = '2027-01-01') {
  return (await activeDb.query('INSERT INTO batches(store_id,product_id,qty_received,qty_remaining,selling_price_override,expiry_date) VALUES($1,$2,$3,$3,$4,$5) RETURNING id', [store, id, qty, price, expiry])).rows[0].id;
}
const cart = (id, qty = 1) => [{ productId: id, qtySold: qty }];
const checkout = async (items, request = randomUUID(), method = 'transfer', paid = 0, expected) => {
  if (expected === undefined) expected = Number(ok(await sales.getSaleQuote(items)).totalAmount);
  return sales.createSale(items, method, paid, request, expected);
};
function ok(result) { assert.equal(result.success, true, result.error); return result.data; }
async function check(name, fn) {
  if (process.env.AUDIT_FILTER && !new RegExp(process.env.AUDIT_FILTER).test(name)) return;
  try { const detail = await fn(); results.push({ name, status: 'PASS', detail }); console.log('PASS', name, JSON.stringify(detail)); }
  catch (err) { results.push({ name, status: 'FAIL', error: err.stack }); console.error('FAIL', name, err.stack); }
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function count() { return (await activeDb.query('SELECT COUNT(*)::int AS n, COALESCE(SUM(total_amount),0)::float AS total FROM sales')).rows[0]; }
function csvFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? csvFiles(path.join(dir,e.name)) : e.name.endsWith('.csv') ? [path.join(dir,e.name)] : []); }
function manifestFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? manifestFiles(path.join(dir,e.name)) : e.name.endsWith('.csv.manifest.json') ? [path.join(dir,e.name)] : []); }

(async () => {
  await check('CSV: all rows and transaction arithmetic; replay all baskets through actual createSale and reports', async () => {
    assert.ok(process.argv[2], 'CSV path is required');
    const parsed = Papa.parse(fs.readFileSync(process.argv[2], 'utf8'), { header: true, skipEmptyLines: true });
    assert.deepEqual(parsed.errors, []);
    const groups = new Map();
    for (const row of parsed.data) {
      assert.equal(Number(row.Quantity) * Number(row['Unit Price']), Number(row.Subtotal));
      const id = row['Transaction ID'];
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(row);
    }
    await fresh();
    const ids = new Map();
    for (const [receipt, rows] of groups) {
      assert.equal(rows.reduce((n,r) => n + Number(r.Subtotal), 0), Number(rows[0].Total));
      assert.equal(new Set(rows.map(r => [r.Date,r.Time,r.Total,r['Payment Method']].join('|'))).size, 1);
      const items = [];
      for (const r of rows) {
        const key = r.Product + '|' + r['Unit Price'];
        if (!ids.has(key)) ids.set(key, await product(r.Product, r['Unit Price']));
        items.push({ productId: ids.get(key), qtySold: Number(r.Quantity) });
      }
      const sale = ok(await checkout(items, receipt, rows[0]['Payment Method'], Number(rows[0].Total)));
      assert.equal(Number(sale.totalAmount), Number(rows[0].Total));
      await activeDb.query('UPDATE sales SET created_at=$1 WHERE id=$2', [`${rows[0].Date}T${rows[0].Time}+01:00`, sale.saleId]);
    }
    const expected = { '2026-09-07':90500, '2026-09-08':123450, '2026-09-09':229850, '2026-09-10':216300, '2026-09-11':16600 };
    for (const [date,total] of Object.entries(expected)) {
      for (const page of [1,2,6]) {
        const report = ok(await sales.getSales({ dateFrom:date,dateTo:date,page }));
        assert.equal(report.summary.totalRevenue,total);
        assert.equal(report.dayTotals[0].revenue,total);
      }
      assert.equal(ok(await analytics.getSalesAnalytics(date,date)).totalRevenue,total);
    }
    return { rows:parsed.data.length, transactions:groups.size, total:(await count()).total, daily:expected, caveat:'Products reconstructed per name/price as untracked; source CSV has no product/batch UUIDs.' };
  });
  await check('Sequential retry is idempotent; new request allows identical legitimate basket', async () => {
    await fresh(); const id = await product('Shawarma',3000); const request = randomUUID();
    const a = ok(await checkout(cart(id,4),request)); const b = ok(await checkout(cart(id,4),request));
    assert.equal(a.saleId,b.saleId); ok(await checkout(cart(id,4)));
    assert.deepEqual(await count(), {n:2,total:24000}); return await count();
  });
  await check('Committed checkout can be recovered by client request ID', async () => {
    await fresh(); const id = await product('Shawarma', 3000); const request = randomUUID();
    const sale = ok(await checkout(cart(id), request));
    const recovered = ok(await sales.getSaleByRequestId(request));
    assert.equal(recovered.saleId, sale.saleId);
    assert.equal(ok(await sales.getSaleByRequestId(randomUUID())), null);
    return { requestId: request, saleId: recovered.saleId, missingRequestSafe: true };
  });
  await check('Single failed checkout rolls back; stored history survives price changes', async () => {
    await fresh(); const id=await product('Ice Cream 1 Scoop',1000);
    assert.equal((await checkout(cart(id),randomUUID(),'cash',500)).success,false);
    assert.equal((await count()).n,0);
    const a=ok(await checkout(cart(id)));
    await activeDb.query('UPDATE products SET selling_price=2000 WHERE id=$1',[id]);
    assert.equal(Number(ok(await sales.getSaleById(a.saleId)).total_amount),1000);
    return { failedCashSaved:false, historicalTotal:1000 };
  });
  await check('Control: concurrent successful and failed checkouts remain independent', async () => {
    await fresh(); const id=await product('Shawarma',3000);
    const successful = checkout(cart(id,4), randomUUID(), 'transfer', 0, 12000);
    const failed = checkout(cart(id), randomUUID(), 'cash', 1, 3000);
    const [a,b] = await Promise.all([successful, failed]);
    assert.equal(a.success, true); assert.equal(b.success, false);
    assert.deepEqual(await count(), {n:1,total:12000});
    return {successful:12000, failedPersisted:false, persisted:await count()};
  });
  await check('Control: failed item write leaves no header, items, or stock mutation', async () => {
    await fresh(); const id=await product('Shawarma',3000);
    hook=async (sql,p,run) => {
      if (sql.includes('INSERT INTO sale_items')) throw Error('injected item-write failure');
      return run();
    };
    const failed=await checkout(cart(id,4), randomUUID(), 'transfer', 0, 12000); hook=null;
    assert.equal(failed.success,false); assert.deepEqual(await count(),{n:0,total:0});
    const orphanHeaders=(await activeDb.query('SELECT COUNT(*)::int AS n FROM sales s WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id=s.id)')).rows[0].n;
    assert.equal(orphanHeaders,0);
    return {failedCheckoutSaved:false, orphanHeaders};
  });
  await check('Control: quantity-aware quote matches mixed-price checkout', async () => {
    await fresh(); const id=await product('PS5',2000,true);
    await batch(id,1,1000,'2027-01-01'); await batch(id,20,2000,'2027-02-01');
    const preview=ok(await sales.getEffectiveUnitPrices([id]))[id]*12;
    const quoted=Number(ok(await sales.getSaleQuote(cart(id,12))).totalAmount);
    const actual=Number(ok(await checkout(cart(id,12))).totalAmount);
    assert.equal(preview,12000); assert.equal(quoted,23000); assert.equal(actual,23000);
    return { singlePricePreview:preview,quoted,actual };
  });
  await check('Control: untracked product quote ignores leftover batch prices', async () => {
    await fresh(); const id=await product('PS4',600,false); await batch(id,20,1200);
    const preview=ok(await sales.getEffectiveUnitPrices([id]))[id]*20;
    const actual=Number(ok(await checkout(cart(id,20))).totalAmount);
    const quoted=Number(ok(await sales.getSaleQuote(cart(id,20))).totalAmount);
    assert.equal(preview,12000); assert.equal(actual,12000); assert.equal(quoted,12000); return {preview,quoted,actual};
  });
  await check('Control: duplicate product entries are normalized and cannot oversell', async () => {
    await fresh(); const id=await product('Ice Cream 1 Scoop',1000,true); const bid=await batch(id,8,1000);
    const result=await sales.createSale([...cart(id,8),...cart(id,8)], 'transfer', 0, randomUUID(), 16000); assert.equal(result.success,false);
    const left=(await activeDb.query('SELECT qty_remaining FROM batches WHERE id=$1',[bid])).rows[0].qty_remaining;
    assert.equal(left,8); return {rejected:true,qtyRemaining:left};
  });
  await check('Control: explicit Lagos day boundaries survive a UTC database session', async () => {
    await fresh(); const timezone=(await activeDb.query('SHOW TIMEZONE')).rows[0];
    const id=await product('Ice Cream 1 Scoop',1000); const a=ok(await checkout(cart(id,12)));
    await activeDb.query('UPDATE sales SET created_at=$1 WHERE id=$2',['2026-09-08T00:30:00+01:00',a.saleId]);
    assert.equal(ok(await sales.getSales({dateFrom:'2026-09-08',dateTo:'2026-09-08'})).summary.totalRevenue,12000);
    await activeDb.query("SET TIMEZONE='UTC'");
    const d7=ok(await sales.getSales({dateFrom:'2026-09-07',dateTo:'2026-09-07'}));
    const d8=ok(await sales.getSales({dateFrom:'2026-09-08',dateTo:'2026-09-08'}));
    assert.equal(d7.summary.totalRevenue,0); assert.equal(d8.summary.totalRevenue,12000);
    return {defaultTimezone:timezone,forcedTimezone:'UTC',lagosSaleDate:'2026-09-08',reportedDate:'2026-09-08',amount:12000};
  });
  await check('Control: native PGlite transactions isolate successful checkout from queued rollback', async () => {
    await fresh(); const entered=deferred(), release=deferred();
    const a=activeDb.transaction(async tx=>{
      await tx.query('INSERT INTO sales(store_id,receipt_number,total_amount) VALUES($1,$2,12000)',[store,'control']);
      entered.resolve(); await release.promise;
    });
    await entered.promise;
    const b=activeDb.transaction(async ()=>{throw Error('expected rollback');}).catch(e=>e.message);
    release.resolve(); await a; assert.equal(await b,'expected rollback');
    assert.deepEqual(await count(),{n:1,total:12000}); return await count();
  });
  await check('Control: business date stays correct before 01:00 Lagos',async()=>{
    const instant=new Date('2026-09-08T00:30:00+01:00');
    const chosen=load('lib/business-date.ts').businessDate(instant);
    assert.equal(chosen,'2026-09-08');
    return {localDate:'2026-09-08',dashboardDate:chosen,caveat:'Date helper reproduction; not a rendered dashboard test.'};
  });
  await check('Control: failed checkout is not exported', async () => {
    await fresh(); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trova-sales-audit-'));
    process.env.TROVA_DOCUMENTS_DIR=path.join(dir,'Documents');
    const id=await product('Shawarma',3000);
    hook=async (sql,p,run)=>{
      if(sql.includes('INSERT INTO sale_items')) throw Error('injected failure before item insert');
      return run();
    };
    const failed=await checkout(cart(id,4), randomUUID(), 'transfer', 0, 12000); hook=null;
    const exported=await exporter.runDesktopSalesExportNow(activeDb,dir,store,new Date(Date.now()+60000));
    assert.equal(exported.success,true); assert.equal(failed.success,false); assert.equal((await count()).total,0);
    return {failedExported:false, databaseRevenue:0, artifacts:csvFiles(dir).length};
  });
  await check('Control: repeated same-day close exports preserve distinct windows', async () => {
    await fresh(); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trova-sales-audit-'));
    process.env.TROVA_DOCUMENTS_DIR=path.join(dir,'Documents');
    const id=await product('Shawarma',3000);
    const a=ok(await checkout(cart(id,4)));
    await activeDb.query('UPDATE sales SET created_at=$1 WHERE id=$2',['2026-09-07T12:00:00+01:00',a.saleId]);
    assert.equal((await exporter.runDesktopSalesExportNow(activeDb,dir,store,new Date('2026-09-07T13:00:00+01:00'))).success,true);
    const first=csvFiles(dir)[0]; assert.ok(fs.readFileSync(first,'utf8').includes(a.receiptNumber));
    const b=ok(await checkout(cart(id)));
    await activeDb.query('UPDATE sales SET created_at=$1 WHERE id=$2',['2026-09-07T14:00:00+01:00',b.saleId]);
    assert.equal((await exporter.runDesktopSalesExportNow(activeDb,dir,store,new Date('2026-09-07T15:00:00+01:00'))).success,true);
    assert.equal(csvFiles(dir).length,2); assert.equal(manifestFiles(dir).length,2);
    const manifest=JSON.parse(fs.readFileSync(manifestFiles(dir)[0],'utf8'));
    assert.equal(manifest.version,1); assert.equal(manifest.storeId,store); assert.ok(manifest.receipts.includes(a.receiptNumber));
    const content=fs.readFileSync(first,'utf8');
    assert.equal(manifest.sha256,createHash('sha256').update(content,'utf8').digest('hex'));
    assert.ok(content.includes(a.receiptNumber));
    const coverage=await exporter.verifySalesArchiveCoverage(activeDb,dir,store,new Date('2026-09-08T00:00:00+01:00'));
    assert.deepEqual(coverage,{covered:true,missing:0});
    fs.writeFileSync(first,content+'tampered');
    const tamperedCoverage=await exporter.verifySalesArchiveCoverage(activeDb,dir,store,new Date('2026-09-08T00:00:00+01:00'));
    assert.equal(tamperedCoverage.covered,false); assert.equal(tamperedCoverage.missing,1);
    fs.writeFileSync(first,content);
    return { databaseRevenue:(await count()).total, preservedFirst:true, manifestHashVerified:true, tamperDetected:true, coverage, artifacts:csvFiles(dir) };
  });
  await check('Void preserves audit history, excludes revenue, and restores exact tracked stock', async () => {
    await fresh(); const id=await product('Shawarma',3000,true); const bid=await batch(id,8,3000);
    const a=ok(await checkout(cart(id,4))); ok(await sales.voidSale(a.saleId,`VOID ${a.receiptNumber}`,'Customer return'));
    assert.equal((await count()).n,1);
    assert.ok((await activeDb.query('SELECT voided_at FROM sales WHERE id=$1',[a.saleId])).rows[0].voided_at);
    assert.equal(ok(await sales.getSales({dateFrom:'2026-09-11',dateTo:'2026-09-11'})).summary.totalRevenue,0);
    assert.equal((await activeDb.query('SELECT qty_remaining FROM batches WHERE id=$1',[bid])).rows[0].qty_remaining,8);
    return { preservedAuditHistory:true, excludedRevenue:12000,stockRestored:true };
  });
  if(activeDb) await activeDb.close();
  console.log('AUDIT_RESULTS',JSON.stringify(results,null,2));
  process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
})().catch(err=>{console.error(err);process.exitCode=1;});
