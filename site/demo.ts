import "./demo.css";

type Version = { date: string; reason: string; before: string; removed: string; added: string; after: string };
type SampleFile = { name: string; type: string; size: string; versions: Version[] };

const storageKey = "demo:document-history-bridge:selection";
const sampleFiles: SampleFile[] = [
  {
    name: "Proposal.docx", type: "DOCX", size: "84 KB",
    versions: [
      { date: "28 Aug, 09:42", reason: "Folder change", before: "Payment is due within ", removed: "thirty", added: "forty-five", after: " days of receipt. The review begins on Wednesday." },
      { date: "24 Aug, 16:10", reason: "Initial capture", before: "Payment is due within ", removed: "", added: "thirty", after: " days of receipt. The review begins on Monday." }
    ]
  },
  {
    name: "Records-policy.odt", type: "ODT", size: "51 KB",
    versions: [
      { date: "27 Aug, 14:06", reason: "Folder change", before: "Signed records are kept for ", removed: "five", added: "seven", after: " years after the project closes." },
      { date: "18 Aug, 11:22", reason: "Initial capture", before: "Signed records are kept for ", removed: "", added: "five", after: " years after the project closes." }
    ]
  },
  {
    name: "Meeting-notes.md", type: "MD", size: "12 KB",
    versions: [
      { date: "26 Aug, 17:30", reason: "Manual capture", before: "Rina will send the revised schedule by ", removed: "Friday", added: "Thursday", after: ". Omar will review the cost table." },
      { date: "26 Aug, 10:15", reason: "Initial capture", before: "Rina will send the revised schedule by ", removed: "", added: "Friday", after: "." }
    ]
  }
];

let selection = { file: 0, version: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as { file?: number; version?: number } | null;
  if (saved && Number.isInteger(saved.file) && Number.isInteger(saved.version)) {
    selection = { file: Math.min(Math.max(saved.file!, 0), sampleFiles.length - 1), version: Math.min(Math.max(saved.version!, 0), 1) };
  }
} catch {
  // The in-memory demo remains usable when storage is disabled.
}

const save = () => {
  try { localStorage.setItem(storageKey, JSON.stringify(selection)); } catch { /* in-memory fallback */ }
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);

function render(): void {
  const files = document.querySelector<HTMLDivElement>("#demo-files");
  const history = document.querySelector<HTMLDivElement>("#demo-history");
  const sheet = document.querySelector<HTMLDivElement>("#demo-sheet");
  if (!files || !history || !sheet) return;
  files.innerHTML = sampleFiles.map((file, index) => '<button role="option" aria-selected="' + (selection.file === index) + '" tabindex="' + (selection.file === index ? "0" : "-1") + '" data-file="' + index + '"><span class="file-type">' + file.type + '</span><span><b>' + escapeHtml(file.name) + '</b><small>' + file.versions.length + ' versions · ' + file.size + '</small></span></button>').join("");
  const selectedFile = sampleFiles[selection.file];
  history.innerHTML = selectedFile.versions.map((version, index) => '<button role="option" aria-selected="' + (selection.version === index) + '" tabindex="' + (selection.version === index ? "0" : "-1") + '" data-version="' + index + '"><span class="dot" aria-hidden="true"></span><span><b>' + escapeHtml(version.date) + '</b><small>' + escapeHtml(version.reason) + '</small></span></button>').join("");
  const version = selectedFile.versions[selection.version];
  const removed = version.removed ? '<del><span class="sr-only">Removed: </span>' + escapeHtml(version.removed) + '</del> ' : "";
  sheet.innerHTML = '<header><span>' + selectedFile.type + ' · ' + selectedFile.size + '</span><h3>' + escapeHtml(selectedFile.name) + '</h3><time>' + escapeHtml(version.date) + '</time></header><p class="document-copy">' + escapeHtml(version.before) + removed + '<ins><span class="sr-only">Added: </span>' + escapeHtml(version.added) + '</ins>' + escapeHtml(version.after) + '</p><div class="restore-row"><span>✓ Exact sample file preserved</span><button id="demo-restore">Restore this sample version</button></div>';
  bindOptions();
}

function move(buttons: HTMLButtonElement[], current: HTMLButtonElement, direction: number): void {
  const next = buttons[(buttons.indexOf(current) + direction + buttons.length) % buttons.length];
  next.focus();
  next.click();
}

function bindGroup(selector: string, dataName: "file" | "version"): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(selector)];
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      selection[dataName] = Number(button.dataset[dataName]);
      if (dataName === "file") selection.version = 0;
      save();
      render();
      document.querySelector<HTMLButtonElement>(selector + '[aria-selected="true"]')?.focus();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); move(buttons, button, 1); }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); move(buttons, button, -1); }
    });
  });
}

function bindOptions(): void {
  bindGroup("#demo-files button", "file");
  bindGroup("#demo-history button", "version");
  document.querySelector<HTMLButtonElement>("#demo-restore")?.addEventListener("click", () => {
    document.querySelector("#demo-notice")?.replaceChildren("Sample restored. No file on your computer was changed.");
  });
}

document.querySelector("#reset-demo")?.addEventListener("click", () => {
  selection = { file: 0, version: 0 };
  try { localStorage.removeItem(storageKey); } catch { /* in-memory fallback */ }
  render();
  document.querySelector("#demo-notice")?.replaceChildren("Demo reset to the first sample file.");
});
document.querySelector("#start-real")?.addEventListener("click", () => {
  try { localStorage.removeItem(storageKey); } catch { /* storage may be disabled */ }
});

render();
