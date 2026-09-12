import{t as O,E as j}from"./jspdf.es.min-BD8BanxK.js";function K(t){const m=Number(t.subtotal)||0,e=Number(t.discount_percent)||0,o=+(m*(e/100)).toFixed(2),r=+(m-o).toFixed(2),b=Number(t.tax_rate)||0,l=Number(t.tax2_rate)||0,c=t.tax_mode||"single";let n=0,u=0;if(c==="single")n=+(r*(b/100)).toFixed(2);else if(c==="dual_split")n=+(r*(b/100)).toFixed(2),u=+(r*(l/100)).toFixed(2);else if(c==="compound")n=+(r*(b/100)).toFixed(2),u=+((r+n)*(l/100)).toFixed(2);else if(c==="per_line"){let w=0,f=0;for(const g of t.lineItems||[]){const d=Number(g.total??g.quantity*g.unit_price)||0,s=m>0?d*(1-e/100):0;w+=s*((Number(g.tax1_rate)||0)/100),f+=s*((Number(g.tax2_rate)||0)/100)}n=+w.toFixed(2),u=+f.toFixed(2)}const v=+(r+n+u).toFixed(2);return{subtotal:m,discount_amount:o,taxableBase:r,tax_amount:n,tax2_amount:u,total:v}}function U(t,m="USD"){try{return new Intl.NumberFormat(void 0,{style:"currency",currency:m||"USD"}).format(Number(t)||0)}catch{return`${m} ${(Number(t)||0).toFixed(2)}`}}const a=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),X={estimate:"ESTIMATE",invoice:"INVOICE",receipt:"RECEIPT"};async function P(t){var M,A,F,N,H,E,T,B,C,z;const m=t.currency||"USD",e=i=>U(Number(i)||0,m),o=((M=t.branding)==null?void 0:M.primaryColor)||"#0f172a",r=((A=t.branding)==null?void 0:A.accentColor)||"#2563eb",b=((F=t.branding)==null?void 0:F.companyName)||((N=t.from)==null?void 0:N.name)||"",l=((H=t.branding)==null?void 0:H.footerText)||"",c=((E=t.branding)==null?void 0:E.logoUrl)||"",n=X[t.kind],u=t.issued_at?new Date(t.issued_at).toLocaleDateString():"",v=t.due_date?new Date(t.due_date).toLocaleDateString():"",w=t.paid_at?new Date(t.paid_at).toLocaleDateString():"",f=(t.lineItems||[]).filter(i=>(i.description||"").trim()).map((i,p)=>{const $=Number(i.quantity)||0,k=Number(i.unit_price)||0,L=Number(i.total??$*k)||0,_=[];return(t.tax_mode||"single")==="per_line"&&(i.tax1_rate&&_.push(`${t.tax1_label||"Tax"} ${i.tax1_rate}%`),i.tax2_rate&&_.push(`${t.tax2_label||"Tax 2"} ${i.tax2_rate}%`)),`<tr>
        <td class="num">${p+1}</td>
        <td class="desc">${a(i.description)}${_.length?`<div class="tax-tags">${_.map(a).join(" • ")}</div>`:""}</td>
        <td class="right">${$}${i.unit?` <span style="color:#666;font-size:0.85em">${a(String(i.unit))}</span>`:""}</td>
        <td class="right">${e(k)}</td>
        <td class="right">${e(L)}</td>
      </tr>`}).join(""),g=[];if(g.push(`<tr><td>Subtotal</td><td class="right">${e(t.subtotal)}</td></tr>`),(Number(t.discount_amount)||0)>0&&g.push(`<tr><td>Discount${t.discount_percent?` (${t.discount_percent}%)`:""}</td><td class="right">-${e(t.discount_amount)}</td></tr>`),(Number(t.tax_amount)||0)>0&&g.push(`<tr><td>${a(t.tax1_label||"Tax")}${t.tax_rate?` (${t.tax_rate}%)`:""}</td><td class="right">${e(t.tax_amount)}</td></tr>`),(Number(t.tax2_amount)||0)>0){const i=t.tax_mode==="compound"?" · compound":"";g.push(`<tr><td>${a(t.tax2_label||"Tax 2")}${t.tax2_rate?` (${t.tax2_rate}%)`:""}${i}</td><td class="right">${e(t.tax2_amount)}</td></tr>`)}g.push(`<tr class="grand"><td>Total</td><td class="right">${e(t.total)}</td></tr>`),(t.kind==="invoice"||t.kind==="receipt")&&((Number(t.amount_paid)||0)>0&&g.push(`<tr><td>Amount Paid</td><td class="right">-${e(t.amount_paid)}</td></tr>`),t.kind==="invoice"&&(Number(t.balance_due)||0)>0&&g.push(`<tr class="balance"><td>Balance Due</td><td class="right">${e(t.balance_due)}</td></tr>`));const d=i=>i.filter(([,p])=>p!=null&&p!==""&&Number(p)>0),s=t.dispatch?d([["T&M (call-out)",t.dispatch.nbd_tm],["Hourly",t.dispatch.hourly],["Half Day",t.dispatch.half_day],["Full Day",t.dispatch.full_day]]):[],x=t.dispatch?d([["T&M (call-out)",t.dispatch.sbd_tm],["Hourly",t.dispatch.sbd_hourly],["Half Day",t.dispatch.sbd_half_day],["Full Day",t.dispatch.sbd_full_day]]):[],y=(i,p)=>p.length?`<div class="dispatch-sub">
        <div class="dispatch-sub-title">${a(i)}</div>
        <table class="mini"><thead><tr><th>Service</th><th class="right">Rate</th></tr></thead>
          <tbody>${p.map(([$,k])=>`<tr><td>${a($)}</td><td class="right">${e(k)}</td></tr>`).join("")}</tbody>
        </table>
      </div>`:"",D=s.length||x.length||(T=t.dispatch)!=null&&T.remarks?`<div class="block">
        <div class="block-title">Dispatch Pricing</div>
        ${y("NBD (Next Business Day)",s)}
        ${y("SBD (Same Business Day)",x)}
        ${(B=t.dispatch)!=null&&B.remarks?`<div class="muted pre">${a(t.dispatch.remarks)}</div>`:""}
      </div>`:"",S=(i,p)=>p?`
    <div class="party">
      <div class="party-label">${a(i)}</div>
      ${p.name?`<div class="party-name">${a(p.name)}</div>`:""}
      ${p.address?`<div class="muted pre">${a(p.address)}</div>`:""}
      ${p.email?`<div class="muted">${a(p.email)}</div>`:""}
      ${p.phone?`<div class="muted">${a(p.phone)}</div>`:""}
    </div>`:"",R=t.status?`<span class="badge">${a(String(t.status).toUpperCase())}</span>`:"",q=t.linkedRef?`<div class="muted small">From ${a(t.linkedRef.kind)} ${a(t.linkedRef.number)}</div>`:"",I=t.kind==="receipt"?`
    <div class="block payment">
      <div class="block-title">Payment Details</div>
      <table class="mini">
        ${w?`<tr><td>Paid On</td><td class="right">${a(w)}</td></tr>`:""}
        ${t.payment_method?`<tr><td>Method</td><td class="right">${a(t.payment_method)}</td></tr>`:""}
        ${t.payment_reference?`<tr><td>Reference</td><td class="right">${a(t.payment_reference)}</td></tr>`:""}
        <tr class="grand"><td>Amount</td><td class="right">${e(t.amount_paid??t.total)}</td></tr>
      </table>
    </div>`:"",h=t.payment_details,W=t.kind==="invoice"&&h&&(h.account_name||h.iban||h.swift_bic||h.bank_name_address)?`
        <div class="block bank-details">
          <div class="block-title">Payment Details</div>

          <table class="mini">
            ${h.account_name?`<tr>
                    <td>Account Name</td>
                    <td class="right">${a(h.account_name)}</td>
                  </tr>`:""}

            ${h.iban?`<tr>
                    <td>IBAN</td>
                    <td class="right">${a(h.iban)}</td>
                  </tr>`:""}

            ${h.swift_bic?`<tr>
                    <td>Swift / BIC</td>
                    <td class="right">${a(h.swift_bic)}</td>
                  </tr>`:""}

            ${h.bank_name_address?`<tr>
                    <td>Bank Name and Address</td>
                    <td class="right pre">${a(h.bank_name_address)}</td>
                  </tr>`:""}
          </table>
        </div>
      `:"";return`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${n} ${a(t.number||"")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
  .page { max-width: 820px; margin: 24px auto; padding: 40px 44px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 3px solid ${o}; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { max-height: 56px; max-width: 200px; object-fit: contain; }
  .company { font-size: 18px; font-weight: 700; color: ${o}; line-height: 1.2; }
  .doc-meta { text-align: right; }
  .doc-label { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: ${o}; margin: 0; }
  .doc-num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; font-size: 13px; margin-top: 2px; }
  .badge { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px; background: ${r}1A; color: ${r}; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 18px; margin: 14px 0 4px; font-size: 12px; }
  .meta-grid .label { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; }
  .meta-grid .value { color: #0f172a; font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 22px 0 8px; }
  .party-label { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; margin-bottom: 4px; }
  .party-name { font-weight: 700; color: #0f172a; font-size: 14px; }
  .muted { color: #64748b; font-size: 12px; }
  .small { font-size: 11px; }
  .pre { white-space: pre-wrap; }
  .title { margin: 18px 0 6px; font-size: 16px; font-weight: 700; color: ${o}; }
  .lines-wrap { width: 100%; overflow: hidden; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; table-layout: fixed; }
  table.lines col.c-num { width: 28px; }
  table.lines col.c-desc { width: auto; }
  table.lines col.c-qty { width: 60px; }
  table.lines col.c-rate { width: 95px; }
  table.lines col.c-amt { width: 110px; }
  table.lines thead th { text-align: left; padding: 10px 12px; background: ${o}; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  table.lines thead th.right { text-align: right; }
  table.lines tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; line-height: 1.4; }
  table.lines tbody td.right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.lines tbody td.num { color: #94a3b8; width: 28px; }
  table.lines tbody td.desc { white-space: normal; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; -webkit-hyphens: auto; max-width: 0; }
  .tax-tags { font-size: 11px; color: #64748b; margin-top: 2px; }
  .totals-row { margin-top: 16px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
  .totals { display: flex; justify-content: flex-end; }
  table.totals-tbl { min-width: 280px; border-collapse: collapse; font-size: 13px; }
  table.totals-tbl td { padding: 6px 10px; }
  table.totals-tbl td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.totals-tbl tr.grand td { border-top: 2px solid ${o}; font-weight: 800; font-size: 15px; padding-top: 10px; color: ${o}; }
  table.totals-tbl tr.balance td { background: ${r}10; color: ${r}; font-weight: 800; }
  .block { margin-top: 22px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .block.payment { background: ${r}0d; border-color: ${r}40; }
  .block-title { font-size: 12px; font-weight: 700; color: ${o}; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.mini td { padding: 4px 0; }
  table.mini td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.mini tr.grand td { border-top: 1px solid #cbd5e1; padding-top: 6px; font-weight: 700; }
  table.mini th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
  table.mini th.right { text-align: right; }
  .dispatch-sub { margin-top: 8px; }
  .dispatch-sub-title { font-size: 11px; font-weight: 700; color: ${r}; margin-bottom: 4px; }
  .notes { margin-top: 18px; padding: 12px 14px; background: #f1f5f9; border-left: 3px solid ${r}; border-radius: 4px; font-size: 12px; white-space: pre-wrap; }
  .signature { margin-top: 22px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
  .signature img { max-height: 80px; max-width: 240px; }
  .bank-details .pre {
    white-space: pre-wrap;
  }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
  table.lines thead { display: table-header-group; }
  table.lines tfoot { display: table-footer-group; }
  table.lines tr { page-break-inside: avoid; break-inside: avoid; }
  table.lines tbody td { orphans: 3; widows: 3; }
  .block, .notes, .signature, .totals-row, .party, table.totals-tbl, table.totals-tbl tr, table.totals-tbl tbody, .footer { page-break-inside: avoid; break-inside: avoid; }
  .header { page-break-after: avoid; break-after: avoid; }
  h1, h2, h3, .title, .block-title { page-break-after: avoid; break-after: avoid; }
  /* Keep totals + payment terms grouped with at least the previous content */
  .totals-row { page-break-before: auto; break-before: auto; page-break-inside: avoid; break-inside: avoid; }
  .signature { page-break-before: auto; break-before: auto; page-break-inside: avoid; break-inside: avoid; }
  @page { size: A4; margin: 14mm 12mm; }
  @media print {
    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; }
    .page { box-shadow: none; margin: 0; padding: 0; max-width: 100%; width: 100%; }
    a { color: inherit; text-decoration: none; }
    /* Force a clean break if a row would be cut — browsers honor avoid on tr above. */
    table.lines { page-break-inside: auto; break-inside: auto; }
    table.lines tbody { page-break-inside: auto; break-inside: auto; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="brand">
      ${c?`<img src="${a(c)}" alt="logo"/>`:""}
      <div>
        ${b?`<div class="company">${a(b)}</div>`:""}
        ${(C=t.from)!=null&&C.address?`<div class="muted pre">${a(t.from.address)}</div>`:""}
        ${(z=t.from)!=null&&z.email?`<div class="muted small">${a(t.from.email)}</div>`:""}
      </div>
    </div>
    <div class="doc-meta">
      <p class="doc-label">${n}</p>
      ${t.number?`<div class="doc-num">${a(t.number)}</div>`:""}
      ${R}
      ${q}
    </div>
  </div>

  <div class="meta-grid">
    ${u?`<div><div class="label">Issued</div><div class="value">${a(u)}</div></div>`:""}
    ${v?`<div><div class="label">${t.kind==="estimate"?"Valid Until":"Due"}</div><div class="value">${a(v)}</div></div>`:""}
    ${w&&t.kind!=="receipt"?`<div><div class="label">Paid</div><div class="value">${a(w)}</div></div>`:""}
    ${t.purchase_order_number?`<div><div class="label">PO Number</div><div class="value">${a(t.purchase_order_number)}</div></div>`:""}
    ${t.title?`<div><div class="label">Reference</div><div class="value">${a(t.title)}</div></div>`:""}
  </div>

  <div class="parties">
    ${S("From",t.from)}
    ${S(t.kind==="receipt"?"Received From":"Bill To",t.to)}
  </div>

  ${f?`
  <div class="lines-wrap">
  <table class="lines">
    <colgroup><col class="c-num"/><col class="c-desc"/><col class="c-qty"/><col class="c-rate"/><col class="c-amt"/></colgroup>
    <thead><tr>
      <th>#</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th>
    </tr></thead>
    <tbody>${f}</tbody>
  </table>
  </div>`:""}
    <div class="totals-row">
    <div></div>

    <div class="totals">
      <table class="totals-tbl">${g.join("")}</table>
    </div>
  </div>

  ${W}
  ${I}

  ${D}
  ${t.payment_terms?`<div class="notes"><strong>Payment Terms</strong><br/>${a(t.payment_terms)}</div>`:""}
  ${t.notes?`<div class="notes"><strong>Notes</strong><br/>${a(t.notes)}</div>`:""}
  ${t.signature_data?`<div class="signature"><div class="muted small">Signed${t.signed_at?" on "+new Date(t.signed_at).toLocaleString():""}${t.signed_by?" by "+a(t.signed_by):""}</div><img src="${a(t.signature_data)}" alt="signature"/></div>`:""}
  ${l?`<div class="footer">${a(l)}</div>`:'<div class="footer">This document was generated electronically.</div>'}
</div>
<script>
(function(){
  // A4 printable area at 96dpi with 14mm/12mm margins ≈ 703 x 1056 px.
  // These are conservative fallbacks; actual values are measured at runtime
  // from the document's CSS environment via a 1mm probe.
  var MAX_W = 703;
  var MAX_H = 1056;

  // Measure real px-per-mm and derive printable height from the @page rule
  // (size: A4; margin: 14mm 12mm). This avoids drift between the constant
  // and the browser's actual layout, which is what produced blank bands.
  function getPageMetrics(){
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:100mm;width:100mm;';
    document.body.appendChild(probe);
    var pxPerMm = probe.getBoundingClientRect().height / 100;
    probe.parentNode.removeChild(probe);
    if (!isFinite(pxPerMm) || pxPerMm <= 0) pxPerMm = 96 / 25.4;
    var pageH = 297 * pxPerMm;
    var pageW = 210 * pxPerMm;
    var marginV = 14 * pxPerMm;
    var marginH = 12 * pxPerMm;
    var contentH = pageH - 2 * marginV;
    var contentW = pageW - 2 * marginH;
    return { pxPerMm: pxPerMm, pageH: pageH, contentH: contentH, contentW: contentW, marginV: marginV };
  }

  // Legibility floor: never shrink below 80% of base (≈10.4px on 13px base).
  // Once the floor is reached, allow wrapping inside line cells so content keeps
  // fitting horizontally without becoming too small to read.
  var MIN_SCALE = 0.8;
  function fitWidth(page){
    var scale = 1;
    var iter = 0;
    var hitFloor = false;
    while (iter++ < 14) {
      var overflow = false;
      var tables = page.querySelectorAll('table.lines, table.totals-tbl');
      for (var i=0;i<tables.length;i++){
        if (tables[i].scrollWidth > tables[i].clientWidth + 1) { overflow = true; break; }
      }
      if (!overflow && page.scrollWidth <= MAX_W + 4) break;
      if (scale - 0.05 < MIN_SCALE) { hitFloor = true; break; }
      scale -= 0.05;
      page.style.fontSize = (scale * 100).toFixed(1) + '%';
      var cells = page.querySelectorAll('table.lines th, table.lines td');
      for (var j=0;j<cells.length;j++){ cells[j].style.padding = (8*scale).toFixed(1)+'px '+(10*scale).toFixed(1)+'px'; }
    }
    if (hitFloor) {
      // Pin to the minimum readable scale and let description cells wrap cleanly
      // instead of shrinking text further. Numeric cells stay on a single line.
      scale = MIN_SCALE;
      page.style.fontSize = (scale * 100).toFixed(1) + '%';
      var cells2 = page.querySelectorAll('table.lines th, table.lines td');
      for (var k=0;k<cells2.length;k++){
        cells2[k].style.padding = (8*scale).toFixed(1)+'px '+(10*scale).toFixed(1)+'px';
      }
      var descCells = page.querySelectorAll('table.lines td.desc');
      for (var d=0;d<descCells.length;d++){
        var dc = descCells[d];
        dc.style.whiteSpace = 'normal';
        dc.style.wordBreak = 'break-word';
        dc.style.overflowWrap = 'anywhere';
        dc.style.hyphens = 'auto';
        dc.style.webkitHyphens = 'auto';
        dc.style.lineHeight = '1.35';
      }
    }
    return scale;
  }

  // Insert explicit page-break spacers before any line-row that would cross a page boundary.
  function paginateRows(page, metrics){
    var rows = page.querySelectorAll('table.lines tbody tr');
    if (!rows.length) return;
    page.querySelectorAll('.pb-spacer').forEach(function(n){ n.remove(); });
    var pageTop = page.getBoundingClientRect().top;
    var contentH = metrics.contentH;
    // Bottom safety margin scales with px-per-mm so it stays ~2mm regardless of DPI.
    var safety = Math.max(4, metrics.pxPerMm * 2);
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var rect = r.getBoundingClientRect();
      var topOnPage = ((rect.top - pageTop) % contentH + contentH) % contentH;
      var bottomOnPage = topOnPage + rect.height;
      if (bottomOnPage > contentH - safety) {
        var remaining = contentH - topOnPage;
        // Cap to remaining space (no extra padding) so we never produce a
        // visible blank band larger than the actual gap to the page edge.
        var h = Math.max(0, remaining - 1);
        var spacer = document.createElement('tr');
        spacer.className = 'pb-spacer';
        var td = document.createElement('td');
        td.colSpan = 5;
        td.style.padding = '0';
        td.style.border = '0';
        td.style.height = h + 'px';
        td.style.pageBreakAfter = 'always';
        td.style.breakAfter = 'page';
        spacer.appendChild(td);
        r.parentNode.insertBefore(spacer, r);
      }
    }
  }

  // Push atomic blocks (totals row, signature, footer) onto a fresh page if they
  // would otherwise straddle a page boundary. Spacer height is the *exact*
  // remaining space on the current page (measured, not constant-based) so we
  // don't introduce blank bands on the next page.
  function paginateBlocks(page, metrics){
    page.querySelectorAll('.pb-block-spacer').forEach(function(n){ n.remove(); });
    var pageTop = page.getBoundingClientRect().top;
    var contentH = metrics.contentH;
    var safety = Math.max(4, metrics.pxPerMm * 2);
    var selectors = ['.totals-row', '.signature', '.footer', '.notes'];
    for (var s=0;s<selectors.length;s++){
      var blocks = page.querySelectorAll(selectors[s]);
      for (var i=0;i<blocks.length;i++){
        var el = blocks[i];
        // Skip blocks that already follow a forced break (no measurable gap).
        var rect = el.getBoundingClientRect();
        var topOnPage = ((rect.top - pageTop) % contentH + contentH) % contentH;
        var bottomOnPage = topOnPage + rect.height;
        // Only intervene if the block fits on its own page AND currently straddles.
        if (rect.height < contentH - safety && bottomOnPage > contentH - safety) {
          var remaining = contentH - topOnPage;
          var h = Math.max(0, remaining - 1);
          var spacer = document.createElement('div');
          spacer.className = 'pb-block-spacer';
          spacer.style.height = h + 'px';
          spacer.style.margin = '0';
          spacer.style.padding = '0';
          spacer.style.pageBreakAfter = 'always';
          spacer.style.breakAfter = 'page';
          el.parentNode.insertBefore(spacer, el);
        }
      }
    }
  }

  function run(){
    var page = document.querySelector('.page');
    if (!page) return;
    var metrics = getPageMetrics();
    // Keep MAX_W/MAX_H in sync with measured values for fitWidth's loop.
    MAX_W = metrics.contentW;
    MAX_H = metrics.contentH;
    fitWidth(page);
    requestAnimationFrame(function(){
      paginateRows(page, metrics);
      requestAnimationFrame(function(){ paginateBlocks(page, metrics); });
    });
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
  window.addEventListener('beforeprint', run);
  window.addEventListener('resize', run);
})();
<\/script>

</body></html>`}async function Y(t){const m=await P(t),e=document.createElement("iframe");e.style.position="fixed",e.style.left="-10000px",e.style.top="0",e.style.width="820px",e.style.height="1200px",e.style.border="0",e.style.visibility="hidden",document.body.appendChild(e);try{await new Promise((d,s)=>{const x=window.setTimeout(()=>{s(new Error("PDF render timed out"))},2e4);e.onload=()=>{window.clearTimeout(x),d()},e.onerror=()=>{window.clearTimeout(x),s(new Error("PDF iframe failed to load"))},e.srcdoc=m});const o=e.contentDocument;if(!o)throw new Error("Could not access PDF document");const r=Array.from(o.images);await Promise.all(r.map(d=>new Promise(s=>{if(d.complete){s();return}d.onload=()=>s(),d.onerror=()=>s()}))),await new Promise(d=>requestAnimationFrame(()=>requestAnimationFrame(()=>d())));const b=o.querySelector(".page");if(!b)throw new Error("Invoice page could not be rendered");const l=await O(b,{pixelRatio:2,backgroundColor:"#ffffff",cacheBust:!0}),c=new j({orientation:"portrait",unit:"mm",format:"a4",compress:!0}),n=210,u=297,v=l.width/n,w=Math.floor(u*v);let f=0,g=0;for(;f<l.height;){const d=Math.min(w,l.height-f),s=document.createElement("canvas");s.width=l.width,s.height=d;const x=s.getContext("2d");if(!x)throw new Error("Could not create PDF canvas");x.fillStyle="#ffffff",x.fillRect(0,0,s.width,s.height),x.drawImage(l,0,f,l.width,d,0,0,l.width,d);const y=s.toDataURL("image/jpeg",.92);g>0&&c.addPage();const D=d/v;c.addImage(y,"JPEG",0,0,n,D,void 0,"FAST"),f+=d,g+=1}return c.output("blob")}finally{setTimeout(()=>e.remove(),1e3)}}async function G(t){const m=await P(t),e=window.open("","_blank");if(!e)throw new Error("Popup blocked — allow popups for this site to open the PDF preview.");return e.document.write(m),e.document.close(),e.onload=()=>e.print(),!0}async function J(t){if(!(t!=null&&t.length))throw new Error("No documents to print.");const m=await Promise.all(t.map(n=>P(n))),e=new DOMParser,o=[],r=[];m.forEach(n=>{const u=e.parseFromString(n,"text/html");u.querySelectorAll("style").forEach(v=>o.push(v.innerHTML)),r.push(u.body.innerHTML)});const b=Array.from(new Set(o)).join(`
`),l=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoices (${t.length})</title>
<style>${b}
.doc-break { page-break-after: always; break-after: page; }
.doc-break:last-child { page-break-after: auto; break-after: auto; }
</style></head><body>${r.map(n=>`<div class="doc-break">${n}</div>`).join("")}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});<\/script>
</body></html>`,c=window.open("","_blank");if(!c)throw new Error("Popup blocked — allow popups for this site to print.");return c.document.write(l),c.document.close(),!0}async function Q(t,m){let e;try{e=await P(t)}catch(r){throw new Error(`Could not build document: ${(r==null?void 0:r.message)||r}`)}const o=document.createElement("iframe");o.style.position="fixed",o.style.right="0",o.style.bottom="0",o.style.width="0",o.style.height="0",o.style.border="0",document.body.appendChild(o);try{await new Promise((b,l)=>{const c=setTimeout(()=>l(new Error("PDF render timed out")),15e3);o.onload=()=>{clearTimeout(c),b()},o.onerror=()=>{clearTimeout(c),l(new Error("PDF iframe failed to load"))},o.srcdoc=e});const r=o.contentWindow;if(!r)throw new Error("PDF preview window unavailable (browser blocked it).");r.document.title=m.replace(/\.pdf$/i,""),r.focus(),r.print()}finally{setTimeout(()=>o.remove(),1500)}}export{J as a,P as b,K as c,Q as d,U as f,Y as g,G as o};
