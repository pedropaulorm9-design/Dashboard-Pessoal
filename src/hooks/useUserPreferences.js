import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULTS = {
  chartType: 'pizza', // 'pizza' | 'barra' | 'linha'
  monthlyBudget: 0,
};

/**
 * Preferências do usuário (tipo de gráfico padrão, meta mensal de gastos).
 * Fica em users/{uid}/meta/preferences e sincroniza em tempo real entre
 * dispositivos, igual o resto dos dados do app.
 */
export function useUserPreferences(uid) {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'meta', 'preferences');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setPreferences(snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  async function updatePreferences(partial) {
    const ref = doc(db, 'users', uid, 'meta', 'preferences');
    await setDoc(ref, { ...preferences, ...partial }, { merge: true });
  }

  return { preferences, loading, updatePreferences };
}
