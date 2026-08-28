import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { checkoutUrl, acceptLicenseFromUrl, hasArchiveLicense, saveLicense, verifyLicense } from "./license";
import { formatBytes, formatDate, textDiff } from "./history";

type DocumentItem = { id: string; name: string; path: string; extension: string; latest_at: string; version_count: number; size: number; status: string };
type Version = { hash: string; captured_at: string; size: number; text: string; reason: string; extraction_warning?: string };

const state: { documents: DocumentItem[]; selected?: DocumentItem; versions: Version[]; current?: Version; previous?: Version; busy: boolean; demo: boolean } = {
  documents: [], versions: [], busy: false, demo: new URLSearchParams(location.search).get("demo") === "1"
};
const app = document.querySelector<HTMLDivElement>("#app")!;

const demoDocuments: DocumentItem[] = [
  { id: "demo-proposal", name: "Proposal.docx", path: "demo:/Client records/Proposal.docx", extension: ".docx", latest_at: "2026-08-28T09:42:00Z", version_count: 2, size: 86016, status: "ready" },
  { id: "demo-policy", name: "Records-policy.odt", path: "demo:/Client records/Records-policy.odt", extension: ".odt", latest_at: "2026-08-27T14:06:00Z", version_count: 2, size: 52224, status: "ready" },
  { id: "demo-notes", name: "Meeting-notes.md", path: "demo:/Client records/Meeting-notes.md", extension: ".md", latest_at: "2026-08-26T17:30:00Z", version_count: 2, size: 12288, status: "ready" }
];

const demoVersions: Record<string, Version[]> = {
  "demo-proposal": [
    { hash: "f45da2c19b7045ec", captured_at: "2026-08-28T09:42:00Z", size: 86016, reason: "Folder change", text: "Payment is due within forty-five days of receipt. The review begins on Wednesday." },
    { hash: "a30b7e819e2365bb", captured_at: "2026-08-24T16:10:00Z", size: 84992, reason: "Initial capture", text: "Payment is due within thirty days of receipt. The review begins on Monday." }
  ],
  "demo-policy": [
    { hash: "7ed4c012a1a4caa9", captured_at: "2026-08-27T14:06:00Z", size: 52224, reason: "Folder change", text: "Signed records are kept for seven years after the project closes." },
    { hash: "1b2ce45d29e4c122", captured_at: "2026-08-18T11:22:00Z", size: 51200, reason: "Initial capture", text: "Signed records are kept for five years after the project closes." }
  ],
  "demo-notes": [
    { hash: "281bddf501bce233", captured_at: "2026-08-26T17:30:00Z", size: 12288, reason: "Manual capture", text: "Rina will send the revised schedule by Thursday. Omar will review the cost table." },
    { hash: "32ef7bc09ad3f814", captured_at: "2026-08-26T10:15:00Z", size: 11940, reason: "Initial capture", text: "Rina will send the revised schedule by Friday." }
  ]
};

