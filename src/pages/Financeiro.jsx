import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet, Plus, Trash2, Pencil, Check, X,
  PieChart as PieIcon, BarChart3, LineChart as LineIcon,
  Repeat, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { isInMonthOffset, monthKey } from '../utils/monthCompare';

const CATEGORIES = ['Alimentação', 'Transporte', 'Faculdade', 'Lazer', 'Moradia', 'Saúde', 'Outros'];
const CATEGORY_COLORS = ['#7aa2d4', '#7fb88a', '#d4a95e', '#b98fd4', '#d4707a', '#6fc2c9', '#c9c46f'];

export default function Financeiro() {
  const { user } = useAuth();
  const { items: transactions, loading, addItem, updateItem, removeItem } = useFirestoreCollection(
    user.uid,
    'transactions'
  );
  const {
    items: recurring,
    addItem: addRecurring,
    updateItem: updateRecurring,
    removeItem: removeRecurring,
  } = useFirestoreCollection(user.uid, 'recurringTransactions');
  const { preferences, updatePreferences } = useUserPreferences(user.uid);

  const [newTx, setNewTx] = useState({ desc: '', value: '', type: 'entrada', category: CATEGORIES[0] });
  const [activeChart, setActiveChart] = useState(null);
  const [budgetDraft, setBudgetDraft] = useState(null);
  const [categoryDrafts, setCategoryDrafts] = useState({});

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [newRecurring, setNewRecurring] = useState({ desc: '', value: '', type: 'saida', category: CATEGORIES[0], dayOfMonth: '1', budgetLimit: '' });

  const syncedRef = useRef(false);

  const chart = activeChart || preferences.chartType || 'pizza';

  const saldo = transactions.reduce(
    (acc, t) => acc + (t.type === 'entrada' ? t.value : -t.value),
    0
  );

  // --- gera automaticamente a movimentação do mês pra cada transação fixa, se ainda não existir ---
  useEffect(() => {
    if (syncedRef.current || recurring.length === 0) return;
    syncedRef.current = true;

    const today = new Date();
    const thisMonth = monthKey(today);

    recurring.forEach((r) => {
      if (r.lastGeneratedMonth === thisMonth) return;
      if (today.getDate() < r.dayOfMonth) return;

      // Usa o dia marcado (não "hoje") — assim, mesmo abrindo o app
      // atrasado, a movimentação aparece na data certa em que ela
      // realmente "debita", e meio-dia evita qualquer problema de
      // fuso horário empurrar pro dia anterior/seguinte.
      const scheduledDate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth, 12, 0, 0);

      addItem({
        desc: r.desc,
        value: r.value,
        type: r.type,
        category: r.category,
        date: scheduledDate.toISOString(),
        recurringTemplateId: r.id,
      });
      updateRecurring(r.id, { lastGeneratedMonth: thisMonth });
    });
  }, [recurring, addItem, updateRecurring]);

  function handleAdd() {
    const value = parseFloat(newTx.value);
    if (!newTx.desc.trim() || isNaN(value) || value <= 0) return;
    addItem({
      desc: newTx.desc.trim(),
      value,
      type: newTx.type,
      category: newTx.category,
      date: new Date().toISOString(),
    });
    setNewTx({ desc: '', value: '', type: 'entrada', category: CATEGORIES[0] });
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditDraft({ desc: t.desc, value: String(t.value), type: t.type, category: t.category || 'Outros' });
  }

  function saveEdit() {
    const value = parseFloat(editDraft.value);
    if (!editDraft.desc.trim() || isNaN(value) || value <= 0) return;
    updateItem(editingId, {
      desc: editDraft.desc.trim(),
      value,
      type: editDraft.type,
      category: editDraft.category,
    });
    setEditingId(null);
    setEditDraft(null);
  }

  function handleAddRecurring() {
    const value = parseFloat(newRecurring.value);
    const day = parseInt(newRecurring.dayOfMonth, 10);
    if (!newRecurring.desc.trim() || isNaN(value) || value <= 0 || isNaN(day) || day < 1 || day > 28) return;
    const limit = parseFloat(newRecurring.budgetLimit);
    addRecurring({
      desc: newRecurring.desc.trim(),
      value,
      type: newRecurring.type,
      category: newRecurring.category,
      dayOfMonth: day,
      budgetLimit: isNaN(limit) ? null : limit,
      lastGeneratedMonth: null,
    });
    setNewRecurring({ desc: '', value: '', type: 'saida', category: CATEGORIES[0], dayOfMonth: '1', budgetLimit: '' });
  }

  // --- dados pros gráficos ---
  const pieData = useMemo(() => {
    const totals = {};
    transactions
      .filter((t) => t.type === 'saida')
      .forEach((t) => {
        const cat = t.category || 'Outros';
        totals[cat] = (totals[cat] || 0) + t.value;
      });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const barData = useMemo(() => {
    const entradas = transactions.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.value, 0);
    const saidas = transactions.filter((t) => t.type === 'saida').reduce((a, t) => a + t.value, 0);
    return [{ nome: 'Entradas', valor: entradas }, { nome: 'Saídas', valor: saidas }];
  }, [transactions]);

  const lineData = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return sorted.reduce((acc, t) => {
      const previousSaldo = acc.length > 0 ? acc[acc.length - 1].saldo : 0;
      const saldoAtual = previousSaldo + (t.type === 'entrada' ? t.value : -t.value);
      return [...acc, { i: acc.length + 1, saldo: Number(saldoAtual.toFixed(2)) }];
    }, []);
  }, [transactions]);

  // --- meta mensal geral ---
  const monthSaidas = transactions
    .filter((t) => t.type === 'saida' && isInMonthOffset(t.date, 0))
    .reduce((a, t) => a + t.value, 0);
  const budget = preferences.monthlyBudget || 0;
  const budgetPct = budget > 0 ? Math.min(100, (monthSaidas / budget) * 100) : 0;
  const overBudget = budget > 0 && monthSaidas > budget;

  function commitBudget() {
    if (budgetDraft === null) return;
    const value = parseFloat(budgetDraft);
    updatePreferences({ monthlyBudget: isNaN(value) ? 0 : value });
    setBudgetDraft(null);
  }

  // --- metas por categoria ---
  const categoryBudgets = preferences.categoryBudgets || {};
  const monthSpendingByCategory = useMemo(() => {
    const totals = {};
    transactions
      .filter((t) => t.type === 'saida' && isInMonthOffset(t.date, 0))
      .forEach((t) => {
        const cat = t.category || 'Outros';
        totals[cat] = (totals[cat] || 0) + t.value;
      });
    return totals;
  }, [transactions]);

  function commitCategoryBudget(cat) {
    const draft = categoryDrafts[cat];
    if (draft === undefined) return;
    const value = parseFloat(draft);
    updatePreferences({ categoryBudgets: { ...categoryBudgets, [cat]: isNaN(value) ? 0 : value } });
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  }

  const [recurringBudgetDrafts, setRecurringBudgetDrafts] = useState({});

  function commitRecurringBudget(template) {
    const draft = recurringBudgetDrafts[template.id];
    if (draft === undefined) return;
    const value = parseFloat(draft);
    updateRecurring(template.id, { budgetLimit: isNaN(value) || value <= 0 ? null : value });
    setRecurringBudgetDrafts((prev) => {
      const next = { ...prev };
      delete next[template.id];
      return next;
    });
  }

  // valor já lançado este mês pra cada transação fixa (pra comparar com a meta dela)
  const thisMonthByTemplate = useMemo(() => {
    const map = {};
    transactions
      .filter((t) => t.recurringTemplateId && isInMonthOffset(t.date, 0))
      .forEach((t) => {
        map[t.recurringTemplateId] = t.value;
      });
    return map;
  }, [transactions]);

  // --- comparação de meses ---
  const thisMonthEntradas = transactions
    .filter((t) => t.type === 'entrada' && isInMonthOffset(t.date, 0))
    .reduce((a, t) => a + t.value, 0);
  const lastMonthEntradas = transactions
    .filter((t) => t.type === 'entrada' && isInMonthOffset(t.date, -1))
    .reduce((a, t) => a + t.value, 0);
  const lastMonthSaidas = transactions
    .filter((t) => t.type === 'saida' && isInMonthOffset(t.date, -1))
    .reduce((a, t) => a + t.value, 0);

  const entradasDelta = thisMonthEntradas - lastMonthEntradas;
  const saidasDelta = monthSaidas - lastMonthSaidas;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-icon-badge financeiro">
          <Wallet size={18} />
        </div>
        <div>
          <span className="page-comment">// financeiro</span>
          <h2 className="page-title">Movimentações</h2>
        </div>
      </div>

      <div className="card accent-financeiro">
        <div className="saldo-box">
          <span className="saldo-label">Saldo atual</span>
          <span className={`saldo-value ${saldo >= 0 ? 'pos' : 'neg'}`}>
            R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="compare-grid">
          <div className="compare-stat">
            <span className="compare-label">Entradas este mês</span>
            <span className="compare-value">R$ {thisMonthEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={`compare-delta ${entradasDelta >= 0 ? 'up' : 'down'}`}>
              {entradasDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {entradasDelta >= 0 ? '+' : ''}R$ {entradasDelta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs mês passado
            </span>
          </div>
          <div className="compare-stat">
            <span className="compare-label">Saídas este mês</span>
            <span className="compare-value">R$ {monthSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={`compare-delta ${saidasDelta <= 0 ? 'up' : 'down'}`}>
              {saidasDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {saidasDelta >= 0 ? '+' : ''}R$ {saidasDelta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs mês passado
            </span>
          </div>
        </div>

        <div className="budget-box">
          <div className="budget-top">
            <span>Meta de gastos do mês</span>
            <span className="goal-row budget-edit">
              R$
              <input
                type="number"
                min="0"
                placeholder="0"
                value={budgetDraft ?? (budget || '')}
                onChange={(e) => setBudgetDraft(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={(e) => e.key === 'Enter' && commitBudget()}
              />
            </span>
          </div>
          {budget > 0 && (
            <>
              <div className="budget-bar-track">
                <div
                  className={`budget-bar-fill ${overBudget ? 'over-budget' : ''}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className={overBudget ? 'budget-warning' : 'item-tag'}>
                {overBudget
                  ? `Passou R$ ${(monthSaidas - budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} da meta este mês`
                  : `R$ ${monthSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gastos este mês`}
              </span>
            </>
          )}
        </div>

        <div className="chart-toggle">
          <button className={chart === 'pizza' ? 'active' : ''} onClick={() => setActiveChart('pizza')}>
            <PieIcon size={13} /> Pizza
          </button>
          <button className={chart === 'barra' ? 'active' : ''} onClick={() => setActiveChart('barra')}>
            <BarChart3 size={13} /> Barra
          </button>
          <button className={chart === 'linha' ? 'active' : ''} onClick={() => setActiveChart('linha')}>
            <LineIcon size={13} /> Linha
          </button>
        </div>

        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            {chart === 'pizza' ? (
              pieData.length === 0 ? (
                <div className="empty">Sem saídas registradas ainda pra mostrar por categoria.</div>
              ) : (
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              )
            ) : chart === 'barra' ? (
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="valor" fill="var(--accent-financeiro)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="i" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Line type="monotone" dataKey="saldo" stroke="var(--accent-agenda)" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="list">
          {loading && <div className="empty">Carregando...</div>}
          {!loading && transactions.length === 0 && (
            <div className="empty">Nenhuma movimentação registrada ainda.</div>
          )}
          {transactions
            .slice()
            .reverse()
            .map((t) =>
              editingId === t.id ? (
                <div className="add-row" key={t.id} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                  <input
                    className="flex-1"
                    type="text"
                    value={editDraft.desc}
                    onChange={(e) => setEditDraft({ ...editDraft, desc: e.target.value })}
                  />
                  <input
                    className="w-value"
                    type="number"
                    value={editDraft.value}
                    onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })}
                  />
                  <select value={editDraft.type} onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                  <select
                    value={editDraft.category}
                    onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="add-btn" onClick={saveEdit} aria-label="Salvar">
                    <Check size={15} />
                  </button>
                  <button className="del-btn" onClick={() => setEditingId(null)} aria-label="Cancelar">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="item" key={t.id}>
                  <div className="item-body">
                    <div className="item-title">
                      {t.desc}
                      {t.recurringTemplateId && <Repeat size={11} className="recurrence-icon" />}
                    </div>
                    <div className="item-tag">{t.category || 'Outros'}</div>
                  </div>
                  <span className={`tx-value ${t.type}`}>
                    {t.type === 'entrada' ? '+' : '−'} R${' '}
                    {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button className="edit-btn" onClick={() => startEdit(t)} aria-label="Editar">
                    <Pencil size={13} />
                  </button>
                  <button className="del-btn" onClick={() => removeItem(t.id)} aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            )}
        </div>

        <div className="add-row">
          <input
            className="flex-1"
            type="text"
            placeholder="Descrição"
            value={newTx.desc}
            onChange={(e) => setNewTx({ ...newTx, desc: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <input
            className="w-value"
            type="number"
            placeholder="0,00"
            value={newTx.value}
            onChange={(e) => setNewTx({ ...newTx, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
          <select
            value={newTx.category}
            onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="add-btn" onClick={handleAdd} aria-label="Adicionar movimentação">
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Transações fixas/recorrentes */}
      <div className="card accent-financeiro" style={{ marginTop: 16 }}>
        <span className="page-comment">// transações fixas</span>
        <div className="list">
          {recurring.length === 0 && <div className="empty">Nenhuma transação fixa cadastrada.</div>}
          {recurring.map((r) => {
            const spentThisMonth = thisMonthByTemplate[r.id];
            const limit = r.budgetLimit || null;
            const over = limit && spentThisMonth && spentThisMonth > limit;
            const draft = recurringBudgetDrafts[r.id] ?? (limit || '');
            return (
              <div className="subject-card" key={r.id}>
                <div className="item">
                  <div className="item-body">
                    <div className="item-title">
                      {r.desc}
                      <Repeat size={11} className="recurrence-icon" />
                    </div>
                    <div className="item-tag">{r.category} · todo dia {r.dayOfMonth}</div>
                  </div>
                  <span className={`tx-value ${r.type}`}>
                    {r.type === 'entrada' ? '+' : '−'} R$ {r.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button className="del-btn" onClick={() => removeRecurring(r.id)} aria-label="Remover transação fixa">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="category-budget-top">
                  <span className="item-tag" style={{ margin: 0 }}>
                    Meta pra essa conta
                  </span>
                  <span className="goal-row">
                    R$
                    <input
                      type="number"
                      min="0"
                      placeholder="sem meta"
                      value={draft}
                      onChange={(e) => setRecurringBudgetDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      onBlur={() => commitRecurringBudget(r)}
                      onKeyDown={(e) => e.key === 'Enter' && commitRecurringBudget(r)}
                    />
                  </span>
                </div>
                {limit && spentThisMonth !== undefined && (
                  <span className={over ? 'budget-warning' : 'item-tag'}>
                    {over
                      ? `Passou a meta: R$ ${spentThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (meta era R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                      : `R$ ${spentThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} este mês`}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="add-row">
          <input
            className="flex-1"
            type="text"
            placeholder="Ex: Mensalidade da faculdade"
            value={newRecurring.desc}
            onChange={(e) => setNewRecurring({ ...newRecurring, desc: e.target.value })}
          />
          <input
            className="w-value"
            type="number"
            placeholder="0,00"
            value={newRecurring.value}
            onChange={(e) => setNewRecurring({ ...newRecurring, value: e.target.value })}
          />
          <select value={newRecurring.type} onChange={(e) => setNewRecurring({ ...newRecurring, type: e.target.value })}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
          <select
            value={newRecurring.category}
            onChange={(e) => setNewRecurring({ ...newRecurring, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className="w-minutes"
            type="number"
            min="1"
            max="28"
            placeholder="dia"
            value={newRecurring.dayOfMonth}
            onChange={(e) => setNewRecurring({ ...newRecurring, dayOfMonth: e.target.value })}
          />
          <input
            className="w-value"
            type="number"
            min="0"
            placeholder="meta (opc.)"
            value={newRecurring.budgetLimit}
            onChange={(e) => setNewRecurring({ ...newRecurring, budgetLimit: e.target.value })}
          />
          <button className="add-btn" onClick={handleAddRecurring} aria-label="Adicionar transação fixa">
            <Plus size={15} />
          </button>
        </div>
        <p className="item-tag" style={{ margin: 0 }}>
          Todo dia marcado do mês, ela é lançada automaticamente como uma movimentação normal — com a data certa em
          que costuma debitar. A meta (opcional) avisa se o valor real daquele mês passar do limite.
        </p>
      </div>

      {/* Metas por categoria */}
      <div className="card accent-financeiro" style={{ marginTop: 16 }}>
        <span className="page-comment">// metas por categoria (este mês)</span>
        <div className="list">
          {CATEGORIES.map((cat) => {
            const catBudget = categoryBudgets[cat] || 0;
            const spent = monthSpendingByCategory[cat] || 0;
            const pct = catBudget > 0 ? Math.min(100, (spent / catBudget) * 100) : 0;
            const over = catBudget > 0 && spent > catBudget;
            const draft = categoryDrafts[cat] ?? (catBudget || '');
            return (
              <div className="category-budget-row" key={cat}>
                <div className="category-budget-top">
                  <span>{cat}</span>
                  <span className="goal-row">
                    R$
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={draft}
                      onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [cat]: e.target.value }))}
                      onBlur={() => commitCategoryBudget(cat)}
                      onKeyDown={(e) => e.key === 'Enter' && commitCategoryBudget(cat)}
                    />
                  </span>
                </div>
                {catBudget > 0 && (
                  <div className="budget-bar-track">
                    <div
                      className={`budget-bar-fill ${over ? 'over-budget' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {catBudget > 0 && (
                  <span className={over ? 'budget-warning' : 'item-tag'}>
                    R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {catBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
