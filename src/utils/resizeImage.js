/**
 * Lê um arquivo de imagem (ex: escolhido da galeria), recorta o centro
 * em formato quadrado e comprime pra um JPEG pequeno em base64 — assim
 * cabe direto num campo do Firestore, sem precisar de Firebase Storage.
 */
export function resizeImageToBase64(file, size = 160, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
