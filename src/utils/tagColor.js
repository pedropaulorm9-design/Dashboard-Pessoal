const PALETTE = [
  '#e0788c', '#7ac3e0', '#9fdb7a', '#e0c060',
  '#b08ce0', '#e0995c', '#5cc9b5', '#d97aa8',
];

export function tagColor(tag) {
  if (!tag) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function isImportantTag(tag) {
  return Boolean(tag) && tag.toLowerCase().includes('importante');
}
