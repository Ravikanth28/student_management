import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { YEAR_LABELS, type ExamCard, type ExamSubject, type ExamTest, type ExamMarkSplit } from '../types';

export function ExamMarksSection({ studentId }: { studentId: number }) {
  const [cards, setCards] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
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

  const handleScore = (testId: number, splitId: number, qIndex: number, val: string, ansQs: number, totalQs: number) =>
    setScores((prev) => {
      const splitArr = [...(prev[testId]?.[splitId] || Array(totalQs).fill(''))];
      splitArr[qIndex] = val;
      
      const filledCount = splitArr.filter(v => v !== '').length;
      if (filledCount >= ansQs) {
         for (let i = 0; i < totalQs; i++) {
            if (splitArr[i] === '') {
               splitArr[i] = '0';
            }
         }
      }
      
      return { ...prev, [testId]: { ...(prev[testId] ?? {}), [splitId]: splitArr } };
    });

  const handleSave = async (cardId: number) => {
    const test = getSelectedTest(cardId);
    if (!test) return;
    const testScores = scores[test.id] ?? {};
    const entries = (test.splits as ExamMarkSplit[]).map((sp) => {
      const splitScores = testScores[sp.id] ?? [];
      const scoreSum = splitScores.reduce((sum, v) => sum + (Number(v) || 0), 0);
      const qScores = splitScores.map((v) => (v === '' ? null : Number(v)));
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
      {cards.map((card) => {
        const isOpen = expandedCard === card.id;
        const test = getSelectedTest(card.id);
        const testScores = test ? (scores[test.id] ?? {}) : {};
        const total = test ? (test.splits as ExamMarkSplit[]).reduce((acc, sp) => {
          const splitScores = testScores[sp.id] ?? [];
          return acc + splitScores.reduce((sum, v) => sum + (Number(v) || 0), 0);
        }, 0) : 0;
        const outOf100 = test && test.total_marks > 0 ? Math.round((total / test.total_marks) * 100 * 100) / 100 : 0;

        return (
          <div key={card.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            {/* Card Header */}
            <div
              style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'var(--surface-2)' : undefined }}
              onClick={() => setExpandedCard(isOpen ? null : card.id)}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '0.95rem' }}>{card.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>{card.semester} · {YEAR_LABELS[card.year_assigned]}</div>
              </div>
              <span style={{ color: 'var(--text-2)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '1.2rem' }}>▾</span>
            </div>

            {/* Expanded Content */}
            {isOpen && (
              <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</label>
                    <select
                      className="form-control"
                      value={selectedSubject[card.id] ?? ''}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSelectedSubject((p) => ({ ...p, [card.id]: v }));
                        setSelectedTest((p) => ({ ...p, [card.id]: 0 }));
                      }}
                    >
                      <option value="">— Select Subject —</option>
                      {getSubjects(card).map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Test</label>
                    <select
                      className="form-control"
                      value={selectedTest[card.id] ?? ''}
                      onChange={(e) => setSelectedTest((p) => ({ ...p, [card.id]: Number(e.target.value) }))}
                      disabled={!selectedSubject[card.id]}
                    >
                      <option value="">— Select Test —</option>
                      {getTests(card.id).map((t) => <option key={t.id} value={t.id}>{t.test_name} (Total: {t.total_marks})</option>)}
                    </select>
                  </div>
                </div>

                {test && (
                  <>
                    {/* Mark Entry Table */}
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-3)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Split</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Score</th>
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
                                <td style={{ padding: '10px 14px', color: 'var(--text-1)', fontSize: '0.88rem' }}>
                                  {sp.label}
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: 6 }}>
                                    ({sp.marks_each}M × {ansQs} Q {totalQs > ansQs ? ` out of ${totalQs}` : ''})
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-2)', fontWeight: 600 }}>
                                  {maxTotal}
                                </td>
                                <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    {Array.from({ length: totalQs }).map((_, qIndex) => {
                                      const val = splitScores[qIndex] ?? '';
                                      const numVal = Number(val);
                                      const over = val !== '' && numVal > maxPerQ;
                                      return (
                                        <div key={qIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                          <input
                                            type="number" min={0} max={maxPerQ}
                                            value={val}
                                            placeholder={`Q${qIndex + 1}`}
                                            title={`Question ${qIndex + 1} (Max: ${maxPerQ})`}
                                            onChange={(e) => handleScore(test.id, sp.id, qIndex, e.target.value, ansQs, totalQs)}
                                            style={{
                                              width: 50, padding: '6px', borderRadius: 6, textAlign: 'center',
                                              border: `1px solid ${over ? '#f87171' : 'var(--border)'}`,
                                              background: over ? 'rgba(239,68,68,0.08)' : 'var(--surface-1)',
                                              color: over ? '#f87171' : 'var(--text-1)', fontSize: '0.85rem', fontWeight: 600,
                                            }}
                                          />
                                          {over && <div style={{ fontSize: '0.65rem', color: '#f87171', marginTop: 2 }}>&gt;{maxPerQ}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {sumOver && <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: 6, fontWeight: 600 }}>Sum exceeds max ({maxTotal})</div>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 18px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{total}<span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 400 }}>/{test.total_marks}</span></div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 18px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Out of 100</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: outOf100 >= 75 ? '#34d399' : outOf100 >= 50 ? '#fbbf24' : '#f87171' }}>{outOf100}</div>
                      </div>
                    </div>

                    <button
                      style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                      onClick={() => handleSave(card.id)}
                      disabled={saving === card.id}
                    >
                      {saving === card.id ? 'Saving…' : '💾 Save Marks'}
                    </button>
                  </>
                )}

                {!test && (
                  <p style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>Select a subject and test above to enter your marks.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
