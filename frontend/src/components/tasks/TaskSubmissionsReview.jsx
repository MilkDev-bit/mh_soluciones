import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  getReviewBoard, claimSubmission, releaseSubmission, extendTaskDeadline,
} from '../../services/taskService';
import {
  FiUser, FiCalendar, FiAward, FiMessageSquare, FiFile, FiDownload, FiClock, FiLink,
  FiRefreshCw, FiLock, FiUnlock, FiCheckCircle, FiAlertTriangle, FiCalendar as FiExtend,
} from 'react-icons/fi';
import GradeSubmissionForm from './GradeSubmissionForm';
import Modal from '../common/Modal';
import Loading from '../common/Loading';
import { invalidateTaskQueries } from '../../utils/taskCache';
import {
  BOARD_STATE, submissionStatusLabel, submissionStatusClass, formatDateTime, apiErrorMessage,
} from '../../utils/taskStatus';
import './TaskSubmissionsReview.scss';
import { confirmDialog } from '../common/ConfirmDialog';

/**
 * Tablero de revisión por alumno.
 *
 * Antes: solo listaba a quien ya había entregado, mezclaba versiones y no
 * mostraba quién estaba revisando, así que dos revisores calificaban la misma
 * entrega y se pisaban. Ahora:
 *  - una fila por alumno asignado, incluidos los que no han entregado;
 *  - filtros por estado: por revisar, mías, de otros revisores, devueltas,
 *    sin entrega y aprobadas;
 *  - "Tomar" bloquea la entrega para los demás revisores; "Soltar" la libera;
 *  - "Dar prórroga" amplía el plazo SOLO a ese alumno, sin editar la tarea.
 */
const FILTERS = [
  { key: 'TO_REVIEW', label: 'Por revisar' },
  { key: 'MINE', label: 'Mis revisiones' },
  { key: 'OTHERS', label: 'Con otro revisor' },
  { key: 'CHANGES_REQUESTED', label: 'Devueltas' },
  { key: 'MISSING', label: 'Sin entrega' },
  { key: 'APPROVED', label: 'Aprobadas' },
  { key: 'ALL', label: 'Todas' },
];

