use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

const MAX_FILE_BYTES: u64 = 250 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct ArchiveManifest {
    watched_folders: Vec<String>,
    documents: BTreeMap<String, DocumentRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DocumentRecord {
    versions: Vec<Version>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Version {
    hash: String,
    captured_at: DateTime<Utc>,
    size: u64,
    text: String,
    reason: String,
    extraction_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DocumentItem {
    id: String,
    name: String,
    path: String,
    extension: String,
    latest_at: DateTime<Utc>,
    version_count: usize,
    size: u64,
    status: String,
}

#[derive(Default)]
struct AppState {
    capture_lock: Arc<Mutex<()>>,
    archive_licensed: Arc<AtomicBool>,
}

fn archive_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(path.join("objects"))
        .map_err(|e| format!("Archive directory could not be created: {e}"))?;
    Ok(path)
}

fn manifest_path(root: &Path) -> PathBuf {
    root.join("manifest.json")
}

fn read_manifest(root: &Path) -> Result<ArchiveManifest, String> {
    let path = manifest_path(root);
    if !path.exists() {
        return Ok(ArchiveManifest::default());
    }
    let bytes = fs::read(&path).map_err(|e| format!("Archive index could not be read: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Archive index is damaged: {e}"))
}

fn write_manifest(root: &Path, manifest: &ArchiveManifest) -> Result<(), String> {
    let path = manifest_path(root);
    let temp = root.join("manifest.next.json");
    let bytes = serde_json::to_vec_pretty(manifest).map_err(|e| e.to_string())?;
    let mut file =
        File::create(&temp).map_err(|e| format!("Archive index could not be updated: {e}"))?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("Archive index could not be saved: {e}"))?;
    #[cfg(not(target_os = "windows"))]
    {
        fs::rename(temp, path).map_err(|e| format!("Archive index could not be committed: {e}"))
    }
    #[cfg(target_os = "windows")]
    {
        let backup = root.join("manifest.previous.json");
        if path.exists() {
            fs::rename(&path, &backup)
                .map_err(|e| format!("Archive index could not be staged: {e}"))?;
        }
        if let Err(error) = fs::rename(&temp, &path) {
            let _ = fs::rename(&backup, &path);
            return Err(format!("Archive index update was rolled back: {error}"));
        }
        if backup.exists() {
            let _ = fs::remove_file(backup);
        }
        Ok(())
    }
}

fn supported(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|v| v.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "docx" | "odt" | "pdf" | "txt" | "md" | "rtf"
    )
}

fn strip_xml(xml: &str, format: &str) -> String {
    let mut value = xml.to_owned();
    if format == "docx" {
        value = value
            .replace("</w:tc>", "\t")
            .replace("</w:tr>", "\n")
            .replace("</w:p>", "\n");
    } else {
        value = value
            .replace("</table:table-cell>", "\t")
            .replace("</table:table-row>", "\n")
            .replace("</text:p>", "\n");
    }
    let tags = Regex::new(r"<[^>]+>").expect("static regex");
    let spaces = Regex::new(r"[ \t]{2,}").expect("static regex");
    let lines = Regex::new(r"\n{3,}").expect("static regex");
    let without_tags = tags.replace_all(&value, "");
    let unescaped = html_escape::decode_html_entities(&without_tags);
    lines
        .replace_all(&spaces.replace_all(&unescaped, " "), "\n\n")
        .trim()
        .to_owned()
}

fn extract_zip_xml(bytes: &[u8], entry: &str, format: &str) -> Result<String, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|_| {
        format!(
            "{format_upper} preview unavailable; the file may be encrypted or damaged.",
            format_upper = format.to_uppercase()
        )
    })?;
    let mut file = archive.by_name(entry).map_err(|_| {
        format!(
            "{format_upper} preview data is missing; the exact file is still preserved.",
            format_upper = format.to_uppercase()
        )
    })?;
    let mut xml = String::new();
    file.read_to_string(&mut xml).map_err(|_| {
        format!(
            "{format_upper} text could not be decoded; the exact file is still preserved.",
            format_upper = format.to_uppercase()
        )
    })?;
    Ok(strip_xml(&xml, format))
}

