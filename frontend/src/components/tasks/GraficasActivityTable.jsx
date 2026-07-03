import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiSave, FiRefreshCw, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { updateTask } from '../../services/taskService';
import './GraficasActivityTable.scss';

const defaultRows = [
  { id: 1, semana: 'SEMANA 1', actos: 0, condiciones: 0, accidentes_incapacitantes: 0, ft: 10, total_hh: 500, meta: 2.0, bajo: 1.0, alto: 3.5 },
  { id: 2, semana: 'SEMANA 2', actos: 0, condiciones: 1, accidentes_incapacitantes: 0, ft: 11, total_hh: 550, meta: 2.0, bajo: 1.0, alto: 3.5 },
  { id: 3, semana: 'SEMANA 3', actos: 0, condiciones: 0, accidentes_incapacitantes: 0, ft: 10, total_hh: 500, meta: 2.0, bajo: 1.0, alto: 3.5 },
  { id: 4, semana: 'SEMANA 4', actos: 0, condiciones: 0, accidentes_incapacitantes: 0, ft: 0, total_hh: 0, meta: 2.0, bajo: 1.0, alto: 3.5 },
  { id: 5, semana: 'SEMANA 5', actos: 0, condiciones: 0, accidentes_incapacitantes: 0, ft: 0, total_hh: 0, meta: 2.0, bajo: 1.0, alto: 3.5 },
  { id: 6, semana: 'SEMANA 6', actos: 0, condiciones: 0, accidentes_incapacitantes: 0, ft: 0, total_hh: 0, meta: 2.0, bajo: 1.0, alto: 3.5 },
];

export const calculateRowValues = (row, hoursFactor = 1000) => {
  const ftVal = parseFloat(row.ft) || 0;
  const totalHH = ftVal * 50;
  const hhCorregidas = totalHH / hoursFactor;
  const condiciones = parseFloat(row.condiciones) || 0;
  const actos = parseFloat(row.actos) || 0;

  let resultadoText = '0';
  let resultadoVal = 0;
  if (hhCorregidas === 0 || totalHH === 0) {
    resultadoText = '#DIV/0!';
    resultadoVal = 0;
  } else {
    resultadoVal = (actos + condiciones) / hhCorregidas;
    resultadoText = Number.isInteger(resultadoVal) ? resultadoVal.toString() : resultadoVal.toFixed(9).replace(/\.?0+$/, '');
  }

  // Incidencias (Table 2) calculations
  const incidencias_kpi = actos + condiciones;
  const incidencias_campo = row.incidencias_campo !== undefined && row.incidencias_campo !== '' && row.incidencias_campo !== null
    ? parseFloat(row.incidencias_campo) || 0
    : incidencias_kpi * 4;
  const incidencias_total = incidencias_kpi + incidencias_campo;

  const accidentes_incapacitantes = row.accidentes_incapacitantes !== undefined && row.accidentes_incapacitantes !== '' && row.accidentes_incapacitantes !== null
    ? parseFloat(row.accidentes_incapacitantes) || 0
    : 0;

  return {
    ...row,
    total_hh: totalHH,
    totalHH: totalHH,
    hh_corregidas: hhCorregidas,
    resultado: resultadoText,
    _resultadoNum: resultadoVal,
    incidencias_kpi,
    incidencias_campo,
    incidencias_total,
    accidentes_incapacitantes
  };
};

export const upgradeRowThresholds = (rows) => {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => {
    const metaVal = parseFloat(r.meta);
    const bajoVal = parseFloat(r.bajo);
    const altoVal = parseFloat(r.alto);
    return {
      ...r,
      meta: (metaVal === 0.8 || isNaN(metaVal)) ? 2.0 : metaVal,
      bajo: (bajoVal === 0.7 || isNaN(bajoVal)) ? 1.0 : bajoVal,
      alto: (altoVal === 1.4 || isNaN(altoVal)) ? 3.5 : altoVal,
    };
  });
};

