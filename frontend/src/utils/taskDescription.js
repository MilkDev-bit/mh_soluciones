/**
 * La actividad GRAFICAS guarda su tabla dentro de la descripción de la tarea
 * como un comentario HTML: `<!-- GRAFICAS_DATA:{...json...} -->`
 * (ver GraficasActivityTable). Ese bloque es dato interno: no debe verse en
 * las listas ni editarse a mano, y no cuenta para el límite de caracteres.
 */
const GRAFICAS_BLOCK_RE = /<!--\s*GRAFICAS_DATA:[\s\S]*?-->/g;

/** Descripción visible: sin bloques de datos internos. */
export const visibleDescription = (description) =>
  (description || '').replace(GRAFICAS_BLOCK_RE, '').trim();

/** Bloque(s) de datos internos tal cual, o '' si no hay. */
export const graficasDataBlock = (description) =>
  ((description || '').match(GRAFICAS_BLOCK_RE) || []).join('\n');

/** Vuelve a unir el texto editado con el bloque de datos original. */
export const withGraficasData = (text, block) => {
  const clean = (text || '').trim();
  if (!block) return clean;
  return clean ? `${clean}\n\n${block}` : block;
};
