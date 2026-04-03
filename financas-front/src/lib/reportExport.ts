import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, Category, BankAccount } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: Date) {
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

function catName(tx: Transaction, cats: Category[]) {
  return cats.find(c => c.id === tx.category)?.name ?? 'Outros';
}

function accName(tx: Transaction, accs: BankAccount[]) {
  return accs.find(a => a.id === tx.accountId)?.name ?? '-';
}

function payLabel(method?: string) {
  if (method === 'credit') return 'Crédito';
  if (method === 'debit') return 'Débito';
  return '-';
}

// ─── tipos ────────────────────────────────────────────────────────────────────

export type ReportFormat = 'xlsx' | 'csv' | 'pdf';

export type ReportType =
  | 'transactions'   // extrato completo
  | 'monthly'        // DRE mensal (receitas vs despesas + saldo)
  | 'categories'     // gasto por categoria com % e orçamento
  | 'cashflow';      // fluxo de caixa mensal agrupado por mês

// ─── 1. EXTRATO DE TRANSAÇÕES ─────────────────────────────────────────────────

function buildTransactionRows(txs: Transaction[], cats: Category[], accs: BankAccount[]) {
  return txs.map(t => ({
    Data: fmtDate(t.date.toDate()),
    Descrição: t.description || '-',
    Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
    Categoria: catName(t, cats),
    Conta: accName(t, accs),
    Pagamento: payLabel(t.paymentMethod),
    Status: t.isPending ? 'Pendente' : 'Confirmada',
    Valor: t.type === 'income' ? t.amount : -t.amount,
    'Valor (R$)': fmt(t.type === 'income' ? t.amount : t.amount),
  }));
}

// ─── 2. RESUMO MENSAL (DRE) ───────────────────────────────────────────────────

function buildMonthlySummary(txs: Transaction[], cats: Category[], accs: BankAccount[]) {
  const income = txs.filter(t => t.type === 'income' && !t.isPending).reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense' && !t.isPending).reduce((s, t) => s + t.amount, 0);
  const pending = txs.filter(t => t.isPending).reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // por categoria
  const catMap = new Map<string, { name: string; income: number; expense: number; budget?: number }>();
  for (const t of txs) {
    if (t.isPending) continue;
    const cat = cats.find(c => c.id === t.category);
    const key = cat?.id ?? '__outros__';
    if (!catMap.has(key)) catMap.set(key, { name: cat?.name ?? 'Outros', income: 0, expense: 0, budget: cat?.budget });
    const entry = catMap.get(key)!;
    if (t.type === 'income') entry.income += t.amount;
    else entry.expense += t.amount;
  }

  // por conta
  const accMap = new Map<string, { name: string; income: number; expense: number }>();
  for (const t of txs) {
    if (t.isPending || t.isTransfer) continue;
    const acc = accs.find(a => a.id === t.accountId);
    const key = acc?.id ?? '__outros__';
    if (!accMap.has(key)) accMap.set(key, { name: acc?.name ?? 'Sem conta', income: 0, expense: 0 });
    const entry = accMap.get(key)!;
    if (t.type === 'income') entry.income += t.amount;
    else entry.expense += t.amount;
  }

  return { income, expense, balance, pending, catMap, accMap };
}

// ─── 3. FLUXO DE CAIXA (agrupado por mês) ────────────────────────────────────

function buildCashflow(txs: Transaction[]) {
  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    if (t.isPending || t.isTransfer) continue;
    const key = format(t.date.toDate(), 'yyyy-MM');
    if (!monthMap.has(key)) monthMap.set(key, { income: 0, expense: 0 });
    const entry = monthMap.get(key)!;
    if (t.type === 'income') entry.income += t.amount;
    else entry.expense += t.amount;
  }
  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      Mês: format(new Date(month + '-01'), 'MMMM yyyy', { locale: ptBR }),
      Receitas: v.income,
      Despesas: v.expense,
      Saldo: v.income - v.expense,
      'Receitas (R$)': fmt(v.income),
      'Despesas (R$)': fmt(v.expense),
      'Saldo (R$)': fmt(v.income - v.expense),
    }));
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

function autoColWidths(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const widths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell?.v != null) max = Math.max(max, String(cell.v).length + 2);
    }
    widths.push(max);
  }
  ws['!cols'] = widths.map(w => ({ wch: Math.min(w, 40) }));
}