export const getGraficasData = (task, project) => {
  const pid = project?.id || (typeof task?.project === 'object' ? task?.project?.id : task?.project);
  
  let rawData = null;

  // 1. Try task description marker
  if (task && task.description) {
    const match = task.description.match(/<!--\s*GRAFICAS_DATA:(.*?)\s*-->/s);
    if (match && match[1]) {
      try {
        rawData = JSON.parse(match[1]);
      } catch (e) {
        console.error('Error parsing graficas data from description:', e);
      }
    }
  }

  // 2. Try localStorage project key
  if (!rawData && pid) {
    try {
      const stored = localStorage.getItem(`graficas_data_project_${pid}`);
      if (stored) rawData = JSON.parse(stored);
    } catch (e) {}
  }

  // 3. Try localStorage task key
  if (!rawData && task && task.id) {
    try {
      const stored = localStorage.getItem(`graficas_data_task_${task.id}`);
      if (stored) rawData = JSON.parse(stored);
    } catch (e) {}
  }

  // If stored as Array (old format), both tables get a copy of that array
  if (Array.isArray(rawData) && rawData.length > 0) {
    const upgraded = upgradeRowThresholds(rawData);
    return { table1: upgraded, table2: JSON.parse(JSON.stringify(upgraded)) };
  }

  // If stored as object { table1, table2 }
  if (rawData && (Array.isArray(rawData.table1) || Array.isArray(rawData.table2))) {
    return {
      table1: Array.isArray(rawData.table1) && rawData.table1.length > 0 ? upgradeRowThresholds(rawData.table1) : defaultRows,
      table2: Array.isArray(rawData.table2) && rawData.table2.length > 0 ? upgradeRowThresholds(rawData.table2) : defaultRows
    };
  }

  // 4. Return default initial rows for both
  return {
    table1: defaultRows,
    table2: defaultRows
  };
};

