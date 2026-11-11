import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiArrowLeft } from 'react-icons/fi';
import PrivacyNoticeContent from '../components/privacy/PrivacyNoticeContent';
import { useAuth } from '../contexts/AuthContext';
import '../components/privacy/PrivacyNotice.scss';

/** Aviso de Privacidad público (también accesible sin iniciar sesión). */
const PrivacyNoticePage = () => {
  const { user } = useAuth() || {};
  return (
    <div className="privacy-page">
      <Helmet>
        <title>Aviso de Privacidad | MH Soluciones</title>
      </Helmet>
      <div className="privacy-page-card">
        <Link className="privacy-page-back" to={user ? '/' : '/login'}>
          <FiArrowLeft /> {user ? 'Volver al inicio' : 'Volver a iniciar sesión'}
        </Link>
        <h1>Aviso de Privacidad</h1>
        <PrivacyNoticeContent />
      </div>
    </div>
  );
};

export default PrivacyNoticePage;
