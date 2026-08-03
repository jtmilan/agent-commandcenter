//! Agent Command Center — Tauri host stubs.
//! Wire real PTY / git worktree implementations here.
//! Commands match `src/lib/agent-bridge.ts` invoke names.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct JobStore(Mutex<HashMap<String, u32>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    pane_id: String,
    harness: String,
    cmd: String,
    cwd: String,
    worktree: Option<String>,
    role: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnResult {
    job_id: String,
    pid: Option<u32>,
}

#[tauri::command]
fn spawn_agent(req: SpawnRequest, store: State<JobStore>) -> Result<SpawnResult, String> {
    // TODO: spawn PTY with req.cmd in req.cwd / worktree
    let job_id = format!("job_{}", req.pane_id);
    let pid = 0u32; // placeholder
    store
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(job_id.clone(), pid);
    let _ = (req.harness, req.cmd, req.cwd, req.worktree, req.role);
    Ok(SpawnResult {
        job_id,
        pid: Some(pid),
    })
}

#[tauri::command]
fn kill_agent(job_id: String, store: State<JobStore>) -> Result<bool, String> {
    let mut map = store.0.lock().map_err(|e| e.to_string())?;
    Ok(map.remove(&job_id).is_some())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeCreate {
    root: String,
    path: String,
    branch: String,
}

#[tauri::command]
fn worktree_create(req: WorktreeCreate) -> Result<(), String> {
    // TODO: git worktree add — path must be under allowed roots (capabilities)
    if !req.path.starts_with(&req.root) {
        return Err("path_not_in_allowed_roots".into());
    }
    let _ = req.branch;
    Ok(())
}

#[tauri::command]
fn worktree_destroy(path: String, force: bool) -> Result<(), String> {
    // TODO: git worktree remove — confirm force for dirty trees
    let _ = (path, force);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(JobStore::default())
        .invoke_handler(tauri::generate_handler![
            spawn_agent,
            kill_agent,
            worktree_create,
            worktree_destroy
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agent Command Center");
}
