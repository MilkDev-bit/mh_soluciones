import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getProjects } from '../../services/projectService';
import { getEventsByProject } from '../../services/calendarService';
import Loading from '../../components/common/Loading';
import EventModal from '../../components/calendar/EventModal';
import { FiPlus, FiChevronDown } from 'react-icons/fi';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import './CalendarPage.scss';
import '../../assets/styles/_buttons.scss';

const CalendarPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

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
      return;
    }
    try {
      const eventData = await getEventsByProject(selectedProject);
      const eventList = eventData.results || eventData || [];
      
      const formattedEvents = eventList.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        color: event.color,
        extendedProps: { 
          description: event.description,
          color: event.color 
        }
      }));
      setEvents(formattedEvents);
    } catch (error) {
      toast.error('No se pudieron cargar los eventos del proyecto.');
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedProject) {
      fetchEvents();
    }
  }, [selectedProject, fetchEvents]);

  const handleEventSaved = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start: clickInfo.event.start,
      end: clickInfo.event.end,
      description: clickInfo.event.extendedProps.description,
      color: clickInfo.event.extendedProps.color,
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

  if (loading) {
    return <Loading fullscreen />;
  }

  return (
    <>
      <Helmet>
        <title>Calendario | MH Soluciones</title>
      </Helmet>
      <div className="calendar-page animate-fade-in">
        <header className="page-header">
          <h1>Calendario de Proyectos</h1>
          <div className="page-header-actions">
            <div className="custom-select-wrapper">
              <select 
                value={selectedProject} 
                onChange={(e) => setSelectedProject(e.target.value)}
                className="project-select"
              >
                {projects.length > 0 ? (
                  projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                ) : (
                  <option value="" disabled>No hay proyectos disponibles</option>
                )}
              </select>
              <FiChevronDown className="select-arrow" />
            </div>
            <button className="btn btn-primary" onClick={() => { setSelectedEvent(null); setIsModalOpen(true); }} disabled={!selectedProject}>
              <FiPlus /> Nuevo Evento
            </button>
          </div>
        </header>

        <div className="calendar-container glass-card">
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
            events={events}
            locale={esLocale}
            select={handleDateSelect}
            eventClick={handleEventClick}
          />
        </div>
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