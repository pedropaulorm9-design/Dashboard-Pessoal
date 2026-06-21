import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Essas chaves vêm do seu projeto no Firebase Console.
// Configure-as no arquivo .env (veja .env.example) ou nas variáveis
// de ambiente do Vercel quando for publicar.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Habilita cache local persistente: os dados do Firestore ficam salvos
// no próprio dispositivo (IndexedDB), então o app continua mostrando
// e aceitando alterações mesmo sem internet. Quando a conexão volta,
// tudo sincroniza automaticamente com o servidor e com os outros
// dispositivos logados na mesma conta.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export default app;
