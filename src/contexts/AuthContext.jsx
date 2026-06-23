import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function reauthenticate(currentPassword) {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    return reauthenticateWithCredential(auth.currentUser, credential);
  }

  // O onAuthStateChanged só dispara em login/logout — updateProfile não
  // atualiza o objeto `user` do contexto por conta própria. Por isso,
  // depois de qualquer mudança de perfil, recarregamos e forçamos uma
  // nova referência pra React perceber a mudança.
  async function refreshUser() {
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  }

  async function updateDisplayName(name) {
    await updateProfile(auth.currentUser, { displayName: name });
    await refreshUser();
  }

  async function updatePhotoURL(url) {
    await updateProfile(auth.currentUser, { photoURL: url });
    await refreshUser();
  }

  async function changePassword(currentPassword, newPassword) {
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
  }

  async function deleteAccountWithPassword(currentPassword) {
    await reauthenticate(currentPassword);
    await deleteUser(auth.currentUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        reauthenticate,
        updateDisplayName,
        updatePhotoURL,
        changePassword,
        deleteAccountWithPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return ctx;
}
