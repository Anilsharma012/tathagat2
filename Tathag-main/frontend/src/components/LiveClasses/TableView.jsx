import React from 'react';
import './liveClasses.css';

const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const TableView = ({ items, onEdit, onDelete, onNotify, onIcs, onView, onOverview }) => {
  return (
    <table className="lc-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Course</th>
          <th>Platform</th>
          <th>Start</th>
          <th>End</th>
          <th>Status</th>
          {(onEdit || onDelete || onNotify || onIcs || onView || onOverview) && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {items.map(it => (
          <tr key={it._id}>
            <td>{it.title} {it.local ? <span className="lc-badge local">local</span> : null}</td>
            <td>
              <span className="lc-link" onClick={()=> onOverview && onOverview(it)}>{it.courseId?.name || '-'}</span>
            </td>
            <td><span className={`lc-badge ${it.platform}`}>{it.platform}</span></td>
            <td>{fmt(it.startTime)}</td>
            <td>{fmt(it.endTime)}</td>
            <td>{it.status}</td>
            {(onEdit || onDelete || onNotify || onIcs || onView || onOverview) && (
              <td>
                <div className="lc-row-actions">
                  {onOverview && <button className="lc-btn" onClick={()=>onOverview(it)}>Overview</button>}
                  {onView && <button className="lc-btn" onClick={()=>onView(it)}>View Details</button>}
                  {onEdit && <button className="lc-btn" onClick={()=>onEdit(it)}>Edit Class</button>}
                  {onDelete && <button className="lc-btn" onClick={()=>onDelete(it)}>Delete</button>}
                  {onNotify && <button className="lc-btn" onClick={()=>onNotify(it)}>Notify Students</button>}
                  {onIcs && <button className="lc-btn" onClick={()=>onIcs(it)}>Download .ics</button>}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TableView;
