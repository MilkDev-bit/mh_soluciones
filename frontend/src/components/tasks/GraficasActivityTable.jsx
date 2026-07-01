import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiSave, FiRefreshCw, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { updateTask } from '../../services/taskService';
import './GraficasActivityTable.scss';

const defaultRows = [
  { id: 1, semana: 'SEMANA 1', actos: 0, condiciones: 0, ft: 10, total_hh: 500, meta: 0.8, bajo: 0.7, alto: 1.4 },
  { id: 2, semana: 'SEMANA 2', actos: 0, condiciones: 1, ft: 11, total_hh: 550, meta: 0.8, bajo: 0.7, alto: 1.4 },
  { id: 3, semana: 'SEMANA 3', actos: 0, condiciones: 0, ft: 10, total_hh: 500, meta: 0.8, bajo: 0.7, alto: 1.4 },
  { id: 4, semana: 'SEMANA 4', actos: 0, condiciones: 0, ft: 0, total_hh: 0, meta: 0.8, bajo: 0.7, alto: 1.4 },
  { id: 5, semana: 'SEMANA 5', actos: 0, condiciones: 0, ft: 0, total_hh: 0, meta: 0.8, bajo: 0.7, alto: 1.4 },
  { id: 6, semana: 'SEMANA 6', actos: 0, condiciones: 0, ft: 0, total_hh: 0, meta: 0.8, bajo: 0.7, alto: 1.4 },
];

export const calculateRowValues = (row) => {
  const totalHH = parseFloat(row.total_hh) || 0;
  const hhCorregidas = totalHH / 1000;
  const condiciones = parseFloat(row.condiciones) || 0;
  const actos = parseFloat(row.actos) || 0;

  let resultadoText = '0';
  let resultadoVal = 0;
  if (hhCorregidas === 0 || totalHH === 0) {
    resultadoText = '#DIV/0!';
    resultadoVal = 0;
  } else {
    resultadoVal = condiciones / hhCorregidas;
    resultadoText = Number.isInteger(resultadoVal) ? resultadoVal.toString() : resultadoVal.toFixed(9).replace(/\.?0+$/, '');
  }

  // Incidencias (Table 2) calculations
  const incidencias_kpi = actos + condiciones;
  const incidencias_campo = row.incidencias_campo !== undefined && row.incidencias_campo !== '' && row.incidencias_campo !== null
    ? parseFloat(row.incidencias_campo) || 0
    : incidencias_kpi * 4;
  const incidencias_total = incidencias_kpi + incidencias_campo;

  return {
    ...row,
    hh_corregidas: hhCorregidas,
    resultado: resultadoText,
    _resultadoNum: resultadoVal,
    incidencias_kpi,
    incidencias_campo,
    incidencias_total
  };
};

