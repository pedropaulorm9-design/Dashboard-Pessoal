export default function Avatar({ src, fallbackText, size = 32 }) {
  if (src) {
    return (
      <img
        src={src}
        alt="Foto de perfil"
        className="avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {fallbackText || '?'}
    </span>
  );
}
