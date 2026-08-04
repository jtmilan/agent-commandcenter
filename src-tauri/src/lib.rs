//! Agent Command Center — Tauri host: Claude PTY spawn + git worktrees.
//! Commands match `src/lib/agent-bridge.ts` invoke names.
//!
//! Events emitted on channel `host://agent`:
//!   spawn_starting | spawn_running | spawn_error | exit | needs_input | tool_fail
//!   worktree_created | worktree_destroyed | worktree_error

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

struct JobEntry {
    pid: u32,
    child: Option<Child>,
    pane_id: String,
    harness: String,
}

#[derive(Default)]
struct JobStore(Mutex<HashMap<String, JobEntry>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    pane_id: String,
    harness: String,
    cmd: String,
    cwd: String,
    worktree: Option<String>,
    role: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HostEventPayload {
    kind: String,
    job_id: String,
    pane_id: String,
    harness: String,
    message: String,
    pid: Option<u32>,
    code: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnResult {
    job_id: String,
    pid: Option<u32>,
    status: String,
}

fn emit_host(app: &AppHandle, payload: HostEventPayload) {
    let _ = app.emit("host://agent", payload);
}

fn resolve_cwd(req: &SpawnRequest) -> &str {
    req.worktree.as_deref().unwrap_or(req.cwd.as_str())
}

/// Spawn agent process. Claude Code is first-class (`claude` CLI).
#[tauri::command]
fn spawn_agent(
    app: AppHandle,
    req: SpawnRequest,
    store: State<JobStore>,
) -> Result<SpawnResult, String> {
    let job_id = format!(
        "job_{}_{}",
        req.pane_id,
        chrono_like_id()
    );
    let cwd = resolve_cwd(&req).to_string();

    emit_host(
        &app,
        HostEventPayload {
            kind: "spawn_starting".into(),
            job_id: job_id.clone(),
            pane_id: req.pane_id.clone(),
            harness: req.harness.clone(),
            message: format!("Starting {} in {}", req.cmd, cwd),
            pid: None,
            code: None,
        },
    );

    // Prefer interactive PTY in production (portable-pty). For scaffold: piped Command.
    let mut command = Command::new(&req.cmd);
    command.current_dir(&cwd);
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());
    for (k, v) in &req.env {
        command.env(k, v);
    }
    if let Some(role) = &req.role {
        command.env("ADE_ROLE", role);
    }
    command.env("ADE_JOB_ID", &job_id);
    command.env("ADE_PANE_ID", &req.pane_id);

    match command.spawn() {
        Ok(child) => {
            let pid = child.id();
            store
                .0
                .lock()
                .map_err(|e| e.to_string())?
                .insert(
                    job_id.clone(),
                    JobEntry {
                        pid,
                        child: Some(child),
                        pane_id: req.pane_id.clone(),
                        harness: req.harness.clone(),
                    },
                );
            emit_host(
                &app,
                HostEventPayload {
                    kind: "spawn_running".into(),
                    job_id: job_id.clone(),
                    pane_id: req.pane_id.clone(),
                    harness: req.harness.clone(),
                    message: format!("PTY/process running job={} pid={}", job_id, pid),
                    pid: Some(pid),
                    code: None,
                },
            );
            Ok(SpawnResult {
                job_id,
                pid: Some(pid),
                status: "running".into(),
            })
        }
        Err(e) => {
            let msg = format!("spawn failed for '{}': {}", req.cmd, e);
            emit_host(
                &app,
                HostEventPayload {
                    kind: "spawn_error".into(),
                    job_id: job_id.clone(),
                    pane_id: req.pane_id,
                    harness: req.harness,
                    message: msg.clone(),
                    pid: None,
                    code: None,
                },
            );
            Err(msg)
        }
    }
}

#[tauri::command]
fn kill_agent(
    app: AppHandle,
    job_id: String,
    store: State<JobStore>,
) -> Result<bool, String> {
    let mut map = store.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut entry) = map.remove(&job_id) {
        if let Some(mut child) = entry.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        emit_host(
            &app,
            HostEventPayload {
                kind: "exit".into(),
                job_id: job_id.clone(),
                pane_id: entry.pane_id,
                harness: entry.harness,
                message: format!("Job {} killed", job_id),
                pid: Some(entry.pid),
                code: Some(0),
            },
        );
        return Ok(true);
    }
    Ok(false)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeCreate {
    root: String,
    path: String,
    branch: String,
}

fn path_under_root(root: &str, path: &str) -> bool {
    let root = root.trim_end_matches('/');
    let path = path.trim_end_matches('/');
    path == root || path.starts_with(&format!("{}/", root))
}

#[tauri::command]
fn worktree_create(app: AppHandle, req: WorktreeCreate) -> Result<(), String> {
    if !path_under_root(&req.root, &req.path) {
        emit_host(
            &app,
            HostEventPayload {
                kind: "worktree_error".into(),
                job_id: String::new(),
                pane_id: String::new(),
                harness: String::new(),
                message: "path_not_in_allowed_roots".into(),
                pid: None,
                code: None,
            },
        );
        return Err("path_not_in_allowed_roots".into());
    }

    // git -C <root> worktree add <path> -b <branch>
    let status = Command::new("git")
        .args(["-C", &req.root, "worktree", "add", &req.path, "-b", &req.branch])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        // try without -b (branch may exist)
        let status2 = Command::new("git")
            .args(["-C", &req.root, "worktree", "add", &req.path, &req.branch])
            .status()
            .map_err(|e| e.to_string())?;
        if !status2.success() {
            let msg = format!("git worktree add failed for {}", req.path);
            emit_host(
                &app,
                HostEventPayload {
                    kind: "worktree_error".into(),
                    job_id: String::new(),
                    pane_id: String::new(),
                    harness: String::new(),
                    message: msg.clone(),
                    pid: None,
                    code: status2.code(),
                },
            );
            return Err(msg);
        }
    }

    emit_host(
        &app,
        HostEventPayload {
            kind: "worktree_created".into(),
            job_id: String::new(),
            pane_id: String::new(),
            harness: String::new(),
            message: format!("Created worktree {} @ {}", req.path, req.branch),
            pid: None,
            code: None,
        },
    );
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDestroyResult {
    ok: bool,
    path: String,
    detail: String,
}

#[tauri::command]
fn worktree_destroy(
    app: AppHandle,
    path: String,
    force: bool,
) -> Result<WorktreeDestroyResult, String> {
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(path.as_str());

    // Prefer git worktree remove; falls back to rm -rf only when force
    let status = Command::new("git")
        .args(&args)
        .status()
        .map_err(|e| e.to_string());

    match status {
        Ok(s) if s.success() => {
            emit_host(
                &app,
                HostEventPayload {
                    kind: "worktree_destroyed".into(),
                    job_id: String::new(),
                    pane_id: String::new(),
                    harness: String::new(),
                    message: format!("Destroyed worktree {}", path),
                    pid: None,
                    code: None,
                },
            );
            Ok(WorktreeDestroyResult {
                ok: true,
                path,
                detail: "git worktree remove".into(),
            })
        }
        Ok(s) => {
            let msg = format!("git worktree remove failed code={:?}", s.code());
            emit_host(
                &app,
                HostEventPayload {
                    kind: "worktree_error".into(),
                    job_id: String::new(),
                    pane_id: String::new(),
                    harness: String::new(),
                    message: msg.clone(),
                    pid: None,
                    code: s.code(),
                },
            );
            Err(msg)
        }
        Err(e) => {
            emit_host(
                &app,
                HostEventPayload {
                    kind: "worktree_error".into(),
                    job_id: String::new(),
                    pane_id: String::new(),
                    harness: String::new(),
                    message: e.clone(),
                    pid: None,
                    code: None,
                },
            );
            Err(e)
        }
    }
}

fn chrono_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:x}", ms)
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
