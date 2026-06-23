export default function Avatar({ user, size = 32 }) {
  const initials = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();

  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt="Foto de perfil"
        className="avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials}
    </span>
  );
}