export function exportTransactionsXLSX(
  txs: Transaction[],
  cats: Category[],
  accs: BankAccount[],
  periodLabel: string,
) {
  const rows = buildTransactionRows(txs, cats, accs);
  const ws = XLSX.utils.json_to_sheet(rows);
  autoColWidths(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transações');
  XLSX.writeFile(wb, `extrato_${periodLabel}.xlsx`);
}

export function exportMonthlySummaryXLSX(
  txs: Transaction[],
  cats: Category[],
  accs: BankAccount[],
  periodLabel: string,
) {
  const { income, expense, balance, pending, catMap, accMap } = buildMonthlySummary(txs, cats, accs);
  const wb = XLSX.utils.book_new();

  // Aba: Resumo Geral
  const summary = [
    { Item: 'Total de Receitas', Valor: income, 'Valor (R$)': fmt(income) },
    { Item: 'Total de Despesas', Valor: expense, 'Valor (R$)': fmt(expense) },
    { Item: 'Saldo do Período', Valor: balance, 'Valor (R$)': fmt(balance) },
    { Item: 'Transações Pendentes', Valor: pending, 'Valor (R$)': fmt(pending) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  autoColWidths(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  // Aba: Por Categoria
  const catRows = Array.from(catMap.values()).map(c => ({
    Categoria: c.name,
    Receitas: c.income,
    Despesas: c.expense,
    Saldo: c.income - c.expense,
    Orçamento: c.budget ?? '-',
    '% do Orçamento': c.budget ? `${Math.round((c.expense / c.budget) * 100)}%` : '-',
    'Receitas (R$)': fmt(c.income),
    'Despesas (R$)': fmt(c.expense),
    'Saldo (R$)': fmt(c.income - c.expense),
  }));
  const wsCat = XLSX.utils.json_to_sheet(catRows);
  autoColWidths(wsCat);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoria');

  // Aba: Por Conta
  const accRows = Array.from(accMap.values()).map(a => ({
    Conta: a.name,
    Receitas: a.income,
    Despesas: a.expense,
    Saldo: a.income - a.expense,
    'Receitas (R$)': fmt(a.income),
    'Despesas (R$)': fmt(a.expense),
    'Saldo (R$)': fmt(a.income - a.expense),
  }));
  const wsAcc = XLSX.utils.json_to_sheet(accRows);
  autoColWidths(wsAcc);
  XLSX.utils.book_append_sheet(wb, wsAcc, 'Por Conta');

  // Aba: Transações
  const wsTx = XLSX.utils.json_to_sheet(buildTransactionRows(txs, cats, accs));
  autoColWidths(wsTx);
  XLSX.utils.book_append_sheet(wb, wsTx, 'Lançamentos');

  XLSX.writeFile(wb, `relatorio_mensal_${periodLabel}.xlsx`);
}

export function exportCashflowXLSX(txs: Transaction[], periodLabel: string) {
  const rows = buildCashflow(txs);
  const ws = XLSX.utils.json_to_sheet(rows);
  autoColWidths(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa');
  XLSX.writeFile(wb, `fluxo_caixa_${periodLabel}.xlsx`);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function rowsToCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\r\n');
}

function downloadText(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const bom = '\uFEFF'; // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTransactionsCSV(
  txs: Transaction[],
  cats: Category[],
  accs: BankAccount[],
  periodLabel: string,
) {
  const rows = buildTransactionRows(txs, cats, accs).map(r => ({
    Data: r.Data,
    Descrição: r.Descrição,
    Tipo: r.Tipo,
    Categoria: r.Categoria,
    Conta: r.Conta,
    Pagamento: r.Pagamento,
    Status: r.Status,
    'Valor (R$)': r['Valor (R$)'],
  }));
  downloadText(rowsToCSV(rows), `extrato_${periodLabel}.csv`);
}

export function exportCashflowCSV(txs: Transaction[], periodLabel: string) {
  const rows = buildCashflow(txs).map(r => ({
    Mês: r.Mês,
    'Receitas (R$)': r['Receitas (R$)'],
    'Despesas (R$)': r['Despesas (R$)'],
    'Saldo (R$)': r['Saldo (R$)'],
  }));
  downloadText(rowsToCSV(rows), `fluxo_caixa_${periodLabel}.csv`);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function pdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Finanças Pro', 14, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 20);
  doc.setFontSize(9);
  doc.text(subtitle, 14, 26);
  doc.setTextColor(0, 0, 0);
}

function pdfFooter(doc: jsPDF) {
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${fmtDate(new Date())} — Finanças Pro`,
      14,
      doc.internal.pageSize.height - 8,
    );
    doc.text(
      `Página ${i} de ${pages}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 8,
    );
  }
}

export function exportTransactionsPDF(
  txs: Transaction[],
  cats: Category[],
  accs: BankAccount[],
  periodLabel: string,
  periodTitle: string,
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  pdfHeader(doc, 'Extrato de Transações', periodTitle);

  const income = txs.filter(t => t.type === 'income' && !t.isPending).reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense' && !t.isPending).reduce((s, t) => s + t.amount, 0);

  // KPI row
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(`Receitas: ${fmt(income)}`, 14, 36);
  doc.setTextColor(185, 28, 28);
  doc.text(`Despesas: ${fmt(expense)}`, 80, 36);
  const balColor = income - expense >= 0 ? [21, 128, 61] : [185, 28, 28];
  doc.setTextColor(balColor[0], balColor[1], balColor[2]);
  doc.text(`Saldo: ${fmt(income - expense)}`, 150, 36);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 42,
    head: [['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Valor']],
    body: txs.map(t => [
      fmtDate(t.date.toDate()),
      t.description || '-',
      t.type === 'income' ? 'Receita' : 'Despesa',
      catName(t, cats),
      accName(t, accs),
      fmt(t.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 20 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35 },
      5: { cellWidth: 28, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        data.cell.styles.textColor = data.cell.raw === 'Receita' ? [21, 128, 61] : [185, 28, 28];
      }
    },
  });

  pdfFooter(doc);
  doc.save(`extrato_${periodLabel}.pdf`);
}

export function exportMonthlySummaryPDF(
  txs: Transaction[],
  cats: Category[],
  accs: BankAccount[],
  periodLabel: string,
  periodTitle: string,
) {
  const doc = new jsPDF();
  const { income, expense, balance, catMap } = buildMonthlySummary(txs, cats, accs);
  pdfHeader(doc, 'Relatório Mensal', periodTitle);

  // KPIs
  doc.setFontSize(11);
  const kpis = [
    { label: 'Receitas', value: fmt(income), color: [21, 128, 61] as [number,number,number] },
    { label: 'Despesas', value: fmt(expense), color: [185, 28, 28] as [number,number,number] },
    { label: 'Saldo', value: fmt(balance), color: balance >= 0 ? [21, 128, 61] as [number,number,number] : [185, 28, 28] as [number,number,number] },
  ];
  kpis.forEach((k, i) => {
    const x = 14 + i * 62;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 32, 58, 18, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + 4, 39);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...k.color);
    doc.text(k.value, x + 4, 46);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  });

  // Tabela por categoria
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Gastos por Categoria', 14, 60);

  const catRows = Array.from(catMap.values())
    .filter(c => c.expense > 0 || c.income > 0)
    .sort((a, b) => b.expense - a.expense);

  autoTable(doc, {
    startY: 64,
    head: [['Categoria', 'Receitas', 'Despesas', 'Saldo', 'Orçamento', '% Uso']],
    body: catRows.map(c => [
      c.name,
      fmt(c.income),
      fmt(c.expense),
      fmt(c.income - c.expense),
      c.budget ? fmt(c.budget) : '-',
      c.budget ? `${Math.round((c.expense / c.budget) * 100)}%` : '-',
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  });

  // Tabela de lançamentos
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Lançamentos do Período', 14, finalY);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['Data', 'Descrição', 'Categoria', 'Conta', 'Valor']],
    body: txs.map(t => [
      fmtDate(t.date.toDate()),
      t.description || '-',
      catName(t, cats),
      accName(t, accs),
      (t.type === 'expense' ? '-' : '') + fmt(t.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 4: { halign: 'right' } },
  });

  pdfFooter(doc);
  doc.save(`relatorio_mensal_${periodLabel}.pdf`);
}

export function exportCashflowPDF(txs: Transaction[], periodLabel: string, periodTitle: string) {
  const doc = new jsPDF();
  pdfHeader(doc, 'Fluxo de Caixa', periodTitle);

  const rows = buildCashflow(txs);
  const totalIncome = rows.reduce((s, r) => s + r.Receitas, 0);
  const totalExpense = rows.reduce((s, r) => s + r.Despesas, 0);

  autoTable(doc, {
    startY: 36,
    head: [['Mês', 'Receitas', 'Despesas', 'Saldo']],
    body: [
      ...rows.map(r => [r.Mês, r['Receitas (R$)'], r['Despesas (R$)'], r['Saldo (R$)']]),
      ['TOTAL', fmt(totalIncome), fmt(totalExpense), fmt(totalIncome - totalExpense)],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === rows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [30, 58, 138];
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
  });

  pdfFooter(doc);
  doc.save(`fluxo_caixa_${periodLabel}.pdf`);
}