const icon = (name: "archive" | "plus" | "restore" | "file" | "check") => {
  const paths = {
    archive: '<path d="M4 7.5h16v13H4zM3 3.5h18v4H3zM9 12h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    restore: '<path d="M5 9H2V3m1 5a9 9 0 1 1-1 7"/>',
    file: '<path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6"/>',
    check: '<path d="m4 12 5 5L20 6"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
};

function shell(): void {
  app.innerHTML = `
    <header class="app-header">
      <a class="wordmark" href="/" aria-label="Document History Bridge home">${icon("archive")}<span>Document History<br><b>Bridge</b></span></a>
      <div class="header-status"><span class="pulse" aria-hidden="true"></span><span>Local archive</span></div>
      <button class="quiet-button" id="license-button">${hasArchiveLicense() ? "Archive license active" : "Unlock unlimited"}</button>
    </header>
    <aside class="demo-banner" id="demo-banner" ${state.demo ? "" : "hidden"}><strong>Demo — sample data, nothing is saved</strong><button id="reset-demo">Reset demo</button><button id="start-real">Start for real</button></aside>
    <main id="main" tabindex="-1">
      <section class="mast" aria-labelledby="page-title">
        <p class="kicker">Private document record · on this device</p>
        <h1 id="page-title">What changed,<br><em>and when?</em></h1>
        <p class="lede">A readable history for the office files that matter. Every snapshot stays on your computer.</p>
        <button class="primary-button" id="watch-folder">${icon("plus")} Watch a folder</button>
      </section>
      <section class="workspace" aria-label="Document archive">
        <aside class="file-rail" aria-labelledby="files-heading">
          <div class="section-heading"><div><span>01</span><h2 id="files-heading">Watched files</h2></div><button class="icon-button" id="refresh" aria-label="Refresh archive">↻</button></div>
          <div id="file-list" class="file-list"></div>
        </aside>
        <section class="history-panel" aria-labelledby="history-heading">
          <div class="section-heading"><div><span>02</span><h2 id="history-heading">History</h2></div><button class="quiet-button" id="capture">Capture now</button></div>
          <div id="history-list" class="history-list"></div>
        </section>
        <article class="preview-panel" aria-labelledby="preview-heading">
          <div class="section-heading"><div><span>03</span><h2 id="preview-heading">Change sheet</h2></div><span class="legend"><i></i> Added <s></s> Removed</span></div>
          <div id="preview" class="preview"></div>
        </article>
      </section>
    </main>
    <div id="notice" class="notice" role="status" aria-live="polite"></div>
    <dialog id="restore-dialog" aria-labelledby="restore-title">
      <form method="dialog">
        <p class="kicker">Exact-file recovery</p><h2 id="restore-title">Restore this version?</h2>
        <p id="restore-copy">The current original will be captured first, then replaced by the selected snapshot.</p>
        <div class="dialog-actions"><button value="cancel" class="quiet-button">Keep current file</button><button value="confirm" class="danger-button">Restore selected version</button></div>
      </form>
    </dialog>
    <dialog id="license-dialog" aria-labelledby="license-title">
      <form method="dialog" id="license-form">
        <p class="kicker">One-time purchase · $29</p><h2 id="license-title">Keep every chapter</h2>
        <p>Free includes one watched folder and 30 versions per file. Archive unlocks unlimited folders and snapshots—forever. Comparison, restore, and export are never gated.</p>
        <a class="primary-button button-link" href="${checkoutUrl}" target="_blank" rel="noreferrer">Buy Archive license</a>
        <label for="license-token">Have a license? Paste it here</label><input id="license-token" name="license" autocomplete="off" spellcheck="false">
        <p class="field-note" id="license-note" aria-live="polite"></p>
        <div class="dialog-actions"><button value="cancel" class="quiet-button">Close</button><button value="default" id="verify-license" class="ink-button">Verify license</button></div>
      </form>
    </dialog>
    <footer><span>No cloud. No telemetry. No altered originals.</span><span>Archive path is managed by your operating system.</span></footer>`;
  bind();
  renderFiles(); renderHistory(); renderPreview();
}

async function load(): Promise<void> {
  if (state.demo) { loadDemo(); return; }
  try {
    state.documents = await invoke<DocumentItem[]>("list_documents");
    const existing = state.selected && state.documents.find((d) => d.id === state.selected?.id);
    state.selected = existing || state.documents[0];
    if (state.selected) await loadVersions(state.selected);
  } catch (error) {
    showNotice(`Could not read the local archive. ${String(error)}`, true);
  }
  renderFiles(); renderHistory(); renderPreview();
}

async function loadVersions(document: DocumentItem): Promise<void> {
  if (state.demo) {
    state.versions = demoVersions[document.id] || [];
    state.current = state.versions[0];
    state.previous = state.versions[1];
    return;
  }
  state.versions = await invoke<Version[]>("list_versions", { documentPath: document.path });
  state.current = state.versions[0];
  state.previous = state.versions[1];
}

function renderFiles(): void {
  const target = document.querySelector<HTMLDivElement>("#file-list"); if (!target) return;
  if (!state.documents.length) {
    target.innerHTML = `<div class="empty"><span class="folio">No. 000</span>${icon("file")}<h3>No pages filed yet</h3><p>Choose a folder containing DOCX, ODT, PDF, or plain-text documents. Existing files are captured immediately.</p><button class="text-button" data-action="demo">Load sample project →</button><button class="text-button" data-action="watch">Choose a folder →</button></div>`;
    target.querySelector<HTMLButtonElement>("[data-action=demo]")?.addEventListener("click", enterDemo);
    target.querySelector<HTMLButtonElement>("[data-action=watch]")?.addEventListener("click", chooseFolder);
    return;
  }
  target.innerHTML = state.documents.map((doc) => `<button class="file-row ${doc.id === state.selected?.id ? "selected" : ""}" data-id="${escapeHtml(doc.id)}" aria-pressed="${doc.id === state.selected?.id}">
    <span class="file-mark">${escapeHtml(doc.extension.toUpperCase().slice(1, 4))}</span><span><b>${escapeHtml(doc.name)}</b><small>${doc.version_count} version${doc.version_count === 1 ? "" : "s"} · ${formatBytes(doc.size)}</small></span><time>${new Date(doc.latest_at).toLocaleDateString()}</time>
  </button>`).join("");
  target.querySelectorAll<HTMLButtonElement>(".file-row").forEach((button) => button.addEventListener("click", async () => {
    state.selected = state.documents.find((item) => item.id === button.dataset.id); if (state.selected) await loadVersions(state.selected); renderFiles(); renderHistory(); renderPreview();
  }));
}

function renderHistory(): void {
  const target = document.querySelector<HTMLDivElement>("#history-list"); if (!target) return;
  if (!state.selected) { target.innerHTML = `<div class="blank-column"><p>Select a watched folder to begin a chronological record.</p></div>`; return; }
  if (!state.versions.length) { target.innerHTML = `<div class="blank-column"><p>This file has no readable snapshots yet.</p></div>`; return; }
  target.innerHTML = `<ol>${state.versions.map((version, index) => `<li><button class="version-row ${version.hash === state.current?.hash ? "selected" : ""}" data-index="${index}" aria-pressed="${version.hash === state.current?.hash}"><span class="timeline-dot"></span><span><b>${index === 0 ? "Latest capture" : formatDate(version.captured_at)}</b><small>${version.reason} · ${formatBytes(version.size)}</small></span><code>${version.hash.slice(0, 8)}</code></button></li>`).join("")}</ol>`;
  target.querySelectorAll<HTMLButtonElement>(".version-row").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.index); state.current = state.versions[index]; state.previous = state.versions[index + 1]; renderHistory(); renderPreview();
  }));
}

