// Reporte Ejecutivo de Analytics en PDF (A4 vertical).
//
// Reúne lo que se ve en la página de Reportes: indicadores del periodo,
// tareas cerradas por semana, ranking por empleado, carga operativa, CRI por
// obra completada, obras activas por semana y duración de proyectos. Usa los
// valores tal como están en pantalla (incluidos los ajustes manuales).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARGEN = 14;
const PIE = 12; // alto reservado para el pie de página
const PRIMARIO = [79, 70, 229];
const TINTA = [31, 41, 55];
const TINTA_SUAVE = [107, 114, 128];
const LINEA = [229, 231, 235];
const FONDO_SUAVE = [248, 250, 252];

const ESTADO_COLOR = {
  optimo: [16, 185, 129],
  aceptable: [217, 119, 6],
  riesgo: [220, 38, 38],
};

const hexARgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

// Carga el logo y lo convierte a PNG en base64 (lo que jsPDF necesita).
const cargarImagen = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({ data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    } catch {
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = src;
});

const fechaLarga = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const horaCorta = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

// "SEM 47 · 2026 (en curso)" -> "S47"
const semanaCorta = (label) => {
  const m = String(label).match(/(\d+)/);
  return m ? `S${m[1]}` : String(label);
};

export async function generarReporteEjecutivoPDF({
  estadisticas,
  usuario,
  periodo,
  proyecto,
  calificacionCRI = [],
  estadosCRI = [],
  estadoCRI,
  obrasSemana = [],
  anioObras,
  duracionesProyectos = [],
  logo,
}) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const ahora = new Date();
  let y = 0;

  const asegurarEspacio = (h) => {
    if (y + h > alto - MARGEN - PIE) {
      pdf.addPage();
      y = MARGEN + 4;
    }
  };

  // `siguiente`: alto mínimo de lo que va debajo, para no dejar el título solo al final de la página.
  const tituloSeccion = (texto, nota, siguiente = 24) => {
    asegurarEspacio((nota ? 22 : 18) + siguiente);
    y += 6;
    pdf.setFillColor(...PRIMARIO);
    pdf.rect(MARGEN, y - 4, 1.4, 6, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...TINTA);
    pdf.text(texto, MARGEN + 4, y);
    y += 2;
    if (nota) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...TINTA_SUAVE);
      const lineas = pdf.splitTextToSize(nota, util - 4);
      pdf.text(lineas, MARGEN + 4, y + 3.5);
      y += 3.5 * lineas.length + 1;
    }
    y += 3;
  };

  const tabla = (opciones) => {
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, bottom: MARGEN + PIE },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: TINTA, lineColor: LINEA, lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARIO, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: FONDO_SUAVE },
      ...opciones,
      didParseCell: (data) => {
        // Los encabezados de columnas numéricas se alinean igual que sus valores.
        if (data.section === 'head') {
          const halign = opciones.columnStyles?.[data.column.index]?.halign;
          if (halign) data.cell.styles.halign = halign;
        }
        opciones.didParseCell?.(data);
      },
    });
    y = pdf.lastAutoTable.finalY + 2;
  };

  const sinDatos = (texto) => {
    asegurarEspacio(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(...TINTA_SUAVE);
    pdf.text(texto, MARGEN + 4, y + 3);
    y += 8;
  };

  // Gráfica de barras sencilla: eje en cero, 3 líneas guía y valor sobre cada barra.
  const graficaBarras = ({ etiquetas, valores, color, alto: h = 52, cadaEtiqueta = 1, destacarUltima = false }) => {
    asegurarEspacio(h + 16);
    y += 4; // espacio para el valor de la barra más alta
    const x0 = MARGEN + 8;
    const w = util - 8;
    const base = y + h;
    const maximo = Math.max(1, ...valores);
    const paso = Math.ceil(maximo / 3);
    const tope = paso * 3;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    for (let i = 0; i <= 3; i += 1) {
      const gy = base - (h * (paso * i)) / tope;
      pdf.setDrawColor(...LINEA);
      pdf.setLineWidth(0.2);
      pdf.line(x0, gy, x0 + w, gy);
      pdf.setTextColor(...TINTA_SUAVE);
      pdf.text(String(paso * i), x0 - 2, gy + 1, { align: 'right' });
    }

    const n = valores.length || 1;
    const hueco = w / n;
    const barra = Math.min(16, Math.max(1, hueco * 0.62));
    valores.forEach((v, i) => {
      const bh = (h * v) / tope;
      const bx = x0 + hueco * i + (hueco - barra) / 2;
      const esUltima = destacarUltima && i === n - 1;
      pdf.setFillColor(...(esUltima ? [165, 180, 252] : color));
      if (bh > 0) pdf.rect(bx, base - bh, barra, bh, 'F');
      if (v > 0 && (n <= 26 || v === maximo)) {
        pdf.setFontSize(n > 26 ? 6 : 7);
        pdf.setTextColor(...TINTA);
        pdf.text(String(v), bx + barra / 2, base - bh - 1, { align: 'center' });
      }
      const esUltimaEtiqueta = i === n - 1;
      const chocaConUltima = cadaEtiqueta > 1 && !esUltimaEtiqueta && n - 1 - i < Math.max(2, cadaEtiqueta / 2);
      if ((i % cadaEtiqueta === 0 && !chocaConUltima) || esUltimaEtiqueta) {
        pdf.setFontSize(6.5);
        pdf.setTextColor(...TINTA_SUAVE);
        pdf.text(String(etiquetas[i]), bx + barra / 2, base + 4, { align: 'center' });
      }
    });
    y = base + 9;
  };

  // ---------------------------------------------------------------- Encabezado
  pdf.setFillColor(...PRIMARIO);
  pdf.rect(0, 0, ancho, 30, 'F');
  const imgLogo = await cargarImagen(logo);
  let xTitulo = MARGEN;
  if (imgLogo) {
    const lh = 18;
    const lw = (imgLogo.width / imgLogo.height) * lh;
    try {
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(MARGEN, 6, lw + 4, lh, 2, 2, 'F');
      pdf.addImage(imgLogo.data, 'PNG', MARGEN + 2, 6, lw, lh);
      xTitulo = MARGEN + lw + 9;
    } catch {
      // Sin logo si no se pudo dibujar; el reporte sigue.
    }
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('Reporte Ejecutivo de Analytics', xTitulo, 14);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text('MH Soluciones · Rendimiento operativo', xTitulo, 20.5);
  pdf.setFontSize(8.5);
  pdf.text(fechaLarga(ahora), ancho - MARGEN, 14, { align: 'right' });
  pdf.text(horaCorta(ahora), ancho - MARGEN, 20.5, { align: 'right' });

  // Datos del reporte
  y = 38;
  const datos = [
    ['Periodo', periodo],
    ['Proyecto', proyecto || 'Todos los proyectos'],
    ['Generado por', usuario || '—'],
  ];
  const colDato = util / datos.length;
  datos.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + colDato * i;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...TINTA_SUAVE);
    pdf.text(etiqueta.toUpperCase(), x, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...TINTA);
    pdf.text(pdf.splitTextToSize(String(valor), colDato - 4)[0], x, y + 5);
  });
  y += 10;

  // ------------------------------------------------------------- Indicadores
  const e = estadisticas || {};
  tituloSeccion('Indicadores del periodo',
    'Tareas con fecha límite dentro del periodo. Cerradas: cerradas por un administrador o revisor. '
    + 'Vencidas: sin cerrar, con la fecha límite pasada y sin ninguna entrega. En progreso: el resto.');
  const kpis = [
    { t: 'Total de tareas', v: e.tareasTotales ?? 0, c: [59, 130, 246] },
    { t: 'Cerradas', v: e.tareasCompletadas ?? 0, c: ESTADO_COLOR.optimo },
    { t: 'En progreso', v: e.tareasEnProgreso ?? 0, c: ESTADO_COLOR.aceptable },
    { t: 'Vencidas', v: e.tareasVencidas ?? 0, c: ESTADO_COLOR.riesgo },
    { t: 'Salud del periodo', v: `${e.porcentajeCompletado ?? 0}%`, c: PRIMARIO, s: 'cerradas / total' },
    { t: 'Proyectos en proceso', v: e.proyectosActivos ?? 0, c: [139, 92, 246] },
  ];
  const kCols = 3;
  const kGap = 4;
  const kW = (util - kGap * (kCols - 1)) / kCols;
  const kH = 19;
  asegurarEspacio(kH * 2 + kGap + 2);
  kpis.forEach((k, i) => {
    const x = MARGEN + (kW + kGap) * (i % kCols);
    const ky = y + (kH + kGap) * Math.floor(i / kCols);
    pdf.setFillColor(...FONDO_SUAVE);
    pdf.setDrawColor(...LINEA);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, ky, kW, kH, 2, 2, 'FD');
    pdf.setFillColor(...k.c);
    pdf.rect(x, ky + 2, 1.2, kH - 4, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...TINTA_SUAVE);
    pdf.text(k.t.toUpperCase(), x + 5, ky + 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(...TINTA);
    pdf.text(String(k.v), x + 5, ky + 15);
    if (k.s) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...TINTA_SUAVE);
      pdf.text(k.s, x + kW - 4, ky + 15, { align: 'right' });
    }
  });
  y += kH * 2 + kGap + 2;

  // ------------------------------------------------- Tareas cerradas por semana
  const etiquetasSemana = e.tendenciaSemanalEtiquetas || [];
  const valoresSemana = e.tendenciaSemanal || [];
  tituloSeccion('Tareas cerradas por semana',
    'Semanas ISO (lunes a domingo) según la fecha límite de la tarea. La barra clara es la semana en curso.', 66);
  if (valoresSemana.length > 1) {
    graficaBarras({
      etiquetas: etiquetasSemana.map(semanaCorta),
      valores: valoresSemana,
      color: PRIMARIO,
      cadaEtiqueta: valoresSemana.length > 26 ? 4 : 1,
      destacarUltima: etiquetasSemana.some((l) => String(l).includes('en curso')),
    });
  } else if (valoresSemana.length === 1) {
    tabla({
      head: [['Semana', 'Tareas cerradas']],
      body: [[etiquetasSemana[0], valoresSemana[0]]],
      columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    });
  } else {
    sinDatos('Sin datos en el periodo.');
  }

  // ------------------------------------------------------- Ranking por empleado
  const ranking = e.topPerformers || [];
  tituloSeccion('Ranking de tareas cerradas por empleado');
  if (ranking.length) {
    tabla({
      head: [['#', 'Empleado', 'Tareas cerradas']],
      body: ranking.map((r, i) => [i + 1, r.name, r.count]),
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 36 } },
    });
  } else {
    sinDatos('Ningún empleado cerró tareas en el periodo.');
  }

  // ---------------------------------------------------------- Carga operativa
  const carga = e.tareasPorProyecto || [];
  if (!proyecto) {
    tituloSeccion(`Carga operativa por proyecto en proceso (${carga.length})`,
      'Tareas de cada proyecto en proceso con fecha límite dentro del periodo.');
    if (carga.length) {
      tabla({
        head: [['#', 'Proyecto', 'Tareas']],
        body: carga.map((p, i) => [i + 1, p.project_name, p.task_count]),
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 24 } },
      });
    } else {
      sinDatos('Sin proyectos en proceso con tareas en el periodo.');
    }
  }

  // ---------------------------------------------------------- CRI por obra
  tituloSeccion('Calificación final del CRI por proyecto completado',
    'CRI = entregas terminadas / entregas asignadas. Óptimo: 90 % o más · Aceptable: 70 a 89 % · Riesgo: menos de 70 %.', 40);
  if (calificacionCRI.length) {
    // Resumen por estado
    const rGap = 4;
    const rW = (util - rGap * 2) / 3;
    const rH = 13;
    asegurarEspacio(rH + 4);
    estadosCRI.forEach((estado, i) => {
      const total = calificacionCRI.filter((row) => estadoCRI(Number(row.cri) || 0).key === estado.key).length;
      const x = MARGEN + (rW + rGap) * i;
      const c = ESTADO_COLOR[estado.key] || hexARgb(estado.color);
      pdf.setFillColor(...FONDO_SUAVE);
      pdf.setDrawColor(...LINEA);
      pdf.roundedRect(x, y, rW, rH, 2, 2, 'FD');
      pdf.setFillColor(...c);
      pdf.rect(x, y + 2, 1.2, rH - 4, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(...TINTA);
      pdf.text(String(total), x + 5, y + 9);
      pdf.setFontSize(8.5);
      pdf.text(estado.text, x + 16, y + 6.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TINTA_SUAVE);
      pdf.text(`${total === 1 ? 'obra' : 'obras'} · ${estado.rango}`, x + 16, y + 10.5);
    });
    y += rH + 4;

    const promedio = Math.round(
      calificacionCRI.reduce((s, r) => s + (Number(r.cri) || 0), 0) / calificacionCRI.length,
    );
    tabla({
      head: [['Proyecto', 'CRI de la obra', 'Asig.', 'Term.', 'Venc.', 'CRI', 'Estado']],
      body: calificacionCRI.map((r) => {
        const est = estadoCRI(Number(r.cri) || 0);
        return [
          r.name + (r.editado ? ' *' : ''),
          r.cris?.length ? r.cris.join(', ') : 'Sin asignar',
          r.asignadas, r.terminadas, r.vencidas, `${r.cri}%`, est.text,
        ];
      }),
      foot: [['Promedio', '', '', '', '', `${promedio}%`, estadoCRI(promedio).text]],
      footStyles: { fillColor: [238, 242, 255], textColor: TINTA, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 'auto', fontSize: 7.5 },
        2: { halign: 'right', cellWidth: 13 },
        3: { halign: 'right', cellWidth: 13 },
        4: { halign: 'right', cellWidth: 13 },
        5: { halign: 'right', cellWidth: 13, fontStyle: 'bold' },
        6: { cellWidth: 23, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if ((data.section === 'body' || data.section === 'foot') && data.column.index === 6) {
          const key = { ÓPTIMO: 'optimo', ACEPTABLE: 'aceptable', RIESGO: 'riesgo' }[data.cell.raw];
          if (key) data.cell.styles.textColor = ESTADO_COLOR[key];
        }
        if (data.section === 'foot' && data.column.index > 1) data.cell.styles.halign = data.column.index === 6 ? 'left' : 'right';
      },
    });
    if (calificacionCRI.some((r) => r.editado)) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TINTA_SUAVE);
      pdf.text('* Valores ajustados a mano.', MARGEN, y + 2.5);
      y += 5;
    }
  } else {
    sinDatos('No hay proyectos completados.');
  }

  // ------------------------------------------------- Obras activas por semana
  // Solo hasta la última semana con obras (las semanas futuras siempre son 0).
  const ultimaConObras = obrasSemana.reduce((u, s, j) => (Number(s.obras) > 0 ? j : u), -1);
  const semanasConDatos = obrasSemana.slice(0, ultimaConObras + 1);
  tituloSeccion(`Obras activas por semana (${anioObras ?? ahora.getFullYear()})`,
    'Obras en proceso en cada semana ISO, desde su inicio hasta su cierre.', 66);
  if (semanasConDatos.length) {
    graficaBarras({
      etiquetas: semanasConDatos.map((r) => semanaCorta(r.semana)),
      valores: semanasConDatos.map((r) => Number(r.obras) || 0),
      color: [37, 99, 235],
      cadaEtiqueta: semanasConDatos.length > 26 ? 4 : 1,
    });
  } else {
    sinDatos('Sin obras activas en el año.');
  }

  // ------------------------------------------------------ Duración de proyectos
  const duraciones = [...duracionesProyectos]
    .filter((d) => Number(d.duracion) > 0)
    .sort((a, b) => Number(b.duracion) - Number(a.duracion));
  tituloSeccion(`Duración de proyectos (${duraciones.length})`, 'Días entre la fecha de inicio y la de cierre.');
  if (duraciones.length) {
    const promedioDias = Math.round(duraciones.reduce((s, d) => s + Number(d.duracion), 0) / duraciones.length);
    tabla({
      head: [['#', 'Proyecto', 'Días']],
      body: duraciones.map((d, i) => [i + 1, d.name, d.duracion]),
      foot: [['', 'Promedio', promedioDias]],
      footStyles: { fillColor: [238, 242, 255], textColor: TINTA, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 24 } },
      didParseCell: (data) => {
        if (data.section === 'foot' && data.column.index === 2) data.cell.styles.halign = 'right';
      },
    });
  } else {
    sinDatos('Sin proyectos con fechas de inicio y cierre.');
  }

  // --------------------------------------------------------- Pie de página
  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    pdf.setPage(p);
    pdf.setDrawColor(...LINEA);
    pdf.setLineWidth(0.2);
    pdf.line(MARGEN, alto - MARGEN - 2, ancho - MARGEN, alto - MARGEN - 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...TINTA_SUAVE);
    pdf.text(`MH Soluciones · Reporte Ejecutivo de Analytics · ${periodo}`, MARGEN, alto - MARGEN + 2);
    pdf.text(`Página ${p} de ${paginas}`, ancho - MARGEN, alto - MARGEN + 2, { align: 'right' });
  }

  const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  pdf.save(`Reporte_Analytics_${fecha}.pdf`);
}