fn extract_text(path: &Path, bytes: &[u8]) -> (String, Option<String>) {
    let extension = path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "docx" => match extract_zip_xml(bytes, "word/document.xml", "docx") { Ok(v) => (v, None), Err(e) => (String::new(), Some(e)) },
        "odt" => match extract_zip_xml(bytes, "content.xml", "odt") { Ok(v) => (v, None), Err(e) => (String::new(), Some(e)) },
        "pdf" => match pdf_extract::extract_text_from_mem(bytes) { Ok(v) => (v.trim().to_owned(), None), Err(_) => (String::new(), Some("PDF text preview is unavailable; it may be encrypted or image-only. The exact file is still preserved.".into())) },
        "rtf" => {
            let raw = String::from_utf8_lossy(bytes);
            let controls = Regex::new(r"\\[a-z]+-?\d* ?|[{}]").expect("static regex");
            (controls.replace_all(&raw, "").trim().to_owned(), None)
        },
        _ => (String::from_utf8_lossy(bytes).to_string(), None),
    }
}

fn capture_file(
    root: &Path,
    manifest: &mut ArchiveManifest,
    path: &Path,
    reason: &str,
    version_limit: Option<usize>,
) -> Result<bool, String> {
    if !supported(path) || !path.is_file() {
        return Ok(false);
    }
    let metadata = fs::metadata(path)
        .map_err(|e| format!("{} could not be inspected: {e}", path.display()))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "{} exceeds the 250 MB safety limit.",
            path.display()
        ));
    }
    let bytes = fs::read(path).map_err(|e| format!("{} could not be read: {e}", path.display()))?;
    let hash = hex::encode(Sha256::digest(&bytes));
    let key = path.to_string_lossy().to_string();
    if manifest
        .documents
        .get(&key)
        .and_then(|d| d.versions.first())
        .map(|v| &v.hash)
        == Some(&hash)
    {
        return Ok(false);
    }
    let object = root.join("objects").join(&hash);
    if !object.exists() {
        let temp = root.join("objects").join(format!(".{hash}.part"));
        let mut output =
            File::create(&temp).map_err(|e| format!("Snapshot could not be created: {e}"))?;
        output
            .write_all(&bytes)
            .and_then(|_| output.sync_all())
            .map_err(|e| format!("Snapshot could not be completed: {e}"))?;
        fs::rename(temp, object).map_err(|e| format!("Snapshot could not be filed: {e}"))?;
    }
    let (text, warning) = extract_text(path, &bytes);
    let version = Version {
        hash,
        captured_at: Utc::now(),
        size: bytes.len() as u64,
        text,
        reason: reason.into(),
        extraction_warning: warning,
    };
    let versions = &mut manifest
        .documents
        .entry(key)
        .or_insert_with(|| DocumentRecord {
            versions: Vec::new(),
        })
        .versions;
    versions.insert(0, version);
    if let Some(limit) = version_limit {
        versions.truncate(limit);
    }
    Ok(true)
}

fn capture_all_inner(root: &Path, licensed: bool) -> Result<usize, String> {
    let mut manifest = read_manifest(root)?;
    let mut changed = 0;
    let folders = manifest.watched_folders.clone();
    for folder in folders {
        let folder_path = Path::new(&folder);
        if !folder_path.exists() {
            continue;
        }
        for entry in WalkDir::new(folder_path)
            .follow_links(false)
            .max_depth(12)
            .into_iter()
            .filter_map(Result::ok)
        {
            match capture_file(
                root,
                &mut manifest,
                entry.path(),
                "Folder change",
                (!licensed).then_some(30),
            ) {
                Ok(true) => changed += 1,
                Ok(false) => {}
                Err(_) => {}
            }
        }
    }
    if changed > 0 {
        write_manifest(root, &manifest)?;
    }
    Ok(changed)
}

