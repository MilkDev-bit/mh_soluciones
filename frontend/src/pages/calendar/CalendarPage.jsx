import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getProjects } from '../../services/projectService';
import { getEventsByProject, updateEvent, getAvailableColors } from '../../services/calendarService';
import Loading from '../../components/common/Loading';
import Skeleton, { SkeletonList } from '../../components/common/Skeleton';
import EventModal from '../../components/calendar/EventModal';
import CalendarFilters from '../../components/calendar/CalendarFilters';
import { FiPlus, FiChevronDown, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import es from "@fullcalendar/core/locales/es";

import './CalendarPage.scss';
import '../../assets/styles/_buttons.scss';

const CalendarPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    user: '',
    searchQuery: ''
  });
  const [projectUsers, setProjectUsers] = useState([]);
  const [availableColors, setAvailableColors] = useState([]);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const projectData = await getProjects();
      const projectList = projectData.results || projectData || [];
      setProjects(projectList);
      if (projectList.length > 0) {
        setSelectedProject(projectList[0].id);
      }
    } catch (error) {
      toast.error('No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!selectedProject) {
      setEvents([]);
      setProjectUsers([]);
      setAvailableColors([]);
      return;
    }
    try {
      setIsRefreshing(true);
      const [eventData, colorsData] = await Promise.all([
        getEventsByProject(selectedProject),
        getAvailableColors(selectedProject)
      ]);
      
      const eventList = eventData.results || eventData || [];
      
      const formattedEvents = eventList.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        color: event.color,
        extendedProps: { 
          description: event.description,
          color: event.color,
          created_by: event.created_by
        }
      }));
      setEvents(formattedEvents);
      
      // Extract unique users from events
      const uniqueUsers = eventList
        .filter(e => e.created_by)
        .reduce((acc, event) => {
          if (!acc.find(u => u.id === event.created_by.id)) {
            acc.push(event.created_by);
          }
          return acc;
        }, []);
      setProjectUsers(uniqueUsers);
      
      // Set available colors from backend
      const colors = colorsData.colors || [];
      setAvailableColors(colors);
    } catch (error) {
      toast.error('No se pudieron cargar los eventos del proyecto.');
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedProject) {
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const handleEventSaved = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  const handleEventClick = (clickInfo) => {
    const event = clickInfo.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      description: event.extendedProps.description,
      color: event.extendedProps.color,
    });
    setIsModalOpen(true);
  };

  const handleDateSelect = (selectInfo) => {
    setSelectedEvent({
      start: selectInfo.startStr,
      end: selectInfo.endStr,
    });
    setIsModalOpen(true);
  };

  // Handle drag and drop for event rescheduling
  const handleEventDrop = async (dropInfo) => {
    const { event } = dropInfo;
    
    try {
      const eventData = {
        project: selectedProject,
        title: event.title,
        description: event.extendedProps.description,
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        color: event.extendedProps.color
      };
      
      await updateEvent(event.id, eventData);
      toast.success('Evento actualizado correctamente');
    } catch (error) {
      toast.error('Error al mover el evento');
      dropInfo.revert(); // Revert the event to its original position
    }
  };

  // Handle event resize
  const handleEventResize = async (resizeInfo) => {
    const { event } = resizeInfo;
    
    try {
      const eventData = {
        project: selectedProject,
        title: event.title,
        description: event.extendedProps.description,
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        color: event.extendedProps.color
      };
      
      await updateEvent(event.id, eventData);
      toast.success('Duración del evento actualizada');
    } catch (error) {
      toast.error('Error al redimensionar el evento');
      resizeInfo.revert();
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      user: '',
      searchQuery: ''
    });
  };

  const handleRefresh = () => {
    fetchEvents();
  };

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    if (filters.category) {
      filtered = filtered.filter(event => event.color === filters.category);
    }

    if (filters.user) {
      filtered = filtered.filter(event => 
        event.extendedProps.created_by?.id?.toString() === filters.user
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        (event.extendedProps.description || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [events, filters]);

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Calendario | MH Soluciones</title>
        </Helmet>
        <div className="calendar-page">
          <header className="page-header">
            <h1>Calendario de Proyectos</h1>
          </header>
          <SkeletonList count={3} />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Calendario | MH Soluciones</title>
      </Helmet>
      <div className="calendar-page animate-fade-in">
        <header className="page-header">
          <div className="header-content">
            <div className="header-title">
              <FiCalendar className="header-icon" />
              <h1>Calendario de Proyectos</h1>
            </div>
            <div className="header-subtitle">
              Gestiona y visualiza todos los eventos de tus proyectos
            </div>
          </div>
          <div className="page-header-actions">
            <div className="custom-select-wrapper">
              <select 
                value={selectedProject} 
                onChange={(e) => setSelectedProject(e.target.value)}
                className="project-select"
                disabled={projects.length === 0}
              >
                {projects.length > 0 ? (
                  projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                ) : (
                  <option value="" disabled>No hay proyectos disponibles</option>
                )}
              </select>
              <FiChevronDown className="select-arrow" />
            </div>
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={handleRefresh}
              disabled={!selectedProject || isRefreshing}
              title="Actualizar eventos"
            >
              <FiRefreshCw className={isRefreshing ? 'spinning' : ''} />
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => { setSelectedEvent(null); setIsModalOpen(true); }} 
              disabled={!selectedProject}
            >
              <FiPlus /> Nuevo Evento
            </button>
          </div>
        </header>

        {selectedProject && (
          <CalendarFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            users={projectUsers}
            availableColors={availableColors}
          />
        )}

        {selectedProject ? (
          <div className="calendar-container glass-card">
            {isRefreshing && (
              <div className="calendar-loading-overlay">
                <Loading inline text="Actualizando eventos..." />
              </div>
            )}
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              initialView="dayGridMonth"
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              events={filteredEvents}
              locale={es}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height="auto"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día'
              }}
              allDayText="Todo el día"
              noEventsContent="No hay eventos para mostrar"
            />
          </div>
        ) : (
          <div className="empty-state glass-card">
            <FiCalendar className="empty-state-icon" />
            <h2>Selecciona un Proyecto</h2>
            <p>Elige un proyecto del menú superior para ver y gestionar sus eventos en el calendario.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedEvent(null); }}
          event={selectedEvent}
          projectId={selectedProject}
          onEventSaved={handleEventSaved}
        />
      )}
    </>
  );
};

export default CalendarPage;