function renderPreview(): void {
  const target = document.querySelector<HTMLDivElement>("#preview"); if (!target) return;
  if (!state.current || !state.selected) { target.innerHTML = `<div class="empty preview-empty"><span class="folio">Change sheet</span><h3>Your comparison will appear here</h3><p>Pick a document and a snapshot to see readable text and table changes.</p></div>`; return; }
  const warning = state.current.extraction_warning ? `<p class="margin-warning"><b>Preview note:</b> ${escapeHtml(state.current.extraction_warning)}</p>` : "";
  const content = state.previous ? textDiff(state.previous.text, state.current.text).map((part) => `<${part.kind === "removed" ? "del" : part.kind === "added" ? "ins" : "span"}>${escapeHtml(part.text)} </${part.kind === "removed" ? "del" : part.kind === "added" ? "ins" : "span"}>`).join("") : escapeHtml(state.current.text || "No extractable text in this snapshot.");
  target.innerHTML = `<header class="sheet-header"><div><span>${escapeHtml(state.selected.extension.slice(1).toUpperCase())} · ${formatBytes(state.current.size)}</span><h3>${escapeHtml(state.selected.name)}</h3></div><time>${formatDate(state.current.captured_at)}</time></header>${warning}<div class="document-text" tabindex="0">${content}</div><div class="restore-bar"><span>${icon("check")} Exact file preserved</span><button class="restore-button">${icon("restore")} Restore this version</button></div>`;
  target.querySelector<HTMLButtonElement>(".restore-button")?.addEventListener("click", openRestoreDialog);
}

async function chooseFolder(): Promise<void> {
  if (state.demo) leaveDemo();
  try {
    const selected = await open({ directory: true, multiple: false, title: "Choose a folder to watch" });
    if (!selected) return;
    state.busy = true; showNotice("Capturing existing documents…");
    await invoke("watch_folder", { folderPath: selected });
    await load(); showNotice("Folder is watched. Existing documents were captured.");
  } catch (error) { showNotice(`Folder could not be watched. ${String(error)}`, true); }
  finally { state.busy = false; }
}

