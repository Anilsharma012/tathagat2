import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import '../../components/LiveClasses/liveClasses.css';
import './CourseOverview.css';
import http from '../../utils/http';
import { fetchLiveClasses } from '../../utils/liveClassesApi';

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (d) => new Date(d).toLocaleDateString();
const mins = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000));

const canJoin = (it) => {
  const now = new Date();
  const start = new Date(it.startTime);
  const end = new Date(it.endTime);
  return now >= new Date(start.getTime() - 10 * 60000) && now <= new Date(end.getTime() + 30 * 60000);
};

const CourseOverview = () => {
  const { courseId, studentId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState(0);
  const [liveItems, setLiveItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [studentCourses, setStudentCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chaptersBySubject, setChaptersBySubject] = useState({});

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        // Load batches for selection
        try {
          const b = await http.get('/admin/academics/batches?with=courses');
          const blist = (b.data?.batches || []).map(x => ({ id: x.id, name: x.name, courseIds: (x.courses || x.courseIds || []).map(c => c._id || c) }));
          if (mounted) setBatches(blist);
          if (mounted && blist.length && !batchId) setBatchId(blist[0].id);
        } catch {}

        // Load all courses for dropdown (admin list)
        try {
          const res = await http.get('/courses');
          const list = (res.data?.courses || res.data || []).map(c => ({ id: c._id, title: c.name || c.title || '-', code: c.code || '', thumbnail: c.thumbnail || '' }));
          if (mounted) setCourses(list);
        } catch {}

        // Load student's purchased courses
        try {
          const paid = await http.get('/admin/paid-users');
          const user = (paid.data?.users || []).find(u => String(u._id) === String(studentId));
          const owned = (user?.enrolledCourses || []).filter(ec => (ec.status === 'unlocked') && ec.courseId).map(ec => ({ id: ec.courseId._id, title: ec.courseId.name, thumbnail: ec.courseId.thumbnail || '' }));
          if (mounted) setStudentCourses(owned);
        } catch {}

        // Course details (prefer public endpoint)
        let c = null;
        try {
          const r = await http.get(`/courses/student/published-courses/${courseId}`);
          c = r?.data?.course || r?.data || null;
        } catch {
          try {
            const r2 = await http.get(`/courses/${courseId}`);
            c = r2?.data?.course || r2?.data || null;
          } catch {}
        }
        if (mounted) setCourse(c);

        // Load full course content (subjects + chapters)
        try {
          const subRes = await http.get(`/subjects/${courseId}`);
          const subs = subRes.data?.subjects || [];
          if (mounted) setSubjects(subs);
          // Fetch chapters for all subjects in parallel
          try {
            const pairs = await Promise.all(subs.map(async (s) => {
              try {
                const ch = await http.get(`/chapters/${s._id}`);
                return [s._id, ch.data?.chapters || []];
              } catch {
                return [s._id, []];
              }
            }));
            if (mounted) {
              const map = {};
              for (const [sid, arr] of pairs) map[sid] = arr;
              setChaptersBySubject(map);
            }
          } catch {}
        } catch {}

        // Progress for this student+course (admin endpoint)
        try {
          const pr = await http.get(`/admin/student/${studentId}/course/${courseId}/progress`);
          const ov = Number(pr?.data?.progress?.overallProgress || 0);
          if (mounted) setProgress(ov);
        } catch {
          if (mounted) setProgress(0);
        }

        // Live classes for this course
        try {
          const items = await fetchLiveClasses({ courseId });
          if (mounted) setLiveItems(Array.isArray(items) ? items : []);
        } catch {
          if (mounted) setLiveItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [courseId, studentId]);

  const now = new Date();
  const normalized = useMemo(()=> (liveItems||[]).map(it => ({
    ...it,
    joinUrl: it.joinUrl || it.joinLink || '',
    recordingUrl: it.recordingUrl || '',
  })), [liveItems]);

  const recorded = useMemo(() => normalized
    .filter(it => !!it.recordingUrl || new Date(it.endTime) < now)
    .sort((a,b)=> new Date(b.startTime) - new Date(a.startTime))
  , [normalized]);

  const upcoming = useMemo(() => normalized
    .filter(it => new Date(it.startTime) > now)
    .sort((a,b)=> new Date(a.startTime) - new Date(b.startTime))
  , [normalized]);

  const allowedCourseIds = useMemo(() => courses.map(c => c.id), [courses]);

  const visibleCourses = useMemo(() => courses, [courses]);

  // Ensure selected course stays within the visible (batch + purchased) set
  useEffect(() => {
    if (!visibleCourses.length) return;
    const isVisible = !!visibleCourses.find(c => String(c.id) === String(courseId));
    if (!isVisible) {
      const first = visibleCourses[0];
      if (first) navigate(`/overview/${first.id}/${studentId}`, { replace: true });
    }
  }, [batchId, visibleCourses, courseId, studentId, navigate]);

  const onSelectCourse = (e) => {
    const newId = e.target.value;
    if (!newId) return;
    navigate(`/overview/${newId}/${studentId}`);
  };

  return (
    <div className="co-container">
      <div className="co-header">
        <div className="co-title-wrap">
          <div>
            <h1 className="lc-page-title">Course Overview</h1>
            <div className="lc-muted">{course?.name || 'Course'} · Student: {studentId}</div>
          </div>
        </div>
        <div className="lc-actions">
          <select className="lc-filter" value={batchId} onChange={(e)=>setBatchId(e.target.value)} aria-label="Select Batch">
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="lc-filter" value={courseId} onChange={onSelectCourse} aria-label="Select Course">
            {visibleCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button className="lc-btn" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>

      <div className="co-progress">
        <div className="co-progress-top">
          <div className="co-progress-label">Overall Progress</div>
          <div className="co-progress-val">{progress}%</div>
        </div>
        <div className="co-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="co-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      </div>

      <div className="co-section">
        <h3 className="co-section-title">Course Content</h3>
        <div className="lc-card-list">
          {subjects.map(sub => (
            <div key={sub._id} className="lc-card">
              <div className="lc-card-header">
                <div className="lc-title">{sub.name}</div>
                <span className="lc-badge">{(chaptersBySubject[sub._id]||[]).length} chapters</span>
              </div>
              <ul className="co-chapter-list">
                {(chaptersBySubject[sub._id]||[]).map(ch => (
                  <li key={ch._id} className="co-chapter-item">
                    <span className="co-chapter-dot" />
                    <span className="co-chapter-name">{ch.name}</span>
                  </li>
                ))}
                {!(chaptersBySubject[sub._id]||[]).length && (
                  <li className="co-chapter-item"><span className="co-chapter-name lc-muted">No chapters</span></li>
                )}
              </ul>
            </div>
          ))}
          {!subjects.length && <div className="lc-card"><div className="lc-muted">No subjects found</div></div>}
        </div>
      </div>

      <div className="lc-grid co-grid">
        <div className="co-section">
          <h3 className="co-section-title">Recorded Classes</h3>
          <div className="lc-card-list">
            {recorded.map(it => (
              <div key={it._id} className="lc-card">
                <div className="lc-card-header">
                  <div className="lc-title">{it.title}</div>
                  <span className={`lc-badge ${it.platform}`}>{it.platform}</span>
                </div>
                <div className="lc-muted">{formatDate(it.startTime)} · {formatTime(it.startTime)} – {formatTime(it.endTime)}</div>
                <div className="lc-muted">Duration: {mins(it.startTime, it.endTime)} min</div>
                {it.recordingUrl ? (
                  <div className="lc-card-actions">
                    <a className="lc-btn primary" href={it.recordingUrl} target="_blank" rel="noreferrer">Watch Recording</a>
                  </div>
                ) : null}
              </div>
            ))}
            {!recorded.length && (
              <div className="lc-card"><div className="lc-muted">No recordings yet</div></div>
            )}
          </div>
        </div>

        <div className="co-section">
          <h3 className="co-section-title">Upcoming Classes</h3>
          <div className="lc-card-list">
            {upcoming.map(it => {
              const start = new Date(it.startTime);
              const can = new Date() >= new Date(start.getTime() - 10 * 60000);
              return (
                <div key={it._id} className="lc-card">
                  <div className="lc-card-header">
                    <div className="lc-title">{it.title}</div>
                    <span className={`lc-badge ${it.platform}`}>{it.platform}</span>
                  </div>
                  <div className="lc-muted">{formatDate(it.startTime)} · {formatTime(it.startTime)} – {formatTime(it.endTime)}</div>
                  <div className="lc-card-actions">
                    {can ? (
                      <a className="lc-btn primary" href={it.joinUrl} target="_blank" rel="noreferrer">Join Live</a>
                    ) : (
                      <button className="lc-btn" disabled>Starts at {formatTime(it.startTime)}</button>
                    )}
                  </div>
                </div>
              );
            })}
            {!upcoming.length && (
              <div className="lc-card"><div className="lc-muted">No upcoming classes</div></div>
            )}
          </div>
        </div>
      </div>

      <div className="co-note lc-muted">Data linked with Manage Live Classes schedule</div>

      {loading && <div className="lc-banner">Loading...</div>}
    </div>
  );
};

export default CourseOverview;
