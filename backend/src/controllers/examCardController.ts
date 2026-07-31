import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { pool } from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkSplitInput {
  label: string;
  marks_each: number;
  question_count: number;
  display_order?: number;
}

interface TestInput {
  test_name: string;
  total_marks: number;
  display_order?: number;
  splits: MarkSplitInput[];
}

interface SubjectInput {
  subject_name: string;
  display_order?: number;
  tests: TestInput[];
}

// ─── Superadmin: Create a full exam card ─────────────────────────────────────

// POST /api/exam-cards
export const createCard = asyncWrap(async (req, res) => {
  const { title, semester, year_assigned, subjects } = req.body as {
    title: string;
    semester: string;
    year_assigned: string;
    subjects: SubjectInput[];
  };

  if (!title?.trim()) throw new HttpError(400, 'title is required');
  if (!semester?.trim()) throw new HttpError(400, 'semester is required');
  if (!year_assigned?.trim()) throw new HttpError(400, 'year_assigned is required');
  if (!Array.isArray(subjects) || subjects.length === 0) throw new HttpError(400, 'At least one subject is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cardResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO exam_cards (title, semester, year_assigned, created_by) VALUES (?, ?, ?, ?)`,
      [title.trim(), semester.trim(), year_assigned.trim(), req.user?.username ?? null]
    );
    const cardId = cardResult.insertId;

    for (let si = 0; si < subjects.length; si++) {
      const subj = subjects[si];
      if (!subj.subject_name?.trim()) throw new HttpError(400, `Subject at index ${si} has no name`);

      const [subjResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO exam_subjects (card_id, subject_name, display_order) VALUES (?, ?, ?)`,
        [cardId, subj.subject_name.trim(), si]
      );
      const subjId = subjResult.insertId;

      const tests: TestInput[] = Array.isArray(subj.tests) ? subj.tests : [];
      for (let ti = 0; ti < tests.length; ti++) {
        const test = tests[ti];
        if (!test.test_name?.trim()) throw new HttpError(400, `Test at subject ${si}, index ${ti} has no name`);
        const totalMarks = Number(test.total_marks) || 0;
        if (totalMarks <= 0) throw new HttpError(400, `Test "${test.test_name}" must have total_marks > 0`);

        const [testResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO exam_tests (subject_id, test_name, total_marks, display_order) VALUES (?, ?, ?, ?)`,
          [subjId, test.test_name.trim(), totalMarks, ti]
        );
        const testId = testResult.insertId;

        const splits: MarkSplitInput[] = Array.isArray(test.splits) ? test.splits : [];
        if (splits.length > 0) {
          await conn.query(
            `INSERT INTO exam_mark_splits (test_id, label, marks_each, total_questions, question_count, display_order) VALUES ?`,
            [
              splits.map((sp: any, i: number) => [
                testId,
                sp.label,
                Number(sp.marks_each) || 0,
                Number(sp.total_questions) || 0,
                Number(sp.question_count) || 1,
                i,
              ]),
            ]
          );
        }
      }
    }

    await conn.commit();
    return res.status(201).json({ id: cardId, message: 'Exam card created successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Superadmin: List all cards ───────────────────────────────────────────────

// GET /api/exam-cards
export const listCards = asyncWrap(async (_req, res) => {
  const [cards] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, semester, year_assigned, status, created_by, created_at
     FROM exam_cards ORDER BY created_at DESC`
  );
  return res.json({ data: cards });
});

// ─── Get full card structure (with subjects/tests/splits) ─────────────────────

// GET /api/exam-cards/:id
export const getCard = asyncWrap(async (req, res) => {
  const cardId = Number(req.params.id);
  if (!cardId) throw new HttpError(400, 'Invalid card id');

  const [[card]] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, semester, year_assigned, status, created_by, created_at FROM exam_cards WHERE id = ?`,
    [cardId]
  );
  if (!card) throw new HttpError(404, 'Exam card not found');

  const [subjects] = await pool.query<RowDataPacket[]>(
    `SELECT id, subject_name, display_order FROM exam_subjects WHERE card_id = ? ORDER BY display_order`,
    [cardId]
  );

  for (const subj of subjects) {
    const [tests] = await pool.query<RowDataPacket[]>(
      `SELECT id, test_name, total_marks, display_order FROM exam_tests WHERE subject_id = ? ORDER BY display_order`,
      [subj.id]
    );
    for (const test of tests) {
      const [splits] = await pool.query<RowDataPacket[]>(
        `SELECT id, label, marks_each, total_questions, question_count, display_order 
           FROM exam_mark_splits WHERE test_id = ? ORDER BY display_order`,
        [test.id]
      );
      (test as Record<string, unknown>).splits = splits;
    }
    (subj as Record<string, unknown>).tests = tests;
  }

  return res.json({ data: { ...card, subjects } });
});

// ─── Superadmin: Update a card ──────────────────────────────────────────────

// PUT /api/exam-cards/:id
export const updateCard = asyncWrap(async (req, res) => {
  const cardId = Number(req.params.id);
  if (!cardId) throw new HttpError(400, 'Invalid card id');

  const { title, semester, year_assigned, subjects } = req.body;
  if (!title || !semester || !year_assigned) throw new HttpError(400, 'Missing required fields');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE exam_cards SET title = ?, semester = ?, year_assigned = ? WHERE id = ?`,
      [title, semester, year_assigned, cardId]
    );

    const [existingSubjs] = await conn.query<RowDataPacket[]>(`SELECT id FROM exam_subjects WHERE card_id = ?`, [cardId]);
    const existingSubjIds = existingSubjs.map((s) => s.id as number);

    const keepSubjIds = new Set<number>();
    const keepTestIds = new Set<number>();
    const keepSplitIds = new Set<number>();

    const reqSubjects: SubjectInput[] = Array.isArray(subjects) ? subjects : [];
    for (let si = 0; si < reqSubjects.length; si++) {
      const subj = reqSubjects[si];
      let subjId = subj.id ? Number(subj.id) : 0;
      
      if (subjId && existingSubjIds.includes(subjId)) {
        await conn.query(`UPDATE exam_subjects SET subject_name = ?, display_order = ? WHERE id = ?`, [subj.subject_name, si, subjId]);
      } else {
        const [res] = await conn.query<ResultSetHeader>(
          `INSERT INTO exam_subjects (card_id, subject_name, display_order) VALUES (?, ?, ?)`,
          [cardId, subj.subject_name, si]
        );
        subjId = res.insertId;
      }
      keepSubjIds.add(subjId);

      const tests: TestInput[] = Array.isArray(subj.tests) ? subj.tests : [];
      for (let ti = 0; ti < tests.length; ti++) {
        const test = tests[ti];
        let testId = test.id ? Number(test.id) : 0;
        
        if (testId) {
          await conn.query(`UPDATE exam_tests SET test_name = ?, total_marks = ?, display_order = ? WHERE id = ?`, 
            [test.test_name, Number(test.total_marks) || 0, ti, testId]);
        } else {
          const [res] = await conn.query<ResultSetHeader>(
            `INSERT INTO exam_tests (subject_id, test_name, total_marks, display_order) VALUES (?, ?, ?, ?)`,
            [subjId, test.test_name, Number(test.total_marks) || 0, ti]
          );
          testId = res.insertId;
        }
        keepTestIds.add(testId);

        const splits: MarkSplitInput[] = Array.isArray(test.splits) ? test.splits : [];
        for (let spi = 0; spi < splits.length; spi++) {
          const sp = splits[spi];
          let splitId = sp.id ? Number(sp.id) : 0;
          
          if (splitId) {
            await conn.query(
              `UPDATE exam_mark_splits SET label = ?, marks_each = ?, total_questions = ?, question_count = ?, display_order = ? WHERE id = ?`,
              [sp.label, Number(sp.marks_each) || 0, Number(sp.total_questions) || 0, Number(sp.question_count) || 1, spi, splitId]
            );
          } else {
            const [res] = await conn.query<ResultSetHeader>(
              `INSERT INTO exam_mark_splits (test_id, label, marks_each, total_questions, question_count, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
              [testId, sp.label, Number(sp.marks_each) || 0, Number(sp.total_questions) || 0, Number(sp.question_count) || 1, spi]
            );
            splitId = res.insertId;
          }
          keepSplitIds.add(splitId);
        }
      }
    }

    // Cascade deletions for removed items
    if (existingSubjIds.length > 0) {
      const [oldTests] = await conn.query<RowDataPacket[]>(`SELECT id FROM exam_tests WHERE subject_id IN (?)`, [existingSubjIds]);
      const oldTestIds = oldTests.map((t) => t.id as number);
      
      if (oldTestIds.length > 0) {
        const [oldSplits] = await conn.query<RowDataPacket[]>(`SELECT id FROM exam_mark_splits WHERE test_id IN (?)`, [oldTestIds]);
        const splitsToDelete = oldSplits.map((s) => s.id as number).filter((id) => !keepSplitIds.has(id));
        
        if (splitsToDelete.length > 0) {
          await conn.query(`DELETE FROM exam_student_marks WHERE split_id IN (?)`, [splitsToDelete]);
          await conn.query(`DELETE FROM exam_mark_splits WHERE id IN (?)`, [splitsToDelete]);
        }
        
        const testsToDelete = oldTestIds.filter((id) => !keepTestIds.has(id));
        if (testsToDelete.length > 0) {
          await conn.query(`DELETE FROM exam_tests WHERE id IN (?)`, [testsToDelete]);
        }
      }
      
      const subjsToDelete = existingSubjIds.filter((id) => !keepSubjIds.has(id));
      if (subjsToDelete.length > 0) {
        await conn.query(`DELETE FROM exam_subjects WHERE id IN (?)`, [subjsToDelete]);
      }
    }

    await conn.commit();
    return res.json({ message: 'Exam card updated successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Superadmin: Toggle card status ──────────────────────────────────────────

// PATCH /api/exam-cards/:id/status  { status: 'active' | 'disabled' }
export const updateStatus = asyncWrap(async (req, res) => {
  const cardId = Number(req.params.id);
  if (!cardId) throw new HttpError(400, 'Invalid card id');
  const status = String(req.body?.status ?? '').trim();
  if (!['active', 'disabled'].includes(status)) throw new HttpError(400, 'status must be active or disabled');

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE exam_cards SET status = ? WHERE id = ?`, [status, cardId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Exam card not found');
  return res.json({ message: `Card ${status === 'active' ? 'enabled' : 'disabled'}` });
});

// ─── Superadmin: Delete a card (cascade) ─────────────────────────────────────

// DELETE /api/exam-cards/:id
export const deleteCard = asyncWrap(async (req, res) => {
  const cardId = Number(req.params.id);
  if (!cardId) throw new HttpError(400, 'Invalid card id');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get all split IDs for this card to cascade-delete marks
    const [splitRows] = await conn.query<RowDataPacket[]>(
      `SELECT ems.id FROM exam_mark_splits ems
       JOIN exam_tests et ON ems.test_id = et.id
       JOIN exam_subjects es ON et.subject_id = es.id
       WHERE es.card_id = ?`,
      [cardId]
    );
    const splitIds = splitRows.map((r) => r.id as number);
    if (splitIds.length > 0) {
      await conn.query(`DELETE FROM exam_student_marks WHERE split_id IN (?)`, [splitIds]);
    }

    // Get all test IDs
    const [testRows] = await conn.query<RowDataPacket[]>(
      `SELECT et.id FROM exam_tests et JOIN exam_subjects es ON et.subject_id = es.id WHERE es.card_id = ?`,
      [cardId]
    );
    const testIds = testRows.map((r) => r.id as number);
    if (testIds.length > 0) {
      await conn.query(`DELETE FROM exam_mark_splits WHERE test_id IN (?)`, [testIds]);
    }

    const [subjRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM exam_subjects WHERE card_id = ?`, [cardId]
    );
    const subjIds = subjRows.map((r) => r.id as number);
    if (subjIds.length > 0) {
      await conn.query(`DELETE FROM exam_tests WHERE subject_id IN (?)`, [subjIds]);
    }

    await conn.query(`DELETE FROM exam_subjects WHERE card_id = ?`, [cardId]);
    const [delResult] = await conn.query<ResultSetHeader>(`DELETE FROM exam_cards WHERE id = ?`, [cardId]);
    if (delResult.affectedRows === 0) throw new HttpError(404, 'Exam card not found');

    await conn.commit();
    return res.json({ message: 'Exam card deleted' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Student: Get active cards for their year ─────────────────────────────────

// GET /api/exam-cards/student/:studentId
export const getStudentCards = asyncWrap(async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!studentId) throw new HttpError(400, 'Invalid student id');

  // Verify access: student can only see own cards, staff can see any
  if (req.user?.role === 'student' && req.user.student_id !== studentId) {
    throw new HttpError(403, 'Access denied');
  }

  const [[student]] = await pool.query<RowDataPacket[]>(
    `SELECT year FROM students WHERE id = ?`, [studentId]
  );
  if (!student) throw new HttpError(404, 'Student not found');

  const [cards] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, semester, year_assigned, status, created_at
     FROM exam_cards WHERE year_assigned = ? AND status = 'active' ORDER BY created_at DESC`,
    [student.year]
  );

  // Attach full structure to each card
  for (const card of cards) {
    const [subjects] = await pool.query<RowDataPacket[]>(
      `SELECT id, subject_name, display_order FROM exam_subjects WHERE card_id = ? ORDER BY display_order`,
      [card.id]
    );
    for (const subj of subjects) {
      const [tests] = await pool.query<RowDataPacket[]>(
        `SELECT id, test_name, total_marks, display_order FROM exam_tests WHERE subject_id = ? ORDER BY display_order`,
        [subj.id]
      );
      for (const test of tests) {
        const [splits] = await pool.query<RowDataPacket[]>(
          `SELECT id, label, marks_each, total_questions, question_count, display_order FROM exam_mark_splits WHERE test_id = ? ORDER BY display_order`,
          [test.id]
        );
        // Attach student's existing scores
        const splitIds = splits.map((s) => s.id as number);
        const [marks] = await pool.query<RowDataPacket[]>(
          `SELECT split_id, score, question_scores FROM exam_student_marks 
           WHERE student_id = ? AND split_id IN (?)`,
          [studentId, splitIds.length ? splitIds : [0]]
        );
        const markMap = new Map(marks.map((m) => [m.split_id as number, m]));
        (test as Record<string, unknown>).splits = splits.map((sp) => {
          const m = markMap.get(sp.id as number);
          return {
            ...sp,
            score: m ? Number(m.score) : null,
            question_scores: m?.question_scores ? (typeof m.question_scores === 'string' ? JSON.parse(m.question_scores) : m.question_scores) : null,
          };
        });
      }
      (subj as Record<string, unknown>).tests = tests;
    }
    (card as Record<string, unknown>).subjects = subjects;
  }

  return res.json({ data: cards });
});

// ─── Student: Submit / update marks for splits ───────────────────────────────

// PUT /api/exam-cards/marks  { entries: [{split_id, score}] }
export const saveMarks = asyncWrap(async (req, res) => {
  const studentId = req.user?.role === 'student'
    ? req.user.student_id
    : Number(req.body?.student_id);
  if (!studentId) throw new HttpError(400, 'student_id is required');

  const entries: { split_id: number; score: number; question_scores?: (number | null)[] }[] = Array.isArray(req.body?.entries)
    ? req.body.entries
    : [];
  if (entries.length === 0) throw new HttpError(400, 'entries array is required');

  // Validate: verify each split belongs to an active card assigned to this student's year
  const splitIds = entries.map((e) => Number(e.split_id));
  const [validSplits] = await pool.query<RowDataPacket[]>(
    `SELECT ems.id, ems.marks_each, ems.question_count
     FROM exam_mark_splits ems
     JOIN exam_tests et   ON ems.test_id   = et.id
     JOIN exam_subjects es ON et.subject_id = es.id
     JOIN exam_cards ec   ON es.card_id    = ec.id
     JOIN students st     ON st.year       = ec.year_assigned
     WHERE ems.id IN (?) AND ec.status = 'active' AND st.id = ?`,
    [splitIds, studentId]
  );
  const validMap = new Map(validSplits.map((r) => [r.id as number, r]));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const entry of entries) {
      const split = validMap.get(Number(entry.split_id));
      if (!split) continue; 
      const max = split.marks_each * split.question_count;
      const score = Math.min(Math.max(Number(entry.score) || 0, 0), max);
      const qScores = Array.isArray(entry.question_scores) ? JSON.stringify(entry.question_scores) : null;

      await conn.query(
        `INSERT INTO exam_student_marks (split_id, student_id, score, question_scores)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), question_scores = VALUES(question_scores), updated_at = CURRENT_TIMESTAMP`,
        [split.id, studentId, score, qScores]
      );
    }
    await conn.commit();
    return res.json({ message: 'Marks saved' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Superadmin: View all students' marks for a specific test ─────────────────

// GET /api/exam-cards/:cardId/marks?subject_id=&test_id=
export const getTestMarks = asyncWrap(async (req, res) => {
  const cardId = Number(req.params.cardId);
  const testId = Number(req.query.test_id);
  if (!cardId || !testId) throw new HttpError(400, 'cardId and test_id are required');

  // Verify test belongs to card
  const [testRows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id as test_id, t.test_name, t.total_marks,
            ec.year_assigned,
            s.id as split_id, s.label, s.marks_each, s.total_questions, s.question_count, s.display_order
     FROM exam_tests t
     JOIN exam_subjects es ON t.subject_id = es.id
     JOIN exam_cards ec ON es.card_id = ec.id
     JOIN exam_mark_splits s ON s.test_id = t.id
     WHERE ec.id = ? AND t.id = ?
     ORDER BY s.display_order`,
    [cardId, testId]
  );
  if (!testRows.length) throw new HttpError(404, 'Test not found in this card');

  // Get all students of this year
  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, register_number, section FROM students WHERE year = ? ORDER BY name`,
    [testRows[0].year_assigned]
  );

  // Get all marks for this test
  const splitIds = testRows.map((s) => s.split_id as number);
  let allMarks: RowDataPacket[] = [];
  if (splitIds.length > 0) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT split_id, student_id, score FROM exam_student_marks
       WHERE split_id IN (?) AND student_id IN (?)`,
      [splitIds, students.length > 0 ? students.map((s) => s.id) : [0]]
    );
    allMarks = rows;
  }

  // Build mark map: student_id → split_id → score
  const markMap = new Map<number, Map<number, number>>();
  for (const m of allMarks) {
    const sid = m.student_id as number;
    if (!markMap.has(sid)) markMap.set(sid, new Map());
    markMap.get(sid)!.set(m.split_id as number, Number(m.score));
  }

  const totalMarks = Number(testRows[0].total_marks) || 100;
  const splits = testRows.map((r) => ({
    id: r.split_id,
    label: r.label,
    marks_each: r.marks_each,
    total_questions: r.total_questions,
    question_count: r.question_count,
  }));

  const rows = students.map((st) => {
    const studentMarks = markMap.get(st.id as number) ?? new Map<number, number>();
    const splitScores = splits.map((sp) => ({
      split_id: sp.id,
      label: sp.label,
      marks_each: sp.marks_each,
      total_questions: sp.total_questions,
      question_count: sp.question_count,
      max: Number(sp.marks_each) * Number(sp.question_count),
      score: studentMarks.get(sp.id as number) ?? null,
    }));
    const total = splitScores.reduce((acc, s) => acc + (s.score ?? 0), 0);
    const outOf100 = totalMarks > 0 ? Math.round((total / totalMarks) * 100 * 100) / 100 : 0;
    return {
      student_id: st.id,
      name: st.name,
      register_number: st.register_number,
      section: st.section,
      splits: splitScores,
      total,
      out_of_100: outOf100,
    };
  });

  return res.json({
    data: {
      test_name: testRows[0].test_name,
      total_marks: totalMarks,
      year_assigned: testRows[0].year_assigned,
      splits,
      rows,
    },
  });
});
