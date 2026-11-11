/**
 * Aviso de Privacidad Integral.
 *
 * IMPORTANTE: al cambiar el texto, sube PRIVACY_NOTICE_VERSION aquí Y en
 * backend/config/settings/base.py (PRIVACY_NOTICE_VERSION). Con eso se
 * vuelve a pedir la aceptación a todos los usuarios.
 *
 * Completa los datos de PRIVACY_CONTACT antes de publicar. Este texto es una
 * base conforme a la Ley Federal de Protección de Datos Personales en
 * Posesión de los Particulares; debe revisarlo el área legal de la empresa.
 */
export const PRIVACY_NOTICE_VERSION = '2026-11-11';

export const PRIVACY_CONTACT = {
  company: 'MH Soluciones Empresariales',
  // TODO: domicilio completo del responsable (calle, número, colonia, C.P., ciudad, estado).
  address: '[DOMICILIO DE MH SOLUCIONES EMPRESARIALES]',
  // TODO: correo del área que atiende solicitudes de privacidad.
  email: '[CORREO DE PRIVACIDAD]',
};

const { company, address, email } = PRIVACY_CONTACT;

export const PRIVACY_NOTICE_UPDATED = '11 de noviembre de 2026';

export const PRIVACY_NOTICE_SECTIONS = [
  {
    title: '1. Responsable de sus datos personales',
    paragraphs: [
      `${company}, con domicilio en ${address}, es responsable del uso y protección de los datos personales que usted proporciona al utilizar esta plataforma (en adelante, "la Plataforma").`,
    ],
  },
  {
    title: '2. Datos personales que recabamos',
    paragraphs: ['Para las finalidades descritas en este aviso, podemos tratar las siguientes categorías de datos:'],
    items: [
      'Identificación y contacto: nombre, apellidos, nombre de usuario, correo electrónico y fotografía de perfil.',
      'Datos laborales o académicos: rol dentro de la organización, proyectos y equipos a los que pertenece, tareas asignadas, entregas, calificaciones, comentarios y evaluaciones de desempeño.',
      'Archivos y documentos que usted sube a la Plataforma, incluidos los que se almacenan en Google Drive o en nuestros servidores.',
      'Datos de uso y seguridad: dirección IP, tipo de navegador y dispositivo, fechas y horas de inicio de sesión, bitácora de actividad y configuración de verificación en dos pasos.',
      'En el caso del personal, la documentación laboral que el área de Recursos Humanos requiera conforme a la relación de trabajo.',
    ],
  },
  {
    title: '3. Datos personales sensibles',
    paragraphs: [
      'La Plataforma no tiene como finalidad recabar datos personales sensibles. Si por alguna obligación laboral o legal fuera necesario tratarlos (por ejemplo, información de salud en documentos de Recursos Humanos), se le solicitará su consentimiento expreso y por escrito y se tratarán con medidas de seguridad reforzadas.',
    ],
  },
  {
    title: '4. Finalidades del tratamiento',
    paragraphs: ['Finalidades primarias (necesarias para el servicio):'],
    items: [
      'Crear y administrar su cuenta, autenticar su identidad y controlar el acceso.',
      'Gestionar proyectos, equipos, tareas, entregas, revisiones, calificaciones y calendario de actividades.',
      'Almacenar y organizar los archivos y documentos relacionados con su trabajo.',
      'Enviarle notificaciones dentro de la Plataforma, por correo electrónico o mediante notificaciones push sobre tareas, eventos y cambios relevantes.',
      'Generar reportes de avance y desempeño para la supervisión de los proyectos.',
      'Proteger la seguridad de la Plataforma: detectar accesos indebidos, bloquear intentos fraudulentos y conservar bitácoras de actividad.',
      'Cumplir obligaciones legales y requerimientos de autoridades competentes.',
    ],
    after: [
      'Finalidades secundarias: elaborar estadísticas internas y mejorar la Plataforma. Si no desea que sus datos se usen para estas finalidades, puede indicarlo en cualquier momento al correo señalado en la sección 7; esto no afectará el uso de la Plataforma.',
    ],
  },
  {
    title: '5. Transferencias y encargados',
    paragraphs: [
      'Sus datos son tratados por proveedores que nos prestan servicios tecnológicos y que actúan como encargados, bajo instrucciones y medidas de confidencialidad, entre ellos: servicios de alojamiento y bases de datos en la nube, almacenamiento de archivos (Google Drive y almacenamiento compatible con Amazon S3), envío de correo electrónico y notificaciones push. Algunos de estos servidores pueden ubicarse fuera de México.',
      'No vendemos ni cedemos sus datos personales. Solo los transferiremos a terceros sin su consentimiento en los casos previstos por la ley, como requerimientos de autoridades competentes.',
    ],
  },
  {
    title: '6. Uso de cookies y tecnologías similares',
    paragraphs: [
      'La Plataforma utiliza cookies de sesión estrictamente necesarias para mantener su sesión iniciada de forma segura, así como el almacenamiento local de su navegador para recordar preferencias (por ejemplo, tema claro u oscuro, filtros y estado del menú). No utilizamos cookies de publicidad ni de rastreo de terceros. Si las deshabilita, la Plataforma no podrá funcionar correctamente.',
    ],
  },
  {
    title: '7. Derechos ARCO y revocación del consentimiento',
    paragraphs: [
      `Usted tiene derecho a conocer qué datos tenemos y para qué los usamos (Acceso), solicitar su corrección (Rectificación), pedir que los eliminemos cuando no sean necesarios (Cancelación) u oponerse a su uso para fines específicos (Oposición). También puede revocar su consentimiento o limitar el uso y divulgación de sus datos.`,
      `Para ejercer estos derechos envíe una solicitud a ${email} indicando: su nombre y medio para comunicarle la respuesta, documento que acredite su identidad (o la de su representante), la descripción clara de los datos y del derecho que desea ejercer, y cualquier documento que facilite la localización de sus datos. Le responderemos en un plazo máximo de 20 días hábiles y, de resultar procedente, se hará efectiva dentro de los 15 días hábiles siguientes.`,
      'Tenga en cuenta que algunos datos deben conservarse por obligaciones legales o por la relación laboral o académica vigente, por lo que no siempre será posible atender la cancelación o revocación de inmediato.',
    ],
  },
  {
    title: '8. Medidas de seguridad y conservación',
    paragraphs: [
      'Aplicamos medidas administrativas, técnicas y físicas para proteger sus datos, como cifrado de conexiones, contraseñas protegidas, verificación en dos pasos, control de accesos por rol y bitácoras de actividad. Conservaremos sus datos mientras exista la relación con la organización y durante los plazos que exijan las disposiciones aplicables; después serán bloqueados y suprimidos.',
    ],
  },
  {
    title: '9. Cambios al aviso de privacidad',
    paragraphs: [
      'Este aviso puede actualizarse por cambios legales, en nuestros servicios o en nuestras prácticas de privacidad. Cuando eso ocurra, la Plataforma le mostrará la nueva versión al iniciar sesión y le pedirá aceptarla nuevamente.',
    ],
  },
  {
    title: '10. Consentimiento',
    paragraphs: [
      'Al marcar la casilla y seleccionar "Aceptar y continuar", usted manifiesta que ha leído este aviso y otorga su consentimiento para el tratamiento de sus datos personales conforme a lo aquí descrito. Se guardará la fecha, hora, dirección IP y navegador de su aceptación como constancia.',
    ],
  },
];
