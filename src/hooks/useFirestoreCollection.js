import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Sincroniza em tempo real uma subcoleção do usuário logado
 * (users/{uid}/{collectionName}) com o Firestore.
 *
 * Como usa onSnapshot, qualquer alteração feita em outro dispositivo
 * (ex: celular) aparece automaticamente aqui (ex: PC), sem precisar
 * recarregar a página.
 */
export function useFirestoreCollection(uid, collectionName, orderField) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const colRef = collection(db, 'users', uid, collectionName);
    const q = orderField ? query(colRef, orderBy(orderField)) : colRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (error) => {
        console.error(`Erro ao sincronizar ${collectionName}:`, error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid, collectionName, orderField]);

  async function addItem(data) {
    const colRef = collection(db, 'users', uid, collectionName);
    await addDoc(colRef, data);
  }

  async function updateItem(id, data) {
    const docRef = doc(db, 'users', uid, collectionName, id);
    await updateDoc(docRef, data);
  }

  async function removeItem(id) {
    const docRef = doc(db, 'users', uid, collectionName, id);
    await deleteDoc(docRef);
  }

  return { items, loading, addItem, updateItem, removeItem };
}
