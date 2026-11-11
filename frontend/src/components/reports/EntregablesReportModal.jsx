import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload } from 'react-icons/fi';
import Modal from '../common/Modal';
import { downloadEntregablesReport } from '../../services/reportService';
import { isoWeek, isoWeekRangeLabel, isoWeeksInYear } from '../../utils/isoWeek';
import './EntregablesReportModal.scss';

/**
 * Elegir la semana ISO y descargar el reporte de entregables en Excel
 * (mismo formato que "Entregables-Semana-02_al_08_de_Noviembre.xlsx").
 * Por defecto: la semana anterior, que es la última semana completa.
 */
const EntregablesReportModal = ({ onClose }) => {
  const actual = isoWeek(new Date());
  const anterior = isoWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [year, setYear] = useState(anterior.year);
  const [week, setWeek] = useState(anterior.week);
  const [descargando, setDescargando] = useState(false);

  const years = useMemo(() => {
    const list = [];
    for (let y = actual.year; y >= actual.year - 3; y -= 1) list.push(y);
    return list;
  }, [actual.year]);

  // Semanas del año elegido; del año en curso, solo hasta la semana actual.
  const weeks = useMemo(() => {
    const last = year === actual.year ? actual.week : isoWeeksInYear(year);
    return Array.from({ length: last }, (_, i) => last - i);
  }, [year, actual.year, actual.week]);

  const cambiarAnio = (value) => {
    const y = Number(value);
    setYear(y);
    const last = y === actual.year ? actual.week : isoWeeksInYear(y);
    if (week > last) setWeek(last);
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const { blob, filename } = await downloadEntregablesReport(year, week);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte de entregables descargado');
      onClose();
    } catch (error) {
      console.error('Error descargando el reporte de entregables:', error);
      toast.error('No se pudo generar el reporte de entregables');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Modal title="Reporte de entregables" onClose={onClose} size="small">
      <div className="entregables-modal">
        <p className="entregables-ayuda">
          Excel con el cumplimiento de las 7 tareas semanales de cada obra en proceso,
          el código de color y el gráfico de porcentajes.
        </p>

        <div className="entregables-campos">
          <label>
            <span>Año</span>
            <select value={year} onChange={(e) => cambiarAnio(e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            <span>Semana (ISO 8601)</span>
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {weeks.map((w) => (
                <option key={w} value={w}>
                  SEM {w} · {isoWeekRangeLabel(year, w)}
                  {year === actual.year && w === actual.week ? ' (en curso)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="entregables-acciones">
          <button type="button" className="btn-secundario" onClick={onClose} disabled={descargando}>
            Cancelar
          </button>
          <button type="button" className="btn-primario" onClick={descargar} disabled={descargando}>
            <FiDownload /> {descargando ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EntregablesReportModal;