#[tauri::command]
fn watch_folder(
    app: AppHandle,
    state: tauri::State<AppState>,
    folder_path: String,
) -> Result<usize, String> {
    let folder =
        fs::canonicalize(&folder_path).map_err(|e| format!("That folder cannot be opened: {e}"))?;
    if !folder.is_dir() {
        return Err("Choose a folder, not a file.".into());
    }
    let _guard = state
        .capture_lock
        .lock()
        .map_err(|_| "Archive is busy.".to_string())?;
    let root = archive_dir(&app)?;
    let mut manifest = read_manifest(&root)?;
    let folder_string = folder.to_string_lossy().to_string();
    if !state.archive_licensed.load(Ordering::Relaxed)
        && !manifest.watched_folders.contains(&folder_string)
        && !manifest.watched_folders.is_empty()
    {
        return Err(
            "The free edition watches one folder. Activate an Archive license to add another."
                .into(),
        );
    }
    if !manifest.watched_folders.contains(&folder_string) {
        manifest.watched_folders.push(folder_string);
    }
    let mut changed = 0;
    for entry in WalkDir::new(&folder)
        .follow_links(false)
        .max_depth(12)
        .into_iter()
        .filter_map(Result::ok)
    {
        if capture_file(
            &root,
            &mut manifest,
            entry.path(),
            "Initial capture",
            (!state.archive_licensed.load(Ordering::Relaxed)).then_some(30),
        )? {
            changed += 1;
        }
    }
    write_manifest(&root, &manifest)?;
    Ok(changed)
}

#[tauri::command]
fn capture_all(app: AppHandle, state: tauri::State<AppState>) -> Result<usize, String> {
    let _guard = state
        .capture_lock
        .lock()
        .map_err(|_| "Archive is busy.".to_string())?;
    capture_all_inner(
        &archive_dir(&app)?,
        state.archive_licensed.load(Ordering::Relaxed),
    )
}

#[tauri::command]
fn set_license_status(state: tauri::State<AppState>, valid: bool) {
    state.archive_licensed.store(valid, Ordering::Relaxed);
}

#[tauri::command]
fn list_documents(app: AppHandle) -> Result<Vec<DocumentItem>, String> {
    let root = archive_dir(&app)?;
    let manifest = read_manifest(&root)?;
    let mut items: Vec<_> = manifest
        .documents
        .into_iter()
        .filter_map(|(path, record)| {
            let latest = record.versions.first()?;
            let source = Path::new(&path);
            let name = source.file_name()?.to_string_lossy().to_string();
            let extension = source
                .extension()
                .map(|v| format!(".{}", v.to_string_lossy().to_ascii_lowercase()))
                .unwrap_or_default();
            let status = if source.exists() {
                "available".into()
            } else {
                "missing".into()
            };
            Some(DocumentItem {
                id: hex::encode(Sha256::digest(path.as_bytes()))[..16].into(),
                name,
                extension,
                path,
                latest_at: latest.captured_at,
                version_count: record.versions.len(),
                size: latest.size,
                status,
            })
        })
        .collect();
    items.sort_by(|a, b| b.latest_at.cmp(&a.latest_at));
    Ok(items)
}

#[tauri::command]
fn list_versions(app: AppHandle, document_path: String) -> Result<Vec<Version>, String> {
    let root = archive_dir(&app)?;
    Ok(read_manifest(&root)?
        .documents
        .get(&document_path)
        .map(|r| r.versions.clone())
        .unwrap_or_default())
}

#[tauri::command]
fn restore_version(
    app: AppHandle,
    state: tauri::State<AppState>,
    document_path: String,
    hash: String,
) -> Result<(), String> {
    let _guard = state
        .capture_lock
        .lock()
        .map_err(|_| "Archive is busy.".to_string())?;
    restore_version_inner(&archive_dir(&app)?, &document_path, &hash)
}

