// === Admin / Marketing tab =============================================
// Queue manager for scheduled Instagram/Threads posts (marketingPosts).
// Creatives come from the Storage `marketing/` prefix (uploaded public by
// scripts/upload-marketing-assets.cjs) via a thumbnail picker, or any
// pasted https URL. The Cloud Functions publisher picks up `queued` docs
// whose scheduledAt has passed — until the Meta tokens are configured,
// queued posts simply wait (status stays `queued`).
//
// English-only by design, like the rest of /admin.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Plus, Pencil, Trash2, X } from 'lucide-react';
import { AdminService } from '../services/admin-service.js';

const STATUS_COLOR = {
  queued: 'var(--accent)',
  published: 'var(--success, #2e7d4f)',
  failed: 'var(--error)',
  canceled: 'var(--text-muted)',
};

const fmtWhen = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time; Date#toISOString
// would shift to UTC and silently move the schedule.
const toLocalInput = (ms) => {
  const d = ms ? new Date(ms) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function PostForm({ initial, assets, onSaved, onClose }) {
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [caption, setCaption] = useState(initial?.caption || '');
  const [targets, setTargets] = useState(initial?.targets || ['instagram']);
  const [when, setWhen] = useState(toLocalInput(initial?.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (t) => setTargets((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const save = async () => {
    setErr('');
    if (!imageUrl) return setErr('Pick or paste an image URL.');
    if (!caption.trim()) return setErr('Caption is required.');
    if (!targets.length) return setErr('Pick at least one target.');
    const ts = new Date(when).getTime();
    if (Number.isNaN(ts)) return setErr('Invalid schedule time.');
    setBusy(true);
    try {
      await AdminService.marketingUpsert({
        id: initial?.id,
        imageUrl,
        caption: caption.trim(),
        targets,
        scheduledAt: new Date(ts).toISOString(),
      });
      onSaved();
    } catch (e) {
      setErr(e.message || 'save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-card admk-form">
      <div className="adm-card-head">
        <span>{initial?.id ? 'Edit post' : 'New post'}</span>
        <button className="adm-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="admk-formgrid">
        <div>
          <div className="admk-label">Creative</div>
          {imageUrl
            ? <img className="admk-preview" src={imageUrl} alt="" />
            : <div className="admk-preview admk-preview-empty">no image</div>}
          <input
            className="adm-search admk-url"
            placeholder="https:// image url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          {!!assets.length && (
            <div className="admk-assets">
              {assets.map((a) => (
                <button
                  key={a.path}
                  className={a.url === imageUrl ? 'on' : ''}
                  title={a.path}
                  onClick={() => setImageUrl(a.url)}
                >
                  <img src={a.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="admk-fields">
          <div className="admk-label">Caption</div>
          <textarea
            className="admk-caption"
            rows={8}
            maxLength={2200}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={'Hook line…\n\nBody + hashtags'}
          />
          <div className="adm-muted">{caption.length}/2200</div>

          <div className="admk-label">Targets</div>
          <div className="admk-targets">
            {['instagram', 'threads'].map((t) => (
              <button key={t} className={targets.includes(t) ? 'on' : ''} onClick={() => toggle(t)}>{t}</button>
            ))}
          </div>

          <div className="admk-label">Publish at (local time)</div>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />

          {err && <div className="adm-err admk-err">{err}</div>}
          <button className="adm-btn admk-save" disabled={busy} onClick={save}>
            {busy ? <Loader2 size={14} className="spin" /> : null} {initial?.id ? 'Save changes' : 'Add to queue'}
          </button>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ['all', 'queued', 'published', 'failed'];

export function MarketingTab() {
  const [posts, setPosts] = useState(null);
  const [assets, setAssets] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | post (edit)
  const [filter, setFilter] = useState('all');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true); setErr('');
    Promise.all([AdminService.marketingList(), AdminService.marketingAssets().catch(() => [])])
      .then(([p, a]) => { setPosts(p); setAssets(a); })
      .catch((e) => setErr(e.message || 'failed'))
      .finally(() => setBusy(false));
  };
  useEffect(load, []);

  const remove = async (id) => {
    if (!window.confirm('Delete this queued post?')) return;
    try { await AdminService.marketingDelete(id); load(); } catch (e) { setErr(e.message || 'delete failed'); }
  };

  const counts = useMemo(() => {
    const c = { queued: 0, published: 0, failed: 0 };
    (posts || []).forEach((p) => { if (c[p.status] != null) c[p.status] += 1; });
    return c;
  }, [posts]);

  if (err && !posts) return <div className="adm-err">{err}</div>;
  if (!posts) return <div className="adm-loading"><Loader2 className="spin" /> loading queue…</div>;

  const shown = filter === 'all' ? posts : posts.filter((p) => p.status === filter);

  return (
    <>
      <style>{MARKETING_CSS}</style>
      <div className="adm-toolbar">
        <div className="adm-seg">
          {FILTERS.map((f) => (
            <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
              {f}{f === 'queued' ? ` ${counts.queued}` : f === 'published' ? ` ${counts.published}` : f === 'failed' && counts.failed ? ` ${counts.failed}` : ''}
            </button>
          ))}
        </div>
        <div className="admk-actions">
          <button className="adm-btn" onClick={load} disabled={busy}><RefreshCw size={14} /> Refresh</button>
          <button className="adm-btn" onClick={() => setEditing({})}><Plus size={14} /> New post</button>
        </div>
      </div>

      {err && <div className="adm-err">{err}</div>}
      {editing && (
        <PostForm
          initial={editing.id ? editing : null}
          assets={assets}
          onSaved={() => { setEditing(null); load(); }}
          onClose={() => setEditing(null)}
        />
      )}

      {!shown.length && !editing && <div className="adm-muted admk-empty">{filter === 'all' ? 'Queue is empty — add the launch kit posts.' : `No ${filter} posts.`}</div>}

      <div className="admk-list">
        {shown.map((p) => (
          <div key={p.id} className="admk-row">
            <img className="admk-thumb" src={p.imageUrl} alt="" loading="lazy" />
            <div className="admk-body">
              <div className="admk-meta">
                <span className="admk-status" style={{ color: STATUS_COLOR[p.status] || 'inherit' }}>{p.status}</span>
                <span className="adm-muted">{fmtWhen(p.scheduledAt)}</span>
                {p.targets.map((t) => <span key={t} className="admk-chip">{t}</span>)}
              </div>
              <div className="admk-cap">{p.caption}</div>
              {p.status === 'failed' && p.results && (
                <div className="adm-muted admk-failmsg">{JSON.stringify(p.results)}</div>
              )}
            </div>
            {p.status !== 'published' && (
              <div className="admk-rowactions">
                <button className="adm-btn" title="Edit" onClick={() => setEditing(p)}><Pencil size={13} /></button>
                <button className="adm-btn" title="Delete" onClick={() => remove(p.id)}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

const MARKETING_CSS = `
.admk-actions{display:flex;gap:6px}
.admk-empty{padding:24px 0}
.admk-form{margin-bottom:16px}
.admk-formgrid{display:grid;grid-template-columns:280px 1fr;gap:16px}
@media (max-width:700px){.admk-formgrid{grid-template-columns:1fr}}
.admk-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin:10px 0 6px}
.admk-preview{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;background:var(--surface-elevated);border:1px solid var(--border)}
.admk-preview-empty{display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px}
.admk-url{width:100%;margin-top:8px}
.admk-assets{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px;max-height:180px;overflow-y:auto}
.admk-assets button{padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;cursor:pointer;background:none;aspect-ratio:4/5}
.admk-assets button.on{border-color:var(--accent)}
.admk-assets img{width:100%;height:100%;object-fit:cover;display:block}
.admk-fields{display:flex;flex-direction:column}
.admk-caption{width:100%;border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;font-family:var(--font-body);resize:vertical}
.admk-targets{display:flex;gap:6px}
.admk-targets button{border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer}
.admk-targets button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.admk-fields input[type=datetime-local]{border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:var(--font-body);width:fit-content}
.admk-err{padding:8px 0}
.admk-save{margin-top:14px;width:fit-content;background:var(--accent);border-color:var(--accent);color:#fff}
.admk-list{display:flex;flex-direction:column;gap:8px}
.admk-row{display:flex;gap:12px;border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--surface)}
.admk-thumb{width:72px;height:90px;border-radius:8px;object-fit:cover;background:var(--surface-elevated);flex:none}
.admk-body{flex:1;min-width:0}
.admk-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admk-status{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.admk-chip{font-size:11px;border:1px solid var(--border);border-radius:20px;padding:2px 8px;color:var(--text-secondary)}
.admk-cap{font-size:13px;margin-top:6px;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.admk-failmsg{margin-top:4px;word-break:break-all}
.admk-rowactions{display:flex;flex-direction:column;gap:6px;flex:none}
`;
