import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { 
  getEmployeeDocuments, 
  getPerformanceReviews, 
  createEmployeeDocument,
  getEmployees,
  getEmployeeDocumentsByUser,
  downloadDocument,
  deleteEmployeeDocument,
  createPerformanceReview // Asegúrate de importar esta función
} from '../../services/hrService';
import Loading from '../../components/common/Loading';
import { 
  FiFileText, 
  FiAward, 
  FiPlus, 
  FiDownload,
  FiEye,
  FiX,
  FiUpload,
  FiUser,
  FiTrash2,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
  FiFile
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import './HRPage.scss';

const HRPage = () => {
  const [documents, setDocuments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docsData, reviewsData, employeesData] = await Promise.all([
        getEmployeeDocuments(),
        getPerformanceReviews(),
        getEmployees()
      ]);
      setDocuments(docsData.results || docsData || []);
      setReviews(reviewsData.results || reviewsData || []);
      setEmployees(employeesData.results || employeesData || []);
    } catch (error) {
      toast.error('No se pudieron cargar los datos de RRHH.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReview = async (reviewData) => {
    try {
      setReviewLoading(true);
      await createPerformanceReview(reviewData);
      toast.success('Evaluación creada exitosamente');
      setShowReviewModal(false);
      fetchData();
    } catch (error) {
      toast.error('Error al crear la evaluación');
      throw error;
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDocumentUpload = async (formData) => {
    try {
      setUploading(true);
      await createEmployeeDocument(formData);
      toast.success('Documento cargado exitosamente');
      setShowDocumentModal(false);
      fetchData();
    } catch (error) {
      toast.error('Error al cargar el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocuments = async (employee) => {
    try {
      setSelectedEmployee(employee);
      const docsData = await getEmployeeDocumentsByUser(employee.id);
      setEmployeeDocuments(docsData.results || docsData || []);
      setShowDocumentsModal(true);
    } catch (error) {
      toast.error('Error al cargar los documentos del empleado');
    }
  };

  const handleDownloadDocument = async (document) => {
  try {
    console.log('Iniciando descarga para documento:', document.id);
    const downloadUrl = `http://localhost:8000/api/v1/hr/employee-documents/${document.id}/download/`;
    const token = localStorage.getItem('access_token');
    
    const headers = new Headers();
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
  
    const blobUrl = window.URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;

    let fileName = 'documento_descargado';
    const contentDisposition = response.headers.get('content-disposition');
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        fileName = filenameMatch[1];
      }
    } else if (document.title) {
      fileName = document.title;
    }
    
    if (!fileName.includes('.')) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('pdf')) {
        fileName += '.pdf';
      } else if (contentType?.includes('word')) {
        fileName += '.docx';
      } else {
        fileName += '.bin';
      }
    }
    
    downloadLink.download = fileName;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    console.log('Descarga exitosa');
    
  } catch (error) {
    console.error('Error en descarga:', error);
    
    try {
      const token = localStorage.getItem('access_token');
      const url = `http://localhost:8000/api/v1/hr/employee-documents/${document.id}/download/`;
      
      if (token) {
        window.open(`${url}?token=${token}`, '_blank');
      } else {
        window.open(url, '_blank');
      }
      
      console.log('Documento abierto en nueva pestaña');
      
    } catch (fallbackError) {
      console.error('Error en fallback:', fallbackError);
      alert('No se pudo descargar el documento. Contacte al administrador.');
    }
  }
};

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      return;
    }
    
    try {
      await deleteEmployeeDocument(documentId);
      toast.success('Documento eliminado exitosamente');
      setEmployeeDocuments(prev => prev.filter(doc => doc.id !== documentId));
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar el documento');
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    
    if (aValue < bValue) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });

  const filteredEmployees = sortedEmployees.filter(employee =>
    employee.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <Loading fullscreen />;
  }

  return (
    <>
      <Helmet>
        <title>Recursos Humanos | MH Soluciones</title>
      </Helmet>
      
      <div className="hr-page animate-slide-up">
        <div className="page-header">
          <h1>Portal de Recursos Humanos</h1>
          <p>Gestión de empleados, expedientes y evaluaciones de desempeño</p>
        </div>

        <div className="hr-layout-grid">
          {/* Tarjeta de Empleados */}
          <div className="glass-card employees-section">
            <div className="section-header">
              <h2><FiUser /> Empleados</h2>
              <div className="search-box">
                <FiSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar empleados..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            
            <div className="card-content">
              <div className="table-container">
                <table className="employees-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('first_name')}>
                        <div className="table-header">
                          Nombre
                          {sortConfig.key === 'first_name' && (
                            sortConfig.direction === 'ascending' ? <FiChevronUp /> : <FiChevronDown />
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('email')}>
                        <div className="table-header">
                          Email
                          {sortConfig.key === 'email' && (
                            sortConfig.direction === 'ascending' ? <FiChevronUp /> : <FiChevronDown />
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('role')}>
                        <div className="table-header">
                          Rol
                          {sortConfig.key === 'role' && (
                            sortConfig.direction === 'ascending' ? <FiChevronUp /> : <FiChevronDown />
                          )}
                        </div>
                      </th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(employee => (
                      <tr key={employee.id} className="employee-row">
                        <td>
                          <div className="employee-info">
                            <img
                              src={employee.profile_picture || `https://ui-avatars.com/api/?name=${employee.first_name}+${employee.last_name}&background=ff7c15&color=fff`}
                              alt={employee.first_name}
                              className="employee-avatar"
                            />
                            <div>
                              <div className="employee-name">
                                {employee.first_name} {employee.last_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{employee.email}</td>
                        <td>
                          <span className="role-badge">{employee.role}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleViewDocuments(employee)}
                            >
                              <FiEye /> Documentos
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowDocumentModal(true);
                              }}
                            >
                              <FiPlus /> Agregar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredEmployees.length === 0 && (
                  <div className="empty-state">
                    <FiUser size={48} />
                    <p>No se encontraron empleados</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card">
            <div className="section-header">
              <h2><FiAward /> Evaluaciones de Desempeño</h2>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReviewModal(true)}
              >
                <FiPlus /> Nueva Evaluación
              </button>
            </div>
            
            <div className="card-content">
              <ul className="hr-list">
                {reviews.length > 0 ? reviews.map(review => (
                  <li key={review.id} className="hr-list-item">
                    <div className="item-info">
                      <span className="item-title">Evaluación de {review.employee?.first_name}</span>
                      <span className="item-subtitle">
                        <FiUser size={12} /> 
                        Evaluador: {review.reviewer?.first_name || 'N/A'}
                      </span>
                      <div className="rating">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className={`star ${i < review.overall_rating ? 'filled' : ''}`}
                          >
                            ⭐
                          </span>
                        ))}
                        <span className="rating-text">{review.overall_rating}/5</span>
                      </div>
                    </div>
                    <span className="item-date">
                      {format(parseISO(review.review_date), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </li>
                )) : (
                  <div className="empty-state">
                    <FiAward size={48} />
                    <p>No hay evaluaciones registradas</p>
                  </div>
                )}
              </ul>
            </div>
          </div>
        </div>

        {showDocumentModal && (
          <DocumentModal
            onClose={() => setShowDocumentModal(false)}
            onSubmit={handleDocumentUpload}
            loading={uploading}
            employee={selectedEmployee}
          />
        )}

        {showDocumentsModal && (
          <EmployeeDocumentsModal
            onClose={() => setShowDocumentsModal(false)}
            employee={selectedEmployee}
            documents={employeeDocuments}
            onDownload={handleDownloadDocument}
            onDelete={handleDeleteDocument}
            onUpload={() => {
              setShowDocumentsModal(false);
              setShowDocumentModal(true);
            }}
          />
        )}

        {showReviewModal && (
          <ReviewModal
            onClose={() => setShowReviewModal(false)}
            onSubmit={handleCreateReview}
            loading={reviewLoading}
            employees={employees}
          />
        )}
      </div>
    </>
  );
};

