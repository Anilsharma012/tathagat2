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
  const [progress, setProgress] = useState(0);
  const [liveItems, setLiveItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
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
  const recorded = useMemo(() => (liveItems || []).filter(it => new Date(it.endTime) < now), [liveItems]);
  const upcoming = useMemo(() => (liveItems || []).filter(it => new Date(it.startTime) > now), [liveItems]);

  return (
    <div className="co-container">
      <div className="co-header">
        <div className="co-title-wrap">
          {course?.thumbnail ? (
            <Link to={`/course-overview/${courseId}/${studentId}`} className="co-thumb-link" aria-label="Open course overview">
              <img src={course.thumbnail} alt={course?.name || 'Course'} className="co-thumb" />
            </Link>
          ) : null}
          <div>
            <h1 className="lc-page-title">Course Overview</h1>
            <div className="lc-muted">{course?.name || 'Course'} · Student: {studentId}</div>
          </div>
        </div>
        <div className="lc-actions">
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

      <div className="lc-grid co-grid">
        <div className="co-section">
          <h3 className="co-section-title">Recorded Videos</h3>
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
            {upcoming.map(it => (
              <div key={it._id} className="lc-card">
                <div className="lc-card-header">
                  <div className="lc-title">{it.title}</div>
                  <span className={`lc-badge ${it.platform}`}>{it.platform}</span>
                </div>
                <div className="lc-muted">{formatDate(it.startTime)} · {formatTime(it.startTime)} – {formatTime(it.endTime)}</div>
                <div className="lc-card-actions">
                  <a className={`lc-btn ${canJoin(it)?'primary':''}`} href={canJoin(it) ? it.joinLink : undefined} target="_blank" rel="noreferrer" aria-disabled={!canJoin(it)}>{canJoin(it)? 'Join Live' : 'Locked'}</a>
                </div>
              </div>
            ))}
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
