import { useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, PieChart as PieIcon, BarChart3, LineChart as LineIcon } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useUserPreferences } from '../hooks/useUserPreferences';

const CATEGORIES = ['Alimentação', 'Transporte', 'Faculdade', 'Lazer', 'Moradia', 'Saúde', 'Outros'];
const CATEGORY_COLORS = ['#7aa2d4', '#7fb88a', '#d4a95e', '#b98fd4', '#d4707a', '#6fc2c9', '#c9c46f'];

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function Financeiro() {
  const { user } = useAuth();
  const { items: transactions, loading, addItem, removeItem } = useFirestoreCollection(
    user.uid,
    'transactions'
  );
  const { preferences, updatePreferences } = useUserPreferences(user.uid);

  const [newTx, setNewTx] = useState({ desc: '', value: '', type: 'entrada', category: CATEGORIES[0] });
  const [activeChart, setActiveChart] = useState(null);
  const [budgetDraft, setBudgetDraft] = useState(null);

  const chart = activeChart || preferences.chartType || 'pizza';

  const saldo = transactions.reduce(
    (acc, t) => acc + (t.type === 'entrada' ? t.value : -t.value),
    0
  );

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

  // --- meta mensal ---
  const monthSaidas = transactions
    .filter((t) => t.type === 'saida' && isThisMonth(t.date))
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

  return (
    <main className="page">
      <div className="page-header">
        <Wallet size={18} />
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
            .map((t) => (
              <div className="item" key={t.id}>
                <div className="item-body">
                  <div className="item-title">{t.desc}</div>
                  <div className="item-tag">{t.category || 'Outros'}</div>
                </div>
                <span className={`tx-value ${t.type}`}>
                  {t.type === 'entrada' ? '+' : '−'} R${' '}
                  {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <button className="del-btn" onClick={() => removeItem(t.id)} aria-label="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
    </main>
  );
}
