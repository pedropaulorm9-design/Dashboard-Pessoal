import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Conta quantos dias seguidos (até hoje) o usuário registrou pelo menos
 * uma sessão de estudo. Guardado em users/{uid}/meta/studyStreak.
 */
export function useStudyStreak(uid) {
  const [streak, setStreak] = useState(0);
  const [lastStudyDate, setLastStudyDate] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'meta', 'studyStreak');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setStreak(snap.data().streak || 0);
        setLastStudyDate(snap.data().lastStudyDate || null);
      }
    });
    return unsubscribe;
  }, [uid]);

  async function registerStudyToday() {
    const today = todayKey();
    if (lastStudyDate === today) return; // já contabilizado hoje

    let nextStreak = 1;
    if (lastStudyDate === yesterdayKey()) {
      nextStreak = (streak || 0) + 1;
    }

    const ref = doc(db, 'users', uid, 'meta', 'studyStreak');
    await setDoc(ref, { streak: nextStreak, lastStudyDate: today }, { merge: true });
  }

  return { streak, lastStudyDate, registerStudyToday };
}