export const getGraficasData = (task, project) => {
  const pid = project?.id || (typeof task?.project === 'object' ? task?.project?.id : task?.project);
  
  // 1. Try task description marker
  if (task && task.description) {
    const match = task.description.match(/<!--\s*GRAFICAS_DATA:(.*?)\s*-->/s);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error parsing graficas data from description:', e);
      }
    }
  }

  // 2. Try localStorage project key
  if (pid) {
    try {
      const stored = localStorage.getItem(`graficas_data_project_${pid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
  }

  // 3. Try localStorage task key
  if (task && task.id) {
    try {
      const stored = localStorage.getItem(`graficas_data_task_${task.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
  }

  // 4. Return default initial rows
  return defaultRows;
};

const GraficasActivityTable = ({ task, project, onDataSaved }) => {
  const [rows, setRows] = useState(() => getGraficasData(task, project));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'

  const pid = project?.id || (typeof task?.project === 'object' ? task?.project?.id : task?.project);
  const projectName = project?.name || task?.project_name || 'MB VILLA JUAREZ DET. 2594';

  const persistLocally = useCallback((newRows) => {
    try {
      if (pid) localStorage.setItem(`graficas_data_project_${pid}`, JSON.stringify(newRows));
      if (task?.id) localStorage.setItem(`graficas_data_task_${task.id}`, JSON.stringify(newRows));
    } catch (e) {}
    
    // Notify external chart component
    window.dispatchEvent(new CustomEvent('graficasDataUpdated', { 
      detail: { projectId: pid, taskId: task?.id, rows: newRows } 
    }));
  }, [pid, task?.id]);

  const saveToDatabase = useCallback(async (rowsToSave, showToast = false) => {
    if (!task?.id) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      let desc = task.description || '';
      desc = desc.replace(/<!--\s*GRAFICAS_DATA:.*?-->/s, '').trim();
      const jsonStr = JSON.stringify(rowsToSave);
      const newDesc = desc ? `${desc}\n\n<!-- GRAFICAS_DATA:${jsonStr} -->` : `<!-- GRAFICAS_DATA:${jsonStr} -->`;
      
      await updateTask(task.id, { description: newDesc });
      task.description = newDesc;
      setSaveStatus('saved');
      if (showToast) {
        toast.success('📊 Tabla de gráficas guardada en la base de datos');
      }
      if (typeof onDataSaved === 'function') onDataSaved(task);
    } catch (error) {
      console.error('Error saving table to task description:', error);
      if (showToast) {
        toast.error('No se pudo conectar con el servidor, guardado localmente');
      }
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [task, onDataSaved]);

  // Debounced auto-save to database when rows change
  useEffect(() => {
    if (saveStatus !== 'saving') return;
    const timer = setTimeout(() => {
      saveToDatabase(rows, false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [rows, saveStatus, saveToDatabase]);

  const handleCellChange = (index, field, value) => {
    const newRows = [...rows];
    let parsedVal = value;
    if (field !== 'semana') {
      parsedVal = value === '' ? '' : (isNaN(value) ? value : value);
    }
    newRows[index] = { ...newRows[index], [field]: parsedVal };
    setRows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows);
  };

  const handleAddRow = () => {
    const nextNum = rows.length + 1;
    const newRow = {
      id: Date.now(),
      semana: `SEMANA ${nextNum}`,
      actos: 0,
      condiciones: 0,
      ft: 0,
      total_hh: 0,
      meta: 0.8,
      bajo: 0.7,
      alto: 1.4
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows);
  };

  const handleDeleteRow = (index) => {
    if (rows.length <= 1) {
      toast.error('Debe haber al menos una semana en la tabla');
      return;
    }
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows);
  };

  const handleResetDefault = () => {
    if (!window.confirm('¿Deseas restablecer la tabla a las 6 semanas iniciales?')) return;
    setRows(defaultRows);
    setSaveStatus('saving');
    persistLocally(defaultRows);
    saveToDatabase(defaultRows, true);
  };

  return (
    <div className="graficas-activity-table-wrapper style-spreadsheet">
      <div className="table-header-banner">
        {projectName}
      </div>
      
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th className="col-semana">SEMANA</th>
              <th className="col-actos">ACTOS INSEGUROS</th>
              <th className="col-condiciones">CONDICIONES INSEGURAS</th>
              <th className="col-ft">FT</th>
              <th className="col-total">TOTAL DE HORAS HOMBRE</th>
              <th className="col-corregidas">HH CORREGIDAS</th>
              <th className="col-resultado">RESULTADO</th>
              <th className="col-meta">META</th>
              <th className="col-bajo">BAJO</th>
              <th className="col-alto">ALTO</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const calc = calculateRowValues(row);
              return (
                <tr key={row.id || idx}>
                  <td className="cell-input">
                    <input
                      type="text"
                      value={row.semana !== undefined ? row.semana : `SEMANA ${idx + 1}`}
                      onChange={(e) => handleCellChange(idx, 'semana', e.target.value)}
                      placeholder={`SEMANA ${idx + 1}`}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.actos !== undefined ? row.actos : 0}
                      onChange={(e) => handleCellChange(idx, 'actos', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.condiciones !== undefined ? row.condiciones : 0}
                      onChange={(e) => handleCellChange(idx, 'condiciones', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.ft !== undefined ? row.ft : 0}
                      onChange={(e) => handleCellChange(idx, 'ft', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.total_hh !== undefined ? row.total_hh : 0}
                      onChange={(e) => handleCellChange(idx, 'total_hh', e.target.value)}
                    />
                  </td>
                  <td className="cell-readonly">
                    {calc.hh_corregidas}
                  </td>
                  <td className={`cell-readonly ${calc.resultado === '#DIV/0!' ? 'cell-error' : ''}`}>
                    {calc.resultado}
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.meta !== undefined ? row.meta : 0.8}
                      onChange={(e) => handleCellChange(idx, 'meta', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.bajo !== undefined ? row.bajo : 0.7}
                      onChange={(e) => handleCellChange(idx, 'bajo', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.alto !== undefined ? row.alto : 1.4}
                      onChange={(e) => handleCellChange(idx, 'alto', e.target.value)}
                    />
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn-delete-row"
                      onClick={() => handleDeleteRow(idx)}
                      title="Eliminar semana"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-header-banner" style={{ marginTop: '28px', backgroundColor: '#3b82f6' }}>
        {projectName} - INCIDENCIAS
      </div>
      
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th className="col-semana">SEMANA</th>
              <th className="col-actos">ACTOS INSEGUROS</th>
              <th className="col-condiciones">CONDICIONES INSEGURAS</th>
              <th className="col-kpi">INCIDENCIAS REGISTRADAS EN KPI (20%)</th>
              <th className="col-campo">INCIDENCIAS SOLVENTADAS EN CAMPO (80%)</th>
              <th className="col-total-inc">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const calc = calculateRowValues(row);
              return (
                <tr key={row.id ? `inc-${row.id}` : `inc-${idx}`}>
                  <td className="cell-input">
                    <input
                      type="text"
                      value={row.semana !== undefined ? row.semana : `SEMANA ${idx + 1}`}
                      onChange={(e) => handleCellChange(idx, 'semana', e.target.value)}
                      placeholder={`SEMANA ${idx + 1}`}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.actos !== undefined ? row.actos : 0}
                      onChange={(e) => handleCellChange(idx, 'actos', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.condiciones !== undefined ? row.condiciones : 0}
                      onChange={(e) => handleCellChange(idx, 'condiciones', e.target.value)}
                    />
                  </td>
                  <td className="cell-readonly" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#c2410c' }}>
                    {calc.incidencias_kpi}
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.incidencias_campo !== undefined && row.incidencias_campo !== '' ? row.incidencias_campo : calc.incidencias_campo}
                      onChange={(e) => handleCellChange(idx, 'incidencias_campo', e.target.value)}
                    />
                  </td>
                  <td className="cell-readonly" style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309', fontWeight: 'bold' }}>
                    {calc.incidencias_total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-footer-actions">
        <div className="footer-left">
          <button type="button" className="btn-add-row" onClick={handleAddRow}>
            <FiPlus /> Añadir Semana
          </button>
          <button type="button" className="btn-reset-table" onClick={handleResetDefault} title="Restablecer tabla por defecto">
            <FiRefreshCw />
          </button>
        </div>

        <div className="footer-right">
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' && <><FiClock className="spinning" /> Guardando en servidor...</>}
            {saveStatus === 'saved' && <><FiCheckCircle /> Datos guardados</>}
            {saveStatus === 'error' && <><FiAlertCircle /> Guardado local (error de red)</>}
          </span>
          
          <button
            type="button"
            className="btn-save-db"
            onClick={() => saveToDatabase(rows, true)}
            disabled={saving}
          >
            <FiSave /> {saving ? 'Guardando...' : 'Guardar Datos'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraficasActivityTable;
