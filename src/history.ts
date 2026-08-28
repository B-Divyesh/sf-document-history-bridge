export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

export function textDiff(previous: string, current: string): DiffPart[] {
  const a = previous.trim().split(/\s+/).filter(Boolean);
  const b = current.trim().split(/\s+/).filter(Boolean);
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }
  const output: DiffPart[] = [];
  const append = (kind: DiffPart["kind"], word: string) => {
    const last = output.at(-1);
    if (last?.kind === kind) last.text += ` ${word}`;
    else output.push({ kind, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { append("same", a[i]); i += 1; j += 1; }
    else if (matrix[i + 1][j] >= matrix[i][j + 1]) { append("removed", a[i]); i += 1; }
    else { append("added", b[j]); j += 1; }
  }
  while (i < a.length) append("removed", a[i++]);
  while (j < b.length) append("added", b[j++]);
  return output;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
