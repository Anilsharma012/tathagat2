import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiVideo, FiPlay } from 'react-icons/fi';
import '../../../components/LiveClasses/liveClasses.css';
import { fetchLiveClasses } from '../../../utils/liveClassesApi';
import { UserContext } from '../../../context/UserContext';

const StudentLiveClasses = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [schedules, setSchedules] = useState([]);
  const [now, setNow] = useState(new Date());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    hydrate();
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => { mounted.current = false; clearInterval(t); };
  }, []);

  const hydrate = async () => {
    try {
      const items = await fetchLiveClasses({ role: 'student' });
      const normalized = (items || []).map(mapToScheduleShape);
      if (mounted.current) setSchedules(normalized);
    } catch {}
  };

  const mapToScheduleShape = (x) => ({
    id: x.id || x._id || String(x.id || x._id || ''),
    courseId: x.courseId || x.course?._id || x.course || '',
    title: x.title || x.name || 'Class',
    startTime: x.startTime || x.start || x.startsAt,
    endTime: x.endTime || x.end || x.endsAt,
    platform: (x.platform || x.provider || 'zoom').toLowerCase().replace(/\s+/g,'_'),
    joinUrl: x.joinUrl || x.joinLink || x.link || '',
    recordingUrl: x.recordingUrl || x.recordingLink || x.recording || '',
    teacher: x.teacher || x.instructor || '',
    thumbnail: x.thumbnail || x.image || ''
  });

  const weekItems = useMemo(() => schedules.filter(s => isSameWeek(s.startTime, now)), [schedules, now]);
  const days = useMemo(() => buildWeekDays(now), [now]);

  const recorded = useMemo(() => schedules
    .filter(s => !!s.recordingUrl || new Date(s.endTime) < now)
    .sort((a,b) => new Date(b.startTime) - new Date(a.startTime)), [schedules, now]);

  const upcoming = useMemo(() => schedules
    .filter(s => new Date(s.startTime) > now)
    .sort((a,b) => new Date(a.startTime) - new Date(b.startTime)), [schedules, now]);

  const canJoin = (s) => {
    const st = new Date(s.startTime).getTime();
    const en = new Date(s.endTime).getTime();
    const n = now.getTime();
    return n >= (st - 10*60000) && n <= en;
  };

  const primaryAction = (s) => {
    if (canJoin(s)) return { label: 'Join Now', href: s.joinUrl, enabled: !!s.joinUrl, kind: 'join' };
    if (now.getTime() < new Date(s.startTime).getTime()) return { label: `Starts ${formatTime(s.startTime)}`, href: '', enabled: false, kind: 'starts' };
    if (s.recordingUrl) return { label: 'Watch', href: s.recordingUrl, enabled: true, kind: 'watch' };
    return { label: 'Ended', href: '', enabled: false, kind: 'ended' };
  };

  const courseId = useMemo(() => uniqueCourseId(schedules), [schedules]);
  const studentId = user?._id || user?.id || '';

  return (
    <div className="lc-container">
      <div className="lc-header lc-header-spaced">
        <h1 className="lc-page-title">Live Classes</h1>
        {courseId && studentId && (
          <a className="lc-btn" href={`/overview/${courseId}/${studentId}`}>View All</a>
        )}
      </div>

      <section className="lc-margin-8">
        <div className="lc-card" style={{ padding: 12 }}>
          <div className="lc-card-header">
            <div className="lc-title">This Week’s Schedule</div>
            <div className="lc-muted">Mon–Sun</div>
          </div>
          <div className="lc-week-strip">
            {days.map((day, idx) => {
              const dayItems = weekItems.filter(s => isSameDay(s.startTime, day.date));
              return (
                <div key={idx} className="lc-week-day-card lc-card">
                  <div className="lc-day-header">
                    <div><strong>{day.label}</strong></div>
                    <div className="lc-muted">{day.date.getDate()}</div>
                  </div>
                  {dayItems.length === 0 && (
                    <div className="lc-muted">No classes</div>
                  )}
                  {dayItems.map(s => {
                    const act = primaryAction(s);
                    return (
                      <div key={s.id} className="lc-day-item" onClick={() => navigate(`/class/${s.id}`)}>
                        <div className="lc-day-info">
                          <div className="lc-time">{formatTime(s.startTime)}</div>
                          <div className="lc-title" style={{ margin: 0 }}>{s.title}</div>
                          <span className={`lc-badge ${s.platform}`}>{readablePlatform(s.platform)}</span>
                        </div>
                        <a
                          className={`lc-btn ${act.enabled ? 'primary' : ''}`}
                          href={act.enabled ? act.href : undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e)=>{ if(!act.enabled) e.preventDefault(); e.stopPropagation(); }}
                          aria-disabled={!act.enabled}
                        >
                          {act.kind === 'watch' ? <FiPlay /> : <FiVideo />} {act.label}
                        </a>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lc-two-col-grid">
        <div className="lc-card lc-col-left">
          <div className="lc-card-header">
            <div className="lc-title">Recorded Classes</div>
          </div>
          {recorded.length === 0 ? (
            <div className="lc-muted">No recordings yet</div>
          ) : (
            <div className="lc-card-list">
              {recorded.map(s => (
                <div key={s.id} className="lc-card">
                  {s.thumbnail && <img className="lc-thumb" src={s.thumbnail} alt="Class thumbnail" />}
                  <div className="lc-title">{s.title}</div>
                  <div className="lc-muted">{formatDateTime(s.startTime)}</div>
                  <div className="lc-badges-row">
                    <span className={`lc-badge ${s.platform}`}>{readablePlatform(s.platform)}</span>
                  </div>
                  <div className="lc-card-actions">
                    <a className={`lc-btn ${s.recordingUrl ? 'primary' : ''}`} href={s.recordingUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!s.recordingUrl}>
                      <FiPlay /> Watch Recording
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lc-card lc-col-right">
          <div className="lc-card-header">
            <div className="lc-title">Upcoming Classes</div>
          </div>
          {upcoming.length === 0 ? (
            <div className="lc-muted">No upcoming classes</div>
          ) : (
            <div className="lc-card-list">
              {upcoming.map(s => {
                const act = primaryAction(s);
                return (
                  <div key={s.id} className="lc-card">
                    <div className="lc-title">{s.title}</div>
                    <div className="lc-muted">{formatDateTime(s.startTime)}</div>
                    <div className="lc-badges-row">
                      <span className={`lc-badge ${s.platform}`}>{readablePlatform(s.platform)}</span>
                    </div>
                    <div className="lc-card-actions">
                      <a className={`lc-btn ${act.enabled ? 'primary' : ''}`} href={act.enabled ? act.href : undefined} target="_blank" rel="noreferrer" aria-disabled={!act.enabled}>
                        <FiVideo /> {act.label}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// Helpers
const readablePlatform = (p) => p?.replace(/_/g,' ')?.replace(/\b\w/g, m=>m.toUpperCase()) || 'Platform';
const pad2 = (n) => String(n).padStart(2,'0');
const formatTime = (d) => {
  const dt = new Date(d);
  let h = dt.getHours();
  const m = pad2(dt.getMinutes());
  const a = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${a}`;
};
const formatDateTime = (d) => {
  const dt = new Date(d);
  const day = pad2(dt.getDate());
  const month = dt.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}, ${formatTime(dt)}`;
};
const startOfWeekMon = (d) => {
  const dt = new Date(d); const day = dt.getDay(); const diff = (day === 0 ? -6 : 1) - day; const res = new Date(dt); res.setDate(dt.getDate() + diff); res.setHours(0,0,0,0); return res;
};
const isSameWeek = (a, ref = new Date()) => {
  const dt = new Date(a); const s = startOfWeekMon(ref); const e = new Date(s); e.setDate(s.getDate()+7); return dt >= s && dt < e;
};
const isSameDay = (a, b) => {
  const da = new Date(a), db = new Date(b); return da.getFullYear()===db.getFullYear() && da.getMonth()===db.getMonth() && da.getDate()===db.getDate();
};
const buildWeekDays = (ref) => {
  const s = startOfWeekMon(ref);
  return Array.from({length:7}, (_,i)=>{ const d=new Date(s); d.setDate(s.getDate()+i); return { date:d, label:d.toLocaleDateString('en-US',{ weekday:'short' }) }; });
};
const uniqueCourseId = (arr) => {
  const set = new Set((arr||[]).map(x=>x.courseId).filter(Boolean));
  return set.size === 1 ? Array.from(set)[0] : '';
};

export default StudentLiveClasses;