async function capture(): Promise<void> {
  if (state.demo) { showNotice("Sample project checked. No data was saved."); return; }
  try { showNotice("Checking watched folders…"); await invoke("capture_all"); await load(); showNotice("Archive is up to date."); }
  catch (error) { showNotice(`Capture failed. Originals were not changed. ${String(error)}`, true); }
}

function openRestoreDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>("#restore-dialog")!;
  dialog.showModal(); dialog.querySelector<HTMLButtonElement>("button[value=cancel]")?.focus();
}

async function restore(): Promise<void> {
  if (!state.selected || !state.current) return;
  if (state.demo) { showNotice("Sample restored. No file on your computer was changed."); return; }
  try {
    showNotice("Making a safety snapshot, then restoring…");
    await invoke("restore_version", { documentPath: state.selected.path, hash: state.current.hash });
    await load(); showNotice("Version restored. The replaced file was captured first.");
  } catch (error) { showNotice(`Restore stopped safely. ${String(error)}`, true); }
}

function openLicenseDialog(): void { document.querySelector<HTMLDialogElement>("#license-dialog")!.showModal(); }

function bind(): void {
  document.querySelector("#watch-folder")?.addEventListener("click", chooseFolder);
  document.querySelector("#refresh")?.addEventListener("click", load);
  document.querySelector("#capture")?.addEventListener("click", capture);
  document.querySelector("#license-button")?.addEventListener("click", openLicenseDialog);
  document.querySelector("#reset-demo")?.addEventListener("click", enterDemo);
  document.querySelector("#start-real")?.addEventListener("click", leaveDemo);
  document.querySelector<HTMLDialogElement>("#restore-dialog")?.addEventListener("close", (event) => { if ((event.target as HTMLDialogElement).returnValue === "confirm") restore(); });
  document.querySelector("#verify-license")?.addEventListener("click", async (event) => {
    event.preventDefault(); const input = document.querySelector<HTMLInputElement>("#license-token")!; const note = document.querySelector("#license-note")!;
    if (!input.value.trim()) { note.textContent = "Paste the license token from your receipt."; return; }
    saveLicense(input.value); note.textContent = "Checking license…"; const valid = await verifyLicense(); await invoke("set_license_status", { valid }); note.textContent = valid ? "License active. Unlimited archiving is ready." : "That license is not active. Check the token and try again.";
    document.querySelector("#license-button")!.textContent = valid ? "Archive license active" : "Unlock unlimited";
  });
}

function loadDemo(): void {
  state.documents = demoDocuments;
  state.selected = demoDocuments[0];
  state.versions = demoVersions[state.selected.id];
  state.current = state.versions[0];
  state.previous = state.versions[1];
  renderFiles(); renderHistory(); renderPreview();
}

function enterDemo(): void {
  state.demo = true;
  document.querySelector<HTMLElement>("#demo-banner")?.removeAttribute("hidden");
  loadDemo();
  showNotice("Sample project loaded. Nothing is saved to your archive.");
}

function leaveDemo(): void {
  state.demo = false;
  state.documents = []; state.selected = undefined; state.versions = []; state.current = undefined; state.previous = undefined;
  document.querySelector<HTMLElement>("#demo-banner")?.setAttribute("hidden", "");
  renderFiles(); renderHistory(); renderPreview();
  showNotice("Demo closed. Choose a folder to start your own archive.");
}

function showNotice(message: string, error = false): void {
  const notice = document.querySelector<HTMLDivElement>("#notice"); if (!notice) return;
  notice.textContent = message; notice.classList.toggle("error", error); notice.classList.add("visible"); window.setTimeout(() => notice.classList.remove("visible"), 5000);
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!); }

acceptLicenseFromUrl(); shell(); verifyLicense().then(async (valid) => { await invoke("set_license_status", { valid }); document.querySelector("#license-button")!.textContent = hasArchiveLicense() ? "Archive license active" : "Unlock unlimited"; }).catch(() => {}); load(); window.setInterval(load, 8000);