fn restore_version_inner(root: &Path, document_path: &str, hash: &str) -> Result<(), String> {
    let original = PathBuf::from(&document_path);
    if !original.exists() {
        return Err("The original file is missing. Put it back in place, then try again.".into());
    }
    let mut manifest = read_manifest(&root)?;
    let known = manifest
        .documents
        .get(document_path)
        .map(|r| r.versions.iter().any(|v| v.hash == hash))
        .unwrap_or(false);
    if !known {
        return Err("That snapshot is not in this document's history.".into());
    }
    capture_file(
        &root,
        &mut manifest,
        &original,
        "Pre-restore safety capture",
        None,
    )?;
    write_manifest(&root, &manifest)?;
    let object = root.join("objects").join(hash);
    let parent = original.parent().ok_or("The file has no parent folder.")?;
    let temp = parent.join(format!(".dhb-restore-{hash}.tmp"));
    fs::copy(&object, &temp).map_err(|e| format!("Restored copy could not be prepared: {e}"))?;
    if let Ok(permissions) = fs::metadata(&original).map(|v| v.permissions()) {
        let _ = fs::set_permissions(&temp, permissions);
    }
    let rollback = parent.join(format!(".dhb-rollback-{}", Utc::now().timestamp_millis()));
    fs::rename(&original, &rollback)
        .map_err(|e| format!("The current file could not be moved safely: {e}"))?;
    if let Err(error) = fs::rename(&temp, &original) {
        let _ = fs::rename(&rollback, &original);
        let _ = fs::remove_file(&temp);
        return Err(format!(
            "Restore was rolled back because the replacement failed: {error}"
        ));
    }
    fs::remove_file(&rollback).map_err(|e| {
        format!("Restore succeeded, but its temporary rollback file could not be removed: {e}")
    })?;
    let mut refreshed = read_manifest(&root)?;
    capture_file(&root, &mut refreshed, &original, "Restored version", None)?;
    write_manifest(&root, &refreshed)
}

fn start_polling(app: AppHandle, lock: Arc<Mutex<()>>, licensed: Arc<AtomicBool>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(4));
        if let Ok(_guard) = lock.try_lock() {
            if let Ok(root) = archive_dir(&app) {
                let _ = capture_all_inner(&root, licensed.load(Ordering::Relaxed));
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            let state = app.state::<AppState>();
            start_polling(
                app.handle().clone(),
                state.capture_lock.clone(),
                state.archive_licensed.clone(),
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            watch_folder,
            capture_all,
            list_documents,
            list_versions,
            restore_version,
            set_license_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Document History Bridge");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_docx_tables_and_paragraphs() {
        let xml = "<w:document><w:p><w:r><w:t>Hello</w:t></w:r></w:p><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:document>";
        let text = strip_xml(xml, "docx");
        assert!(text.contains("Hello"));
        assert!(text.contains('A'));
        assert!(text.contains('B'));
        assert!(text.contains('\t'));
    }

    #[test]
    fn supported_formats_are_explicit() {
        assert!(supported(Path::new("report.docx")));
        assert!(supported(Path::new("report.odt")));
        assert!(supported(Path::new("report.PDF")));
        assert!(supported(Path::new("notes.rtf")));
        assert!(supported(Path::new("notes.md")));
        assert!(supported(Path::new("notes.txt")));
        assert!(!supported(Path::new("sheet.xlsx")));
    }

    #[test]
    fn claim_native_history_restores_exact_bytes_and_keeps_current_version() {
        let unique = format!(
            "dhb-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let root = std::env::temp_dir().join(unique);
        let objects = root.join("objects");
        fs::create_dir_all(&objects).unwrap();
        let document = root.join("proposal.txt");
        fs::write(&document, b"Payment due in thirty days").unwrap();
        let mut manifest = ArchiveManifest::default();
        capture_file(&root, &mut manifest, &document, "Initial capture", Some(30)).unwrap();
        let first_hash = manifest.documents.values().next().unwrap().versions[0]
            .hash
            .clone();
        fs::write(&document, b"Payment due in forty-five days").unwrap();
        write_manifest(&root, &manifest).unwrap();

        restore_version_inner(&root, document.to_str().unwrap(), &first_hash).unwrap();

        assert_eq!(fs::read(&document).unwrap(), b"Payment due in thirty days");
        let after = read_manifest(&root).unwrap();
        let versions = &after.documents.values().next().unwrap().versions;
        assert!(versions
            .iter()
            .any(|version| version.reason == "Pre-restore safety capture"));
        assert_eq!(versions[0].hash, first_hash);
        fs::remove_dir_all(root).unwrap();
    }
}
