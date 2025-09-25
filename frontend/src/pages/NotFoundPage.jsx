import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './NotFoundPage.scss';

const NotFoundPage = () => {
  return (
    <>
      <Helmet>
        <title>Página no Encontrada</title>
      </Helmet>
      <div className="not-found-page">
        <div className="not-found-content">
          <h1>404</h1>
          <h2>Página no Encontrada</h2>
          <p>Lo sentimos, la página que buscas no existe o ha sido movida.</p>
          <Link to="/" className="btn btn-primary">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    </>
  );
};

export default NotFoundPage;