const GraficasActivityTable = ({ task, project, onDataSaved }) => {
  const initialData = getGraficasData(task, project);
  const [table1Rows, setTable1Rows] = useState(() => initialData.table1);
  const [table2Rows, setTable2Rows] = useState(() => initialData.table2);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'

  const pid = project?.id || (typeof task?.project === 'object' ? task?.project?.id : task?.project);
  const projectName = project?.name || task?.project_name || 'MB VILLA JUAREZ DET. 2594';

  const persistLocally = useCallback((newTable1, newTable2) => {
    const dataToSave = { table1: newTable1, table2: newTable2 };
    try {
      if (pid) localStorage.setItem(`graficas_data_project_${pid}`, JSON.stringify(dataToSave));
      if (task?.id) localStorage.setItem(`graficas_data_task_${task.id}`, JSON.stringify(dataToSave));
    } catch (e) {}
    
    // Notify external chart component
    window.dispatchEvent(new CustomEvent('graficasDataUpdated', { 
      detail: { projectId: pid, taskId: task?.id, rows: dataToSave } 
    }));
  }, [pid, task?.id]);

  const saveToDatabase = useCallback(async (t1Rows, t2Rows, showToast = false) => {
    if (!task?.id) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      let desc = task.description || '';
      desc = desc.replace(/<!--\s*GRAFICAS_DATA:.*?-->/s, '').trim();
      const dataToSave = { table1: t1Rows, table2: t2Rows };
      const jsonStr = JSON.stringify(dataToSave);
      const newDesc = desc ? `${desc}\n\n<!-- GRAFICAS_DATA:${jsonStr} -->` : `<!-- GRAFICAS_DATA:${jsonStr} -->`;
      
      await updateTask(task.id, { description: newDesc });
      task.description = newDesc;
      setSaveStatus('saved');
      if (showToast) {
        toast.success('📊 Tablas de gráficas guardadas en la base de datos');
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
      saveToDatabase(table1Rows, table2Rows, false);
    }, 700);
    return () => clearTimeout(timer);
  }, [table1Rows, table2Rows, saveStatus, saveToDatabase]);

  const handleCellChange1 = (index, field, value) => {
    const newRows = [...table1Rows];
    let parsedVal = value;
    if (field !== 'semana') {
      parsedVal = value === '' ? '' : (isNaN(value) ? value : value);
    }
    const updatedRow = { ...newRows[index], [field]: parsedVal };
    const ftVal = parseFloat(field === 'ft' ? parsedVal : updatedRow.ft) || 0;
    updatedRow.total_hh = ftVal * 50;
    newRows[index] = updatedRow;
    setTable1Rows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows, table2Rows);
  };

  const handleAddRow1 = () => {
    let maxNum = 0;
    table1Rows.forEach(r => {
      const match = (r.semana || '').match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : table1Rows.length + 1;
    const newRow = {
      id: Date.now(),
      semana: `SEMANA ${nextNum}`,
      actos: 0,
      condiciones: 0,
      ft: 0,
      total_hh: 0,
      meta: 2.0,
      bajo: 1.0,
      alto: 3.5
    };
    const newRows = [...table1Rows, newRow];
    setTable1Rows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows, table2Rows);
  };

  const handleDeleteRow1 = (index) => {
    if (table1Rows.length <= 1) {
      toast.error('Debe haber al menos una semana en la tabla');
      return;
    }
    const newRows = table1Rows.filter((_, i) => i !== index);
    setTable1Rows(newRows);
    setSaveStatus('saving');
    persistLocally(newRows, table2Rows);
  };

  const handleResetDefault1 = () => {
    if (!window.confirm('¿Deseas restablecer la tabla de rendimiento a las 6 semanas iniciales?')) return;
    setTable1Rows(defaultRows);
    setSaveStatus('saving');
    persistLocally(defaultRows, table2Rows);
    saveToDatabase(defaultRows, table2Rows, true);
  };

  const handleCellChange2 = (index, field, value) => {
    const newRows = [...table2Rows];
    let parsedVal = value;
    if (field !== 'semana') {
      parsedVal = value === '' ? '' : (isNaN(value) ? value : value);
    }
    newRows[index] = { ...newRows[index], [field]: parsedVal };
    setTable2Rows(newRows);
    setSaveStatus('saving');
    persistLocally(table1Rows, newRows);
  };

  const handleAddRow2 = () => {
    let maxNum = 0;
    table2Rows.forEach(r => {
      const match = (r.semana || '').match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : table2Rows.length + 1;
    const newRow = {
      id: Date.now() + 1,
      semana: `SEMANA ${nextNum}`,
      actos: 0,
      condiciones: 0,
      accidentes_incapacitantes: 0
    };
    const newRows = [...table2Rows, newRow];
    setTable2Rows(newRows);
    setSaveStatus('saving');
    persistLocally(table1Rows, newRows);
  };

  const handleDeleteRow2 = (index) => {
    if (table2Rows.length <= 1) {
      toast.error('Debe haber al menos una semana en la tabla');
      return;
    }
    const newRows = table2Rows.filter((_, i) => i !== index);
    setTable2Rows(newRows);
    setSaveStatus('saving');
    persistLocally(table1Rows, newRows);
  };

  const handleResetDefault2 = () => {
    if (!window.confirm('¿Deseas restablecer la tabla de incidencias a las 6 semanas iniciales?')) return;
    setTable2Rows(defaultRows);
    setSaveStatus('saving');
    persistLocally(table1Rows, defaultRows);
    saveToDatabase(table1Rows, defaultRows, true);
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
            {table1Rows.map((row, idx) => {
              const calc = calculateRowValues(row);
              return (
                <tr key={row.id || idx}>
                  <td className="cell-input">
                    <input
                      type="text"
                      value={row.semana !== undefined ? row.semana : `SEMANA ${idx + 1}`}
                      onChange={(e) => handleCellChange1(idx, 'semana', e.target.value)}
                      placeholder={`SEMANA ${idx + 1}`}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.actos !== undefined ? row.actos : 0}
                      onChange={(e) => handleCellChange1(idx, 'actos', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.condiciones !== undefined ? row.condiciones : 0}
                      onChange={(e) => handleCellChange1(idx, 'condiciones', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.ft !== undefined ? row.ft : 0}
                      onChange={(e) => handleCellChange1(idx, 'ft', e.target.value)}
                    />
                  </td>
                  <td className="cell-readonly">
                    {calc.total_hh}
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
                      value={row.meta !== undefined ? row.meta : 2.0}
                      onChange={(e) => handleCellChange1(idx, 'meta', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.bajo !== undefined ? row.bajo : 1.0}
                      onChange={(e) => handleCellChange1(idx, 'bajo', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.alto !== undefined ? row.alto : 3.5}
                      onChange={(e) => handleCellChange1(idx, 'alto', e.target.value)}
                    />
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn-delete-row"
                      onClick={() => handleDeleteRow1(idx)}
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

      <div className="table-footer-actions" style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '28px', backgroundColor: '#f8fafc' }}>
        <div className="footer-left">
          <button type="button" className="btn-add-row" onClick={handleAddRow1}>
            <FiPlus /> Añadir Semana (Rendimiento)
          </button>
          <button type="button" className="btn-reset-table" onClick={handleResetDefault1} title="Restablecer tabla por defecto">
            <FiRefreshCw />
          </button>
        </div>
      </div>

      <div className="table-header-banner" style={{ marginTop: '12px', backgroundColor: '#3b82f6' }}>
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
              <th className="col-acc-inc" style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>ACCIDENTES INCAPACITANTES</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {table2Rows.map((row, idx) => {
              const calc = calculateRowValues(row);
              return (
                <tr key={row.id ? `inc-${row.id}` : `inc-${idx}`}>
                  <td className="cell-input">
                    <input
                      type="text"
                      value={row.semana !== undefined ? row.semana : `SEMANA ${idx + 1}`}
                      onChange={(e) => handleCellChange2(idx, 'semana', e.target.value)}
                      placeholder={`SEMANA ${idx + 1}`}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.actos !== undefined ? row.actos : 0}
                      onChange={(e) => handleCellChange2(idx, 'actos', e.target.value)}
                    />
                  </td>
                  <td className="cell-input">
                    <input
                      type="number"
                      step="any"
                      value={row.condiciones !== undefined ? row.condiciones : 0}
                      onChange={(e) => handleCellChange2(idx, 'condiciones', e.target.value)}
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
                      onChange={(e) => handleCellChange2(idx, 'incidencias_campo', e.target.value)}
                    />
                  </td>
                  <td className="cell-readonly" style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309', fontWeight: 'bold' }}>
                    {calc.incidencias_total}
                  </td>
                  <td className="cell-input" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                    <input
                      type="number"
                      step="any"
                      value={row.accidentes_incapacitantes !== undefined && row.accidentes_incapacitantes !== '' ? row.accidentes_incapacitantes : 0}
                      onChange={(e) => handleCellChange2(idx, 'accidentes_incapacitantes', e.target.value)}
                      style={{ fontWeight: 'bold', color: '#dc2626' }}
                    />
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn-delete-row"
                      onClick={() => handleDeleteRow2(idx)}
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

      <div className="table-footer-actions">
        <div className="footer-left">
          <button type="button" className="btn-add-row" style={{ backgroundColor: '#ea580c' }} onClick={handleAddRow2}>
            <FiPlus /> Añadir Semana (Incidencias)
          </button>
          <button type="button" className="btn-reset-table" onClick={handleResetDefault2} title="Restablecer tabla por defecto">
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
            onClick={() => saveToDatabase(table1Rows, table2Rows, true)}
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
