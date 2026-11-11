import {
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_UPDATED,
  PRIVACY_CONTACT,
} from '../../constants/privacyNotice';

/** Texto del Aviso de Privacidad (se usa en el modal y en la página pública). */
const PrivacyNoticeContent = () => (
  <div className="privacy-notice-content">
    <p className="privacy-notice-meta">
      {PRIVACY_CONTACT.company} · Última actualización: {PRIVACY_NOTICE_UPDATED}
    </p>
    {PRIVACY_NOTICE_SECTIONS.map((section) => (
      <section key={section.title}>
        <h3>{section.title}</h3>
        {section.paragraphs?.map((text) => <p key={text.slice(0, 40)}>{text}</p>)}
        {section.items && (
          <ul>
            {section.items.map((item) => <li key={item.slice(0, 40)}>{item}</li>)}
          </ul>
        )}
        {section.after?.map((text) => <p key={text.slice(0, 40)}>{text}</p>)}
      </section>
    ))}
  </div>
);

export default PrivacyNoticeContent;
