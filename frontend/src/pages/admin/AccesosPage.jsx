import React from 'react';
import { Helmet } from 'react-helmet-async';
import LoginActivityPanel from '../../components/admin/LoginActivityPanel';

const AccesosPage = () => {
  return (
    <>
      <Helmet>
        <title>Historial de Accesos | MH Soluciones</title>
      </Helmet>
      <div className="page-container"> 
        <LoginActivityPanel />
      </div>
    </>
  );
};

export default AccesosPage;