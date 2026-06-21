import { useState } from 'react';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

export default function Financeiro() {
  const { user } = useAuth();
  const { items: transactions, loading, addItem, removeItem } = useFirestoreCollection(
    user.uid,
    'transactions'
  );

  const [newTx, setNewTx] = useState({ desc: '', value: '', type: 'entrada' });

  const saldo = transactions.reduce(
    (acc, t) => acc + (t.type === 'entrada' ? t.value : -t.value),
    0
  );

  function handleAdd() {
    const value = parseFloat(newTx.value);
    if (!newTx.desc.trim() || isNaN(value) || value <= 0) return;
    addItem({ desc: newTx.desc.trim(), value, type: newTx.type });
    setNewTx({ desc: '', value: '', type: 'entrada' });
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

        <div className="list">
          {loading && <div className="empty">Carregando...</div>}
          {!loading && transactions.length === 0 && (
            <div className="empty">Nenhuma movimentação registrada ainda.</div>
          )}
          {transactions.map((t) => (
            <div className="item" key={t.id}>
              <div className="item-body">
                <div className="item-title">{t.desc}</div>
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
          <button className="add-btn" onClick={handleAdd} aria-label="Adicionar movimentação">
            <Plus size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}