const SubmissionFiles = ({ submission }) => {
  const docs = submission.documents || [];
  const meta = submission.files_metadata || [];
  const hasDocs = docs.length > 0;
  const hasMeta = !hasDocs && meta.length > 0;
  const hasDriveLink = !hasDocs && !hasMeta && submission.google_drive_link && submission.uploaded_to_drive;
  const hasDirectFile = !hasDocs && !hasMeta && !hasDriveLink && submission.file;
  if (!hasDocs && !hasMeta && !hasDriveLink && !hasDirectFile) return null;

  return (
    <div className="submission-files">
      <h5><FiFile /> Archivos entregados:</h5>
      <div className="files-list">
        {hasDocs && docs.map((doc) => (
          <div key={doc.id} className="file-item">
            {doc.is_link ? <FiLink /> : <FiFile />}
            <div className="file-info">
              <span className="file-name">{doc.name}</span>
              {!doc.is_link && doc.file_size && (
                <span className="file-size">{(doc.file_size / 1024).toFixed(1)} KB</span>
              )}
            </div>
            <div className="file-actions">
              {doc.is_link ? (
                <a href={doc.link} target="_blank" rel="noopener noreferrer" className="file-download"><FiLink /> Abrir enlace</a>
              ) : doc.drive_file_url ? (
                <a href={doc.drive_file_url} target="_blank" rel="noopener noreferrer" className="file-download"><FiLink /> Drive</a>
              ) : doc.file_url ? (
                <a href={doc.file_url} download className="file-download"><FiDownload /> Descargar</a>
              ) : (
                <span className="file-pending">⏳ Subiendo a Drive...</span>
              )}
            </div>
          </div>
        ))}
        {hasMeta && meta.map((file, idx) => (
          <div key={idx} className="file-item">
            <FiFile />
            <div className="file-info"><span className="file-name">{file.name}</span></div>
            <div className="file-actions">
              {file.web_view_link && (
                <a href={file.web_view_link} target="_blank" rel="noopener noreferrer" className="file-download"><FiLink /> Drive</a>
              )}
            </div>
          </div>
        ))}
        {hasDriveLink && (
          <div className="file-item">
            <FiLink />
            <div className="file-info"><span className="file-name">Archivo en Google Drive</span></div>
            <div className="file-actions">
              <a href={submission.google_drive_link} target="_blank" rel="noopener noreferrer" className="file-download"><FiLink /> Abrir en Drive</a>
            </div>
          </div>
        )}
        {hasDirectFile && (
          <div className="file-item">
            <FiFile />
            <div className="file-info"><span className="file-name">Archivo adjunto</span></div>
            <div className="file-actions">
              <a href={submission.file} download className="file-download"><FiDownload /> Descargar</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SubmissionBody = ({ submission, maxScore }) => (
  <>
    {submission.notes && (
      <div className="submission-notes"><FiMessageSquare /><p>{submission.notes}</p></div>
    )}
    {submission.link && (
      <div className="submission-link">
        <FiLink />
        <a href={submission.link} target="_blank" rel="noopener noreferrer">{submission.link}</a>
      </div>
    )}
    <SubmissionFiles submission={submission} />
    {submission.graded_at && (
      <div className="grading-info">
        <div className="grade-header">
          <FiAward className="grade-icon" />
          <h5>{submission.status === 'CHANGES_REQUESTED' ? 'Cambios solicitados' : 'Revisión'}</h5>
        </div>
        <div className="grade-details">
          {submission.score !== null && submission.score !== undefined && (
            <div className="grade-score">
              <strong>Puntuación:</strong>
              <span className="score-value">{submission.score}/{maxScore}</span>
            </div>
          )}
          {submission.teacher_feedback && (
            <div className="grade-feedback"><strong>Retroalimentación:</strong><p>{submission.teacher_feedback}</p></div>
          )}
          <div className="grade-date">
            <FiClock />
            {formatDateTime(submission.graded_at, "dd MMM yyyy 'a las' HH:mm")}
            {submission.graded_by_user && ` · ${submission.graded_by_user.first_name || ''} ${submission.graded_by_user.last_name || ''}`}
          </div>
        </div>
      </div>
    )}
  </>
);

const TaskSubmissionsReview = ({ task, user }) => {
  const queryClient = useQueryClient();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('TO_REVIEW');
  const [expanded, setExpanded] = useState(null);
  const [grading, setGrading] = useState(null);
  const [busy, setBusy] = useState(null);
  const [extendFor, setExtendFor] = useState(null);
  const [extendDays, setExtendDays] = useState(2);

  const isAdmin = ['SUPERADMIN', 'ADMIN', 'CEO'].includes(user?.role);

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      setBoard(await getReviewBoard(task.id));
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Error al cargar las entregas'));
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  const rows = useMemo(() => {
    const all = board?.rows || [];
    const reviewerId = (r) => r.latest_submission?.reviewer_user?.id;
    switch (filter) {
      case 'ALL': return all;
      case 'MINE': return all.filter(r => r.state === 'IN_REVIEW' && reviewerId(r) === user?.id);
      case 'OTHERS': return all.filter(r => r.state === 'IN_REVIEW' && reviewerId(r) !== user?.id);
      default: return all.filter(r => r.state === filter);
    }
  }, [board, filter, user?.id]);

  const counts = useMemo(() => {
    const s = board?.summary || {};
    return {
      TO_REVIEW: s.to_review || 0,
      MINE: s.in_review_mine || 0,
      OTHERS: (s.in_review || 0) - (s.in_review_mine || 0),
      CHANGES_REQUESTED: s.changes_requested || 0,
      MISSING: s.missing || 0,
      APPROVED: s.approved || 0,
      ALL: s.total || 0,
    };
  }, [board]);

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(res?.message || successMsg);
      invalidateTaskQueries(queryClient);
      await fetchBoard();
      return res;
    } catch (error) {
      toast.error(apiErrorMessage(error, 'No se pudo completar la acción'));
      await fetchBoard();
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleClaim = async (row, force = false) => {
    const sub = row.latest_submission;
    const res = await run(`claim-${sub.id}`, () => claimSubmission(task.id, sub.id, force), 'Entrega asignada a ti');
    if (res?.submission) setGrading(res.submission);
  };

  const handleRelease = (row) =>
    run(`release-${row.latest_submission.id}`,
      () => releaseSubmission(task.id, row.latest_submission.id), 'Entrega liberada');

  const handleExtend = async (row) => {
    const days = parseInt(extendDays, 10);
    if (!days || days < 1) {
      toast.error('Indica al menos 1 día de prórroga.');
      return;
    }
    await run(`extend-${row.student.id}`,
      () => extendTaskDeadline(task.id, { studentIds: [row.student.id], days,
        reason: `Prórroga de ${days} día(s) desde el tablero de revisión` }),
      'Prórroga otorgada');
    setExtendFor(null);
  };

  const handleGradeComplete = async () => {
    setGrading(null);
    // Aprobar / pedir cambios cambia pendientes, desempeño y panel.
    invalidateTaskQueries(queryClient);
    await fetchBoard();
  };

  if (loading && !board) return <Loading text="Cargando entregas..." />;

  const maxScore = board?.task?.max_score ?? task.max_score;

  return (
    <div className="task-submissions-review">
      {grading && (
        <Modal title="Revisar Entrega" onClose={() => setGrading(null)} size="large" zIndex={10050}>
          <GradeSubmissionForm
            task={task}
            submission={grading}
            onGradeComplete={handleGradeComplete}
            onCancel={() => setGrading(null)}
          />
        </Modal>
      )}

      <div className="review-header">
        <h2>Revisión de entregas</h2>
        <div className="task-info">
          <span className="task-name">{task.title}</span>
          <span className="submissions-count">{counts.ALL} alumno(s)</span>
          {board?.task?.is_continuous ? (
            <span className="review-deadline">Actividad continua · sin vencimiento</span>
          ) : board?.task?.deadline && (
            <span className="review-deadline"><FiCalendar /> Vence: {formatDateTime(board.task.deadline)}</span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={fetchBoard} disabled={loading} title="Actualizar">
            <FiRefreshCw className={loading ? 'spinning' : ''} />
          </button>
        </div>
        <div className="review-filters" role="tablist">
          {FILTERS.map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`review-filter ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <FiCheckCircle size={48} />
          <p>{filter === 'TO_REVIEW' ? 'No hay entregas pendientes de revisar.' : 'No hay alumnos en esta categoría.'}</p>
        </div>
      ) : (
        <div className="students-list">
          {rows.map((row) => {
            const sub = row.latest_submission;
            const state = BOARD_STATE[row.state];
            const reviewer = sub?.reviewer_user;
            const reviewedByMe = reviewer?.id === user?.id;
            const isExpanded = expanded === row.student.id;
            const canDecide = sub && (row.state === 'TO_REVIEW' || (row.state === 'IN_REVIEW' && (reviewedByMe || isAdmin)));

            return (
              <div key={row.student.id} className={`student-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="student-header" onClick={() => setExpanded(isExpanded ? null : row.student.id)}>
                  <div className="student-info">
                    <div className="student-avatar">{row.student.full_name.charAt(0)}</div>
                    <div className="student-details">
                      <h3 className="student-name">{row.student.full_name}</h3>
                      <span className="student-email">{row.student.email}</span>
                    </div>
                  </div>

                  <div className="submission-summary" onClick={(e) => e.stopPropagation()}>
                    <span className="board-state" style={{ background: state.color }}>{state.label}</span>
                    {sub?.is_late && <span className="late-chip" title="Entregada después de la fecha límite"><FiAlertTriangle /> Tardía</span>}
                    {row.state === 'IN_REVIEW' && reviewer && (
                      <span className="reviewer-chip"><FiLock /> {reviewedByMe ? 'Tú' : reviewer.full_name}</span>
                    )}
                    {sub && sub.score !== null && sub.score !== undefined && (
                      <span className="submission-score"><FiAward />{sub.score}/{maxScore}</span>
                    )}
                    {sub && <span className="submission-version">v{sub.version}</span>}

                    {/* Acciones según el estado */}
                    {row.state === 'TO_REVIEW' && (
                      <button className="btn btn-primary btn-sm" disabled={busy === `claim-${sub.id}`} onClick={() => handleClaim(row)}>
                        <FiAward /> Revisar
                      </button>
                    )}
                    {row.state === 'IN_REVIEW' && reviewedByMe && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => setGrading(sub)}><FiAward /> Continuar</button>
                        <button className="btn btn-secondary btn-sm" disabled={busy === `release-${sub.id}`} onClick={() => handleRelease(row)}>
                          <FiUnlock /> Soltar
                        </button>
                      </>
                    )}
                    {row.state === 'IN_REVIEW' && !reviewedByMe && isAdmin && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: 'Reasignar revisión',
                            message: `${reviewer?.full_name || 'Otro revisor'} está revisando esta entrega. ¿Reasignártela?`,
                            confirmText: 'Reasignarme',
                          });
                          if (ok) handleClaim(row, true);
                        }}
                      >
                        <FiLock /> Reasignarme
                      </button>
                    )}
                    {['MISSING', 'CHANGES_REQUESTED'].includes(row.state) && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setExtendFor(extendFor === row.student.id ? null : row.student.id)}>
                        <FiExtend /> Dar prórroga
                      </button>
                    )}
                  </div>
                </div>

                {extendFor === row.student.id && (
                  <div className="extend-box" onClick={(e) => e.stopPropagation()}>
                    <p className="window-message">{row.window.message}</p>
                    <label>
                      Permitir entregar durante
                      <input type="number" min="1" max="60" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
                      día(s) más (hasta las 23:59)
                    </label>
                    <button className="btn btn-primary btn-sm" disabled={busy === `extend-${row.student.id}`} onClick={() => handleExtend(row)}>
                      Confirmar prórroga
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="student-submissions">
                    {!sub ? (
                      <p className="window-message">{row.window.message}</p>
                    ) : (
                      <div className="submission-item">
                        <div className="submission-header">
                          <div className="submission-meta">
                            <span className="submission-version-badge">Versión {sub.version} (actual)</span>
                            <span className="submission-date"><FiCalendar />{formatDateTime(sub.created_at, "dd MMM yyyy 'a las' HH:mm")}</span>
                            <span className={`submission-status ${submissionStatusClass(sub)}`}>{submissionStatusLabel(sub)}</span>
                          </div>
                          {canDecide && row.state === 'IN_REVIEW' && (
                            <button className="btn btn-primary btn-sm" onClick={() => setGrading(sub)}><FiAward /> Decidir</button>
                          )}
                        </div>
                        <SubmissionBody submission={sub} maxScore={maxScore} />
                      </div>
                    )}

                    {row.history.length > 0 && (
                      <>
                        <h4>Versiones anteriores ({row.history.length})</h4>
                        {row.history.map((old) => (
                          <div key={old.id} className="submission-item previous">
                            <div className="submission-header">
                              <div className="submission-meta">
                                <span className="submission-version-badge">Versión {old.version}</span>
                                <span className="submission-date"><FiCalendar />{formatDateTime(old.created_at, "dd MMM yyyy 'a las' HH:mm")}</span>
                                <span className={`submission-status ${submissionStatusClass(old)}`}>{submissionStatusLabel(old)}</span>
                              </div>
                            </div>
                            <SubmissionBody submission={old} maxScore={maxScore} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskSubmissionsReview;
