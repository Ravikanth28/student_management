import React, { useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { GitHubCalendar } from 'react-github-calendar';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS, type GithubStatsRow } from '../types';

type Props = { onLogout: () => void };

export function GithubAnalyticsPage({ onLogout }: Props) {
  const { error: toastError } = useToast();
  const [data, setData] = useState<GithubStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<GithubStatsRow | null>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [showActiveDates, setShowActiveDates] = useState(false);

  useEffect(() => {
    let active = true;
    if (selectedStudent?.student_id) {
      setLiveLoading(true);
      setShowActiveDates(false);
      api.get(`/students/${selectedStudent.student_id}/github/profile`)
        .then(res => {
          if (active) {
            setLiveData(res.data);
            setLiveLoading(false);
          }
        })
        .catch(() => {
          if (active) setLiveLoading(false);
        });
    } else {
      setLiveData(null);
    }
    return () => { active = false; };
  }, [selectedStudent]);

  const { dailyTraces, hourlyTraces, activeDays, streak, activeDatesList } = useMemo(() => {
    if (!liveData?.events || liveData.events.length === 0) return { dailyTraces: [], hourlyTraces: [], activeDays: 0, streak: 0, activeDatesList: [] };
    
    const eventTypes = ['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'CreateEvent', 'WatchEvent', 'Other'];
    const colors: Record<string, string> = {
      'PushEvent': '#10b981',
      'PullRequestEvent': '#8b5cf6',
      'IssuesEvent': '#ef4444',
      'CreateEvent': '#f59e0b',
      'WatchEvent': '#eab308',
      'Other': '#6b7280'
    };
    const typeLabels: Record<string, string> = {
      'PushEvent': 'Pushes',
      'PullRequestEvent': 'Pull Requests',
      'IssuesEvent': 'Issues',
      'CreateEvent': 'Creates (Branch/Repo)',
      'WatchEvent': 'Stars/Watches',
      'Other': 'Other'
    };

    const dailySorted: Record<string, Record<string, number>> = {};
    const hourlyCounts: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 24; i++) {
      hourlyCounts[i] = {};
      eventTypes.forEach(t => hourlyCounts[i][t] = 0);
    }

    const reversedEvents = [...liveData.events].reverse();
    
    reversedEvents.forEach((ev: any) => {
      const date = new Date(ev.created_at);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      let type = ev.type;
      if (!eventTypes.includes(type)) type = 'Other';

      if (!dailySorted[dateStr]) {
        dailySorted[dateStr] = {};
        eventTypes.forEach(t => dailySorted[dateStr][t] = 0);
      }
      
      dailySorted[dateStr][type] += 1;
      
      const hour = date.getHours();
      hourlyCounts[hour][type] += 1;
    });
    
    const dates = Object.keys(dailySorted);
    const dailyTraces = eventTypes.map(type => ({
      x: dates,
      y: dates.map(date => dailySorted[date][type]),
      type: 'scatter',
      mode: 'lines+markers',
      name: typeLabels[type],
      marker: { color: colors[type] },
      line: { shape: 'spline', smoothing: 1.3 }
    })).filter(trace => trace.y.some(val => val > 0));

    const hours = Object.keys(hourlyCounts).map(Number);
    const hourlyTraces = eventTypes.map(type => ({
      x: hours.map(h => `${h}:00`),
      y: hours.map(h => hourlyCounts[h][type]),
      type: 'bar',
      name: typeLabels[type],
      marker: { color: colors[type] }
    })).filter(trace => trace.y.some(val => val > 0));

    const activeDateStrings = new Set<string>();
    liveData?.events?.forEach((ev: any) => {
      const d = new Date(ev.created_at);
      const iso = d.toISOString().split('T')[0];
      activeDateStrings.add(iso);
    });
    
    let activeDays = 0;
    let streak = 0;
    const today = new Date();
    const activeDatesList: string[] = [];
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      if (activeDateStrings.has(iso)) {
        activeDays++;
        activeDatesList.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
      }
    }
    
    let checkDate = new Date(today);
    let checkIso = checkDate.toISOString().split('T')[0];
    if (!activeDateStrings.has(checkIso)) {
       checkDate.setDate(checkDate.getDate() - 1);
       checkIso = checkDate.toISOString().split('T')[0];
    }
    
    while (activeDateStrings.has(checkIso)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      checkIso = checkDate.toISOString().split('T')[0];
    }

    return { dailyTraces, hourlyTraces, activeDays, streak, activeDatesList };
  }, [liveData]);

  useEffect(() => {
    let active = true;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (year) params.append('year', year);
        if (section) params.append('section', section);
        
        const res = await api.get<{ data: GithubStatsRow[] }>(`/students/github/analytics?${params.toString()}`);
        if (active) setData(res.data.data);
      } catch (err) {
        if (active) toastError('Error', 'Failed to load GitHub analytics');
      } finally {
        if (active) setLoading(false);
      }
    };
    
    void fetchAnalytics();
    return () => { active = false; };
  }, [year, section]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell title="GitHub Analytics" subtitle="Track student GitHub activity" onLogout={onLogout}>
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Year</label>
            <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All Years</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Section</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. A" 
              value={section} 
              onChange={(e) => setSection(e.target.value.toUpperCase())} 
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Name</th>
                <th>Register No</th>
                <th>Section</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>
                    Loading analytics...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>
                    No students found with linked GitHub accounts.
                  </td>
                </tr>
              ) : (
                data.map((student, idx) => (
                  <tr key={student.student_id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{student.name}</td>
                    <td>{student.enrollment_number}</td>
                    <td>{student.section}</td>
                    <td>
                      <span className={`badge ${student.status === 'Active' ? 'badge-green' : 'badge-red'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStudent(student)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)} style={{ padding: '20px', overflowY: 'auto' }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 1400, width: '100%', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="modal-title" style={{ marginBottom: 16 }}>GitHub Details: {selectedStudent.name}</h2>
            
            {liveLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                Loading full GitHub profile...
              </div>
            ) : liveData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Profile Header */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                  {liveData.profile?.avatar_url ? (
                    <img 
                      src={liveData.profile.avatar_url} 
                      alt="Avatar" 
                      style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-3)' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--text)' }}>
                      {liveData.profile?.name || selectedStudent.github_username}
                    </div>
                    <a 
                      href={`https://github.com/${selectedStudent.github_username}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '1.1rem' }}
                    >
                      @{selectedStudent.github_username}
                    </a>
                    {liveData.profile?.bio && (
                      <div style={{ fontSize: '1rem', color: 'var(--text-2)', marginTop: 8 }}>
                        "{liveData.profile.bio}"
                      </div>
                    )}
                    {liveData.profile?.location && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        📍 {liveData.profile.location}
                      </div>
                    )}
                    {selectedStudent.last_active && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, marginTop: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                        Last Active: {new Date(selectedStudent.last_active).toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  {/* Stats Grid right side */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                        {liveData.profile?.public_repos ?? selectedStudent.total_repos}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Repos</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                        {liveData.profile?.followers ?? '-'}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Followers</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                        {selectedStudent.total_commits}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Commits</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                        {streak}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Day Streak</div>
                    </div>
                    <div 
                      style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 90, cursor: 'pointer', position: 'relative' }}
                      onClick={() => setShowActiveDates(!showActiveDates)}
                      title="Click to view active dates"
                    >
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                        {activeDays}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', textTransform: 'uppercase', textDecoration: 'underline dotted' }}>Active (30d)</div>
                      
                      {showActiveDates && (
                        <div style={{ 
                          position: 'absolute', top: '100%', right: 0, marginTop: 8, 
                          background: 'var(--bg-3)', border: '1px solid var(--border)', 
                          borderRadius: 8, padding: 12, zIndex: 10, width: 160, 
                          maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          textAlign: 'left'
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Active Dates</div>
                          {activeDatesList.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {activeDatesList.map(d => (
                                <li key={d}>✅ {d}</li>
                              ))}
                            </ul>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No active days.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Usage & Activity Graphs (Plotly) */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>Usage & Activity Graph (Recent)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: 12 }}>
                    Left: Daily activity over the last 90 days. Right: The time of day (0:00 - 23:00) they are most active.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, border: '1px solid var(--border)', height: 320 }}>
                      {dailyTraces.length > 0 ? (
                        <Plot
                          data={dailyTraces as any}
                          layout={{
                            autosize: true,
                            margin: { l: 30, r: 10, t: 30, b: 40 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af' },
                            xaxis: { showgrid: false },
                            yaxis: { showgrid: true, gridcolor: '#374151', zeroline: false },
                            showlegend: true,
                            legend: { x: 0, y: 1.1, orientation: 'h' }
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                          config={{ displayModeBar: false }}
                        />
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                          Not enough recent activity data.
                        </div>
                      )}
                    </div>
                    
                    <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 8, border: '1px solid var(--border)', height: 320 }}>
                      {hourlyTraces.length > 0 ? (
                        <Plot
                          data={hourlyTraces as any}
                          layout={{
                            autosize: true,
                            barmode: 'stack',
                            margin: { l: 30, r: 10, t: 30, b: 40 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af' },
                            xaxis: { showgrid: false },
                            yaxis: { showgrid: true, gridcolor: '#374151', zeroline: false },
                            showlegend: true,
                            legend: { x: 0, y: 1.1, orientation: 'h' }
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                          config={{ displayModeBar: false }}
                        />
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                          Not enough recent activity data.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* GitHub Contributions Heatmap */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>Contributions Heatmap (All Time)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: 12 }}>
                    Shows a full 365-day history of their commits and contributions. Each square represents a day.
                  </p>
                  <div style={{ background: '#fff', padding: '16px', borderRadius: 8, overflowX: 'auto', border: '1px solid var(--border)', color: '#24292e' }}>
                    <div style={{ width: 'max-content', margin: '0 auto' }}>
                      <GitHubCalendar 
                        username={selectedStudent.github_username} 
                        colorScheme="light"
                        blockSize={14}
                        blockMargin={4}
                        fontSize={14}
                        renderBlock={(block, activity) => 
                          React.cloneElement(block as React.ReactElement, {
                            'data-tooltip-id': 'react-tooltip',
                            'data-tooltip-content': `${activity.count} contributions on ${activity.date}`
                          })
                        }
                      />
                      <Tooltip id="react-tooltip" />
                    </div>
                  </div>
                </div>

                {/* Main Content: Repos & Events */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  
                  {/* Recent Repos */}
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Recent Repositories</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 350, overflowY: 'auto', paddingRight: 8 }}>
                      {liveData.repos?.length > 0 ? (
                        liveData.repos.map((repo: any) => (
                          <a 
                            key={repo.id}
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', background: 'var(--bg-2)', padding: 16, borderRadius: 8, textDecoration: 'none' }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>{repo.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {repo.description || 'No description provided.'}
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-3)' }}>
                              {repo.language && <span>🟢 {repo.language}</span>}
                              <span>⭐ {repo.stargazers_count}</span>
                              <span>Pushed: {new Date(repo.pushed_at).toLocaleDateString()}</span>
                            </div>
                          </a>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-3)' }}>No repositories found.</div>
                      )}
                    </div>
                  </div>

                  {/* Recent Activity Timeline */}
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Recent Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 350, overflowY: 'auto', paddingRight: 8 }}>
                      {liveData.events?.length > 0 ? (
                        liveData.events.slice(0, 10).map((ev: any) => {
                          let actionText = ev.type;
                          if (ev.type === 'PushEvent') actionText = `Pushed ${ev.payload.commits?.length || 1} commits to`;
                          else if (ev.type === 'PullRequestEvent') actionText = `${ev.payload.action} a pull request in`;
                          else if (ev.type === 'IssuesEvent') actionText = `${ev.payload.action} an issue in`;
                          else if (ev.type === 'WatchEvent') actionText = 'Starred';
                          else if (ev.type === 'CreateEvent') actionText = `Created a ${ev.payload.ref_type} in`;

                          return (
                            <div key={ev.id} style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 8 }}>
                              <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                                <span style={{ fontWeight: 600 }}>{actionText}</span>{' '}
                                <a href={`https://github.com/${ev.repo.name}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                                  {ev.repo.name}
                                </a>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 }}>
                                {new Date(ev.created_at).toLocaleString()}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ color: 'var(--text-3)' }}>No recent public activity.</div>
                      )}
                    </div>
                  </div>
                  
                </div>

              </div>
            ) : (
              <div style={{ color: 'var(--text-error)' }}>Failed to load GitHub profile data.</div>
            )}
            
            <div className="modal-actions" style={{ marginTop: 24, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-outline" onClick={() => setSelectedStudent(null)}>Close</button>
              <a 
                className="btn btn-primary"
                href={`https://github.com/${selectedStudent.github_username}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                View GitHub Profile
              </a>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