const DocumentModal = ({ onClose, onSubmit, loading, employee }) => {
  const [formData, setFormData] = useState({
    title: '',
    document_type: 'OTHER',
    employee_id: employee?.id || '',
    file: null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = new FormData();
    submitData.append('title', formData.title);
    submitData.append('document_type', formData.document_type);
    submitData.append('employee_id', formData.employee_id);
    if (formData.file) {
      submitData.append('file', formData.file);
    }
    onSubmit(submitData);
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, file: e.target.files[0] }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{employee ? `Cargar documento para ${employee.first_name}` : 'Cargar Documento'}</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {!employee && (
            <div className="form-group">
              <label>ID del Empleado *</label>
              <input
                type="number"
                required
                value={formData.employee_id}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                placeholder="ID numérico del empleado"
              />
            </div>
          )}

          <div className="form-group">
            <label>Título del Documento *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Contrato de trabajo"
            />
          </div>

          <div className="form-group">
            <label>Tipo de Documento *</label>
            <select
              value={formData.document_type}
              onChange={(e) => setFormData(prev => ({ ...prev, document_type: e.target.value }))}
            >
              <option value="CV">Currículum Vitae</option>
              <option value="ID">Identificación Oficial</option>
              <option value="CONTRACT">Contrato</option>
              <option value="CERTIFICATION">Certificación</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          <div className="form-group">
            <label>Archivo *</label>
            <div className="file-upload">
              <label className="file-input-label">
                <FiUpload />
                {formData.file ? formData.file.name : 'Seleccionar archivo'}
                <input
                  type="file"
                  required
                  onChange={handleFileChange}
                  className="file-input"
                />
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Cargando...' : 'Subir Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EmployeeDocumentsModal = ({ onClose, employee, documents, onDownload, onDelete, onUpload }) => {
  const getDocumentTypeText = (type) => {
    const types = {
      'CV': 'Currículum Vitae',
      'ID': 'Identificación Oficial',
      'CONTRACT': 'Contrato',
      'CERTIFICATION': 'Certificación',
      'OTHER': 'Otro'
    };
    return types[type] || type;
  };

  const getDocumentIcon = (type) => {
    const icons = {
      'CV': '📄',
      'ID': '🆔',
      'CONTRACT': '📝',
      'CERTIFICATION': '🏆',
      'OTHER': '📂'
    };
    return icons[type] || '📄';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content documents-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="employee-header">
            <img
              src={employee?.profile_picture || `https://ui-avatars.com/api/?name=${employee?.first_name}+${employee?.last_name}&background=ff7c15&color=fff`}
              alt={employee?.first_name}
              className="employee-modal-avatar"
            />
            <div className="employee-info">
              <h3>{employee?.first_name} {employee?.last_name}</h3>
              <span className="employee-role">{employee?.role}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <div className="documents-header">
            <div className="documents-count">
              <FiFileText size={18} />
              <span>{documents.length} documento(s)</span>
            </div>
            <button className="btn btn-primary" onClick={onUpload}>
              <FiPlus /> Agregar Documento
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="documents-grid">
              {documents.map(document => (
                <div key={document.id} className="document-card">
                  <div className="document-header">
                    <div className="document-icon">
                      {getDocumentIcon(document.document_type)}
                    </div>
                    <div className="document-actions">
                      <button
                        className="btn-icon"
                        onClick={() => onDownload(document)}
                        title="Descargar documento"
                      >
                        <FiDownload />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => onDelete(document.id)}
                        title="Eliminar documento"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  
                  <div className="document-content">
                    <h4 className="document-title">{document.title}</h4>
                    <span className="document-type">{getDocumentTypeText(document.document_type)}</span>
                  </div>
                  
                  <div className="document-footer">
                    <span className="document-date">
                      {format(parseISO(document.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <FiFileText size={64} />
              </div>
              <h4>No hay documentos</h4>
              <p>Este empleado no tiene documentos en su expediente</p>
              <button className="btn btn-primary" onClick={onUpload}>
                <FiPlus /> Agregar primer documento
              </button>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewModal = ({ onClose, onSubmit, loading, employees }) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    review_date: new Date().toISOString().split('T')[0],
    overall_rating: 3,
    strengths: '',
    areas_for_improvement: '',
    comments: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
      toast.success('Evaluación creada exitosamente');
      onClose();
    } catch (error) {
      toast.error('Error al crear la evaluación');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nueva Evaluación de Desempeño</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Empleado *</label>
            <select
              required
              value={formData.employee_id}
              onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
            >
              <option value="">Seleccionar empleado</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha de Evaluación *</label>
            <input
              type="date"
              required
              value={formData.review_date}
              onChange={(e) => setFormData(prev => ({ ...prev, review_date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Calificación General (1-5) *</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map(rating => (
                <label key={rating} className="rating-option">
                  <input
                    type="radio"
                    name="rating"
                    value={rating}
                    checked={formData.overall_rating === rating}
                    onChange={(e) => setFormData(prev => ({ ...prev, overall_rating: parseInt(e.target.value) }))}
                  />
                  <span className={`star ${rating <= formData.overall_rating ? 'filled' : ''}`}>
                    ⭐
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Fortalezas *</label>
            <textarea
              required
              rows={3}
              value={formData.strengths}
              onChange={(e) => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
              placeholder="Lista las principales fortalezas del empleado..."
            />
          </div>

          <div className="form-group">
            <label>Áreas de Mejora *</label>
            <textarea
              required
              rows={3}
              value={formData.areas_for_improvement}
              onChange={(e) => setFormData(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
              placeholder="Identifica áreas que necesitan desarrollo..."
            />
          </div>

          <div className="form-group">
            <label>Comentarios Adicionales</label>
            <textarea
              rows={2}
              value={formData.comments}
              onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
              placeholder="Comentarios adicionales o observaciones..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HRPage;