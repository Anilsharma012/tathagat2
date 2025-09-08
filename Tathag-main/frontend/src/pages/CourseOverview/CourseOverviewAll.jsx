import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../components/LiveClasses/liveClasses.css';
import './CourseOverview.css';
import http from '../../utils/http';
import { fetchLiveClasses, createLiveClass } from '../../utils/liveClassesApi';

const pct = (n) => Math.max(0, Math.min(100, Math.round(Number(n||0))));

const CourseOverviewAll = () => {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [courses, setCourses] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sourceId, setSourceId] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [opts, setOpts] = useState({ copyStudents:true, copySchedules:true, copyContent:true, mergeIfExists:true });
  const [sending, setSending] = useState(false);

  useEffect(()=>{ (async()=>{
    try {
      setLoading(true);
      const res = await http.get('/courses');
      const list = (res.data?.courses || res.data || []).map(c => ({ id: c._id, title: c.name || c.title || '-', code: c.code || (c.slug||''), thumbnail: c.thumbnail || '' }));
      setCourses(list);
    } finally {
      setLoading(false);
    }
  })(); }, []);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c => (c.title||'').toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q));
  }, [courses, query]);

  const openSend = (id) => { setSourceId(id); setTargetId(''); setOpts({ copyStudents:true, copySchedules:true, copyContent:true, mergeIfExists:true }); setSendOpen(true); };
  const closeSend = () => setSendOpen(false);

  const onSend = async () => {
    if (!sourceId || !targetId) { alert('Pick a target course'); return; }
    try {
      setSending(true);
      // 1) Copy content via enhanced copy-structure
      if (opts.copyContent) {
        await http.post('/courses/copy-structure', { sourceCourseId: sourceId, targetCourseId: targetId, mode: opts.mergeIfExists ? 'MERGE' : 'OVERWRITE', includeSectionalTests: true });
      }

      // 2) Copy schedules (avoid duplicates by title+startTime)
      if (opts.copySchedules) {
        const srcItems = await fetchLiveClasses({ courseId: sourceId, role: 'admin' });
        const tgtItems = await fetchLiveClasses({ courseId: targetId, role: 'admin' });
        const has = new Set(tgtItems.map(it => `${(it.title||'').trim()}|${new Date(it.startTime).toISOString()}`));
        for (const it of srcItems) {
          const key = `${(it.title||'').trim()}|${new Date(it.startTime).toISOString()}`;
          if (opts.mergeIfExists && has.has(key)) continue;
          await createLiveClass({
            title: it.title,
            courseId: targetId,
            platform: it.platform,
            startTime: it.startTime,
            endTime: it.endTime,
            joinLink: it.joinLink || it.joinUrl || '',
            description: it.description || ''
          });
        }
      }

      // 3) Copy students (backend API not present)
      if (opts.copyStudents) {
        alert('Copying students is not yet supported by backend. Please ask to enable an enrollment copy API.');
      }

      closeSend();
      try { window.toast && window.toast.success && window.toast.success('Data sent'); } catch {}
      alert('Data sent to target course');
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="co-container">
      <div className="co-header">
        <div className="co-title-wrap">
          <div>
            <h1 className="lc-page-title">Course Overview (All)</h1>
            <div className="lc-muted">Student: {studentId || '—'}</div>
          </div>
        </div>
        <div className="lc-actions">
          <input className="lc-filter" placeholder="Search title/code" value={query} onChange={(e)=>setQuery(e.target.value)} />
          <button className="lc-btn" onClick={()=>navigate(-1)}>Back</button>
        </div>
      </div>

      <div className="lc-card-list co-cards-grid">
        {filtered.map(c => (
          <div key={c.id} className="lc-card">
            <div className="co-card-thumb-wrap" onClick={()=>navigate(`/overview/${c.id}/${studentId||'all'}`)}>
              {c.thumbnail ? <img src={c.thumbnail} alt={c.title} className="co-card-thumb" /> : <div className="co-thumb-fallback">{(c.title||'?').slice(0,1)}</div>}
            </div>
            <div className="lc-title" onClick={()=>navigate(`/overview/${c.id}/${studentId||'all'}`)}>{c.title}</div>
            <div className="lc-muted">{c.code || '—'}</div>
            <div className="co-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
              <div className="co-progress-fill" style={{ width: `${pct(0)}%` }} />
            </div>
            <div className="lc-card-actions" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
              <button className="lc-btn" onClick={()=>navigate(`/overview/${c.id}/${studentId||'all'}`)}>Open</button>
              <button className="lc-btn primary" onClick={()=>openSend(c.id)}>Send</button>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="lc-card"><div className="lc-muted">No courses</div></div>}
      </div>

      {sendOpen && (
        <div className="co-modal-backdrop" onClick={closeSend}>
          <div className="co-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="co-modal-header">
              <div className="lc-title">Send data from source</div>
              <button className="lc-close" onClick={closeSend}>×</button>
            </div>
            <div className="co-modal-body">
              <div className="lc-field">
                <label>Target Course</label>
                <select className="lc-filter" value={targetId} onChange={(e)=>setTargetId(e.target.value)}>
                  <option value="">Select target</option>
                  {courses.filter(x=>x.id!==sourceId).map(x=> (
                    <option key={x.id} value={x.id}>{x.title}</option>
                  ))}
                </select>
              </div>
              <div className="lc-field">
                <label>Options</label>
                <div className="co-checks">
                  <label className="co-check"><input type="checkbox" checked={opts.copyStudents} onChange={(e)=>setOpts({...opts, copyStudents:e.target.checked})} /> Copy students (needs backend)</label>
                  <label className="co-check"><input type="checkbox" checked={opts.copySchedules} onChange={(e)=>setOpts({...opts, copySchedules:e.target.checked})} /> Copy schedules</label>
                  <label className="co-check"><input type="checkbox" checked={opts.copyContent} onChange={(e)=>setOpts({...opts, copyContent:e.target.checked})} /> Copy content</label>
                  <label className="co-check"><input type="checkbox" checked={opts.mergeIfExists} onChange={(e)=>setOpts({...opts, mergeIfExists:e.target.checked})} /> Merge if exists (else overwrite)</label>
                </div>
              </div>
            </div>
            <div className="co-modal-actions">
              <button className="lc-btn" onClick={closeSend} disabled={sending}>Cancel</button>
              <button className="lc-btn primary" onClick={onSend} disabled={sending || !targetId}>{sending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="lc-banner">Loading...</div>}
    </div>
  );
};

export default CourseOverviewAll;
