import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Mantém um mapa { 'YYYY-MM-DD': minutosEstudados } sincronizado em
 * tempo real — usado pelo heatmap de estudo.
 */
export function useStudyDays(uid) {
  const [days, setDays] = useState({});

  useEffect(() => {
    if (!uid) return;
    const colRef = collection(db, 'users', uid, 'studyDays');
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data().minutes || 0;
      });
      setDays(map);
    });
    return unsubscribe;
  }, [uid]);

  async function addMinutes(dateKey, minutes) {
    const ref = doc(db, 'users', uid, 'studyDays', dateKey);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data().minutes || 0 : 0;
    await setDoc(ref, { minutes: current + minutes });
  }

  return { days, addMinutes };
}
