import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { YEAR_LABELS, type ExamCard, type ExamSubject, type ExamTest, type ExamMarkSplit } from '../types';

export function ExamMarksSection({ studentId }: { studentId: number }) {
  const [cards, setCards] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Record<number, number>>({});
  const [selectedTest, setSelectedTest] = useState<Record<number, number>>({});
  // scores: testId → splitId → string[] (one for each question)
  const [scores, setScores] = useState<Record<number, Record<number, string[]>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const { success: toastSuccess, error: toastErr } = useToast();

  useEffect(() => {
    api.get(`/exam-cards/student/${studentId}`)
      .then((r) => setCards(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  // Pre-populate scores from saved marks
  useEffect(() => {
    const init: Record<number, Record<number, string[]>> = {};
    for (const card of cards) {
      for (const subj of (card.subjects ?? []) as ExamSubject[]) {
        for (const test of subj.tests as ExamTest[]) {
          init[test.id] = {};
          for (const sp of test.splits as ExamMarkSplit[]) {
            const totalQs = sp.total_questions || sp.question_count;
            const arr = Array(totalQs).fill('');
            if (sp.question_scores) {
              sp.question_scores.forEach((val, i) => { if (i < arr.length && val != null) arr[i] = String(val); });
            } else if (sp.score != null) {
              // Legacy fallback if no question_scores exist
              arr[0] = String(sp.score);
            }
            init[test.id][sp.id] = arr;
          }
        }
      }
    }
    setScores(init);
  }, [cards]);

  const getSubjects = (card: ExamCard) => (card.subjects ?? []) as ExamSubject[];
  const getTests = (cardId: number) => {
    const card = cards.find((c) => c.id === cardId);
    const subId = selectedSubject[cardId];
    if (!card || !subId) return [];
    const subj = getSubjects(card).find((s) => s.id === subId);
    return (subj?.tests ?? []) as ExamTest[];
  };
  const getSelectedTest = (cardId: number): ExamTest | null => {
    const testId = selectedTest[cardId];
    if (!testId) return null;
    return getTests(cardId).find((t) => t.id === testId) ?? null;
  };

  const handleScore = (testId: number, splitId: number, qIndex: number, val: string, totalQs: number) =>
    setScores((prev) => {
      const splitArr = [...(prev[testId]?.[splitId] || Array(totalQs).fill(''))];
      splitArr[qIndex] = val;
      return { ...prev, [testId]: { ...(prev[testId] ?? {}), [splitId]: splitArr } };
    });



  const handleSave = async (cardId: number) => {
    const test = getSelectedTest(cardId);
    if (!test) return;
    const testScores = scores[test.id] ?? {};
    const entries = (test.splits as ExamMarkSplit[]).map((sp) => {
      const splitScores = testScores[sp.id] ?? [];
      const scoreSum = splitScores.reduce((sum, v) => sum + (Number(v) || 0), 0);
      const filledCount = splitScores.filter(v => v !== '').length;
      const qScores = splitScores.map((v) => {
        if (v !== '') return Number(v);
        return (filledCount >= sp.question_count) ? 0 : null;
      });
      return {
        split_id: sp.id,
        score: scoreSum,
        question_scores: qScores,
      };
    });
    setSaving(cardId);
    try {
      await api.put('/exam-cards/marks', { entries });
      toastSuccess('Marks saved', 'Your exam marks have been saved.');
    } catch {
      toastErr('Error', 'Failed to save marks');
    } finally { setSaving(null); }
  };

  if (loading) return null;
  if (cards.length === 0) return (
    <div className="card card-padded" style={{ marginTop: 16 }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>No active exam cards assigned to your year.</p>
    </div>
  );

  return (
    <div style={{ marginTop: 16 }}>
      {selectedCardId === null ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => setSelectedCardId(card.id)}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 20px', transition: 'transform 0.2s', border: '1px solid var(--border)', borderRadius: '12px',
                background: 'var(--surface-1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--blue)', marginBottom: 16 }}>
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: 'var(--text-1)', textAlign: 'center' }}>{card.title}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', textAlign: 'center' }}>{card.semester}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-outline" onClick={() => setSelectedCardId(null)}>← Back</button>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-1)' }}>{cards.find(c => c.id === selectedCardId)?.title}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: 4 }}>{cards.find(c => c.id === selectedCardId)?.semester}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</label>
              <select
                className="form-control"
                value={selectedSubject[selectedCardId] ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSelectedSubject((p) => ({ ...p, [selectedCardId]: v }));
                  setSelectedTest((p) => ({ ...p, [selectedCardId]: 0 }));
                }}
              >
                <option value="">— Select Subject —</option>
                {getSubjects(cards.find(c => c.id === selectedCardId)!).map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Test</label>
              <select
                className="form-control"
                value={selectedTest[selectedCardId] ?? ''}
                onChange={(e) => setSelectedTest((p) => ({ ...p, [selectedCardId]: Number(e.target.value) }))}
                disabled={!selectedSubject[selectedCardId]}
              >
                <option value="">— Select Test —</option>
                {getTests(selectedCardId).map((t) => <option key={t.id} value={t.id}>{t.test_name} (Total: {t.total_marks})</option>)}
              </select>
            </div>
          </div>

          {(() => {
            const test = getSelectedTest(selectedCardId);
            if (!test) {
              return (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12 }}>
                  <div style={{ marginBottom: 12 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)' }}>
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </div>
                  <h3 style={{ margin: '0 0 8px', color: 'var(--text-1)' }}>Select Subject & Test</h3>
                  <p style={{ margin: 0, color: 'var(--text-2)' }}>Choose from the dropdowns above to enter your marks.</p>
                </div>
              );
            }

            const testScores = scores[test.id] ?? {};
            const total = (test.splits as ExamMarkSplit[]).reduce((acc, sp) => {
              const splitScores = testScores[sp.id] ?? [];
              return acc + splitScores.reduce((sum, v) => sum + (Number(v) || 0), 0);
            }, 0);
            const outOf100 = test.total_marks > 0 ? Math.round((total / test.total_marks) * 100 * 100) / 100 : 0;

            return (
              <>
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-3)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Split</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>Max</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(test.splits as ExamMarkSplit[]).map((sp) => {
                        const totalQs = sp.total_questions || sp.question_count;
                        const ansQs = sp.question_count;
                        const maxPerQ = sp.marks_each;
                        const splitScores = testScores[sp.id] ?? Array(totalQs).fill('');
                        
                        const currentSum = splitScores.reduce((sum, v) => sum + (Number(v) || 0), 0);
                        const maxTotal = maxPerQ * ansQs;
                        const sumOver = currentSum > maxTotal;

                        return (
                          <tr key={sp.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 16px', color: 'var(--text-1)', fontSize: '0.95rem' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                <strong>{sp.label}</strong>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                                  ({sp.marks_each}M × {ansQs} Q {totalQs > ansQs ? ` out of ${totalQs}` : ''})
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-2)', fontWeight: 600 }}>
                              {maxTotal}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                  {Array.from({ length: totalQs }).map((_, qIndex) => {
                                    const val = splitScores[qIndex] ?? '';
                                    const numVal = Number(val);
                                    const over = val !== '' && numVal > maxPerQ;
                                    
                                    const filledCount = splitScores.filter(v => v !== '').length;
                                    const isDisabled = val === '' && filledCount >= ansQs;
                                    
                                    return (
                                      <div key={qIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <input
                                          type="number" min={0} max={maxPerQ}
                                          value={val}
                                          placeholder={isDisabled ? '0' : `Q${qIndex + 1}`}
                                          title={`Question ${qIndex + 1} (Max: ${maxPerQ})`}
                                          onChange={(e) => handleScore(test.id, sp.id, qIndex, e.target.value, totalQs)}
                                          disabled={isDisabled}
                                          style={{
                                            width: 48, height: 42, borderRadius: 8, textAlign: 'center',
                                            border: `1px solid ${over ? '#f87171' : 'rgba(255, 255, 255, 0.1)'}`,
                                            background: over ? 'rgba(239,68,68,0.08)' : (isDisabled ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.03)'),
                                            color: over ? '#f87171' : (isDisabled ? 'var(--text-3)' : 'var(--text-1)'), 
                                            fontSize: '1rem', fontWeight: 600,
                                            opacity: isDisabled ? 0.5 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'text',
                                            transition: 'border-color 0.2s, background 0.2s'
                                          }}
                                        />
                                        {over && <div style={{ fontSize: '0.65rem', color: '#f87171', marginTop: 4 }}>&gt;{maxPerQ}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              {sumOver && <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: 8, fontWeight: 600 }}>Sum exceeds max ({maxTotal})</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)' }}>{total}<span style={{ fontSize: '0.9rem', color: 'var(--text-2)', fontWeight: 400 }}>/{test.total_marks}</span></div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Out of 100</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: outOf100 >= 75 ? '#34d399' : outOf100 >= 50 ? '#fbbf24' : '#f87171' }}>{outOf100}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '12px 28px', fontSize: '1rem' }}
                    onClick={() => handleSave(selectedCardId)}
                    disabled={saving === selectedCardId}
                  >
                    {saving === selectedCardId ? 'Saving…' : '💾 Save Marks'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
