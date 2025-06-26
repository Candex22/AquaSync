// Variables globales para la página de programación
let currentDate = new Date();
let selectedDate = null;
let zonesList = [];
let displayUpdateInterval = null;

// Inicializar la página de programación
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando página de programación...');
    
    // Inicializar Supabase
    if (typeof initSupabase === 'function') {
        initSupabase();
        
        // Esperar a que Supabase se inicialice
        setTimeout(() => {
            initializePage();
        }, 1000);
    }
});

// Inicializar todos los componentes de la página
async function initializePage() {
    try {
        // Inicializar calendario
        initializeCalendar();
        
        // Cargar zonas para el formulario
        await loadZonesForForm();
        
        // Cargar estadísticas del mes
        await loadMonthSchedules();
        
        // Crear sección de riegos activos
        createActiveIrrigationsSection();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar listeners para eventos del sistema de riego
        setupIrrigationEventListeners();
        
        // Iniciar actualización de pantalla
        startDisplayUpdates();
        
        console.log('Página de programación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la página:', error);
    }
}

// Configurar listeners para eventos del sistema de riego
function setupIrrigationEventListeners() {
    // Escuchar cuando se inicia un riego
    window.addEventListener('irrigationStarted', (event) => {
        console.log('Riego iniciado:', event.detail);
        updateActiveIrrigationsDisplay();
        updateUpcomingSchedulesDisplay();
        showNotification(`Riego iniciado en ${event.detail.zoneName}`, 'success');
    });

    // Escuchar cuando se detiene un riego
    window.addEventListener('irrigationStopped', (event) => {
        console.log('Riego detenido:', event.detail);
        updateActiveIrrigationsDisplay();
        updateUpcomingSchedulesDisplay();
        const reason = event.detail.manual ? 'detenido manualmente' : 'completado automáticamente';
        showNotification(`Riego en ${event.detail.zoneName} ${reason}`, 'info');
        
        // Actualizar calendario y estadísticas
        renderCalendar();
        loadMonthSchedules();
    });
}

// Crear sección de riegos activos
function createActiveIrrigationsSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    // Verificar si ya existe
    if (document.getElementById('active-irrigations-widget')) return;
    
    // Crear widget de riegos activos
    const activeIrrigationsWidget = document.createElement('div');
    activeIrrigationsWidget.id = 'active-irrigations-widget';
    activeIrrigationsWidget.className = 'widget active-irrigations-widget';
    activeIrrigationsWidget.innerHTML = `
        <div class="widget-header">
            <h3 class="widget-title">
                <i class="fas fa-play-circle"></i>
                Riegos Activos
            </h3>
            <div class="widget-actions">
                <button onclick="updateActiveIrrigationsDisplay()" title="Actualizar">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        </div>
        <div id="active-irrigations-container" class="active-irrigations-container">
            <div class="no-active-irrigations">
                <i class="fas fa-clock"></i>
                <p>No hay riegos activos en este momento</p>
            </div>
        </div>
    `;
    
    // Insertar después del resumen del mes
    const scheduleWidget = document.querySelector('.schedule-summary');
    if (scheduleWidget) {
        scheduleWidget.after(activeIrrigationsWidget);
    } else {
        mainContent.appendChild(activeIrrigationsWidget);
    }

    // Crear widget de próximas programaciones
    createUpcomingSchedulesSection();
}

// Crear sección de próximas programaciones
function createUpcomingSchedulesSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    const upcomingWidget = document.createElement('div');
    upcomingWidget.id = 'upcoming-schedules-widget';
    upcomingWidget.className = 'widget upcoming-schedules-widget';
    upcomingWidget.innerHTML = `
        <div class="widget-header">
            <h3 class="widget-title">
                <i class="fas fa-calendar-alt"></i>
                Próximos Riegos
            </h3>
            <div class="widget-actions">
                <button onclick="updateUpcomingSchedulesDisplay()" title="Actualizar">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        </div>
        <div id="upcoming-schedules-container" class="upcoming-schedules-container">
            <div class="no-upcoming-schedules">
                <i class="fas fa-calendar-check"></i>
                <p>No hay riegos programados próximamente</p>
            </div>
        </div>
    `;
    
    // Insertar después del widget de riegos activos
    const activeWidget = document.getElementById('active-irrigations-widget');
    if (activeWidget) {
        activeWidget.after(upcomingWidget);
    } else {
        mainContent.appendChild(upcomingWidget);
    }
}

// Actualizar visualización de riegos activos
function updateActiveIrrigationsDisplay() {
    const container = document.getElementById('active-irrigations-container');
    if (!container) return;
    
    // Obtener riegos activos del scheduler
    const activeIrrigations = window.getActiveIrrigations ? window.getActiveIrrigations() : [];
    
    if (activeIrrigations.length === 0) {
        container.innerHTML = `
            <div class="no-active-irrigations">
                <i class="fas fa-clock"></i>
                <p>No hay riegos activos en este momento</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    activeIrrigations.forEach(irrigation => {
        const progress = Math.round(irrigation.progress);
        const remainingMinutes = Math.ceil(irrigation.remainingTime / (1000 * 60));
        
        html += `
            <div class="active-irrigation-item">
                <div class="irrigation-info">
                    <div class="irrigation-zone">
                        <i class="fas fa-tint"></i>
                        <span class="zone-name">${irrigation.zoneName}</span>
                    </div>
                    <div class="irrigation-time">
                        <span class="time-remaining">${remainingMinutes}min restantes</span>
                        <span class="time-total">de ${irrigation.duration}min</span>
                    </div>
                </div>
                <div class="irrigation-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}%</span>
                </div>
                <div class="irrigation-actions">
                    <button class="btn danger small" onclick="stopActiveIrrigation(${irrigation.id})" title="Detener riego">
                        <i class="fas fa-stop"></i> Detener
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Actualizar visualización de próximos riegos
function updateUpcomingSchedulesDisplay() {
    const container = document.getElementById('upcoming-schedules-container');
    if (!container) return;
    
    // Obtener próximos riegos del scheduler
    const upcomingSchedules = window.getScheduledIrrigations ? window.getScheduledIrrigations() : [];
    
    // Mostrar solo los próximos 5 riegos
    const nextSchedules = upcomingSchedules.slice(0, 5);
    
    if (nextSchedules.length === 0) {
        container.innerHTML = `
            <div class="no-upcoming-schedules">
                <i class="fas fa-calendar-check"></i>
                <p>No hay riegos programados próximamente</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    nextSchedules.forEach(schedule => {
        const timeUntilStart = Math.ceil(schedule.timeUntilStart / (1000 * 60)); // minutos
        const scheduleDate = schedule.scheduledTime.toLocaleDateString('es-ES');
        const scheduleTime = schedule.scheduledTime.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let timeText = '';
        if (timeUntilStart < 60) {
            timeText = `En ${timeUntilStart} minutos`;
        } else if (timeUntilStart < 1440) {
            const hours = Math.floor(timeUntilStart / 60);
            timeText = `En ${hours} hora${hours > 1 ? 's' : ''}`;
        } else {
            const days = Math.floor(timeUntilStart / 1440);
            timeText = `En ${days} día${days > 1 ? 's' : ''}`;
        }
        
        html += `
            <div class="upcoming-schedule-item">
                <div class="schedule-info">
                    <div class="schedule-zone">
                        <i class="fas fa-seedling"></i>
                        <span class="zone-name">${schedule.zoneName}</span>
                    </div>
                    <div class="schedule-datetime">
                        <span class="schedule-date">${scheduleDate}</span>
                        <span class="schedule-time">${scheduleTime}</span>
                    </div>
                </div>
                <div class="schedule-details">
                    <div class="schedule-duration">
                        <i class="fas fa-clock"></i>
                        <span>${schedule.duration} min</span>
                    </div>
                    <div class="schedule-countdown">
                        <span class="countdown-text">${timeText}</span>
                    </div>
                </div>
                <div class="schedule-actions">
                    <button class="btn secondary small" onclick="cancelScheduledIrrigation(${schedule.id})" title="Cancelar programación">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Detener riego activo
async function stopActiveIrrigation(scheduleId) {
    try {
        if (!confirm('¿Está seguro de que desea detener este riego?')) return;
        
        const success = await window.stopIrrigationManually(scheduleId);
        
        if (success) {
            showNotification('Riego detenido exitosamente', 'success');
        } else {
            showNotification('Error al detener el riego', 'error');
        }
        
    } catch (error) {
        console.error('Error al detener riego:', error);
        showNotification('Error al detener el riego', 'error');
    }
}

// Cancelar programación
async function cancelScheduledIrrigation(scheduleId) {
    try {
        if (!confirm('¿Está seguro de que desea cancelar esta programación?')) return;
        
        // Eliminar de la base de datos
        const { error } = await window.supabaseClient
            .from('programacion')
            .delete()
            .eq('id', scheduleId);
        
        if (error) throw error;
        
        // Cancelar en el scheduler si existe
        if (window.irrigationScheduler) {
            window.irrigationScheduler.cancelSchedule(scheduleId);
        }
        
        // Actualizar visualización
        updateUpcomingSchedulesDisplay();
        renderCalendar();
        loadMonthSchedules();
        
        showNotification('Programación cancelada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al cancelar programación:', error);
        showNotification('Error al cancelar la programación', 'error');
    }
}

// Iniciar actualizaciones de pantalla
function startDisplayUpdates() {
    // Actualizar cada 10 segundos
    displayUpdateInterval = setInterval(() => {
        updateActiveIrrigationsDisplay();
        updateUpcomingSchedulesDisplay();
    }, 10000);
}

// Configurar event listeners
function setupEventListeners() {
    // Navegación del calendario
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) prevBtn.addEventListener('click', previousMonth);
    if (nextBtn) nextBtn.addEventListener('click', nextMonth);
    
    // Formulario de programación
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }
    
    // Cerrar modales
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
}

// Inicializar calendario
function initializeCalendar() {
    updateCalendarHeader();
    renderCalendar();
}

// Actualizar header del calendario
function updateCalendarHeader() {
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const currentMonthElement = document.getElementById('currentMonth');
    if (currentMonthElement) {
        currentMonthElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
}

// Renderizar calendario
async function renderCalendar() {
    const calendarBody = document.getElementById('calendarBody');
    if (!calendarBody) return;
    
    // Limpiar calendario
    calendarBody.innerHTML = '';
    
    // Obtener primer día del mes y días en el mes
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Obtener programaciones del mes
    const monthSchedules = await getMonthSchedules();
    
    // Crear días del calendario
    for (let i = 0; i < 42; i++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // Verificar si es del mes actual
        if (currentDay.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('other-month');
        }
        
        // Verificar si es hoy
        const today = new Date();
        if (currentDay.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // Verificar si tiene programaciones futuras
        const daySchedules = monthSchedules.filter(schedule => {
            const scheduleDate = new Date(schedule.scheduled_time);
            return scheduleDate.toDateString() === currentDay.toDateString() && 
                   !schedule.completed;
        });
        
        if (daySchedules.length > 0) {
            dayElement.classList.add('has-schedule');
        }
        
        dayElement.innerHTML = `
            <span class="day-number">${currentDay.getDate()}</span>
            ${daySchedules.length > 0 ? `<span class="schedule-indicator">${daySchedules.length}</span>` : ''}
        `;
        
        // Event listener para mostrar programaciones del día
        dayElement.addEventListener('click', () => showDaySchedule(currentDay));
        
        calendarBody.appendChild(dayElement);
    }
}

// Obtener programaciones del mes actual
async function getMonthSchedules() {
    try {
        if (!window.supabaseClient) return [];
        
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .select(`
                id,
                zone_id,
                scheduled_time,
                duration,
                executed,
                completed,
                zonas (
                    name
                )
            `)
            .gte('scheduled_time', startOfMonth.toISOString())
            .lte('scheduled_time', endOfMonth.toISOString())
            .order('scheduled_time', { ascending: true });
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error('Error al obtener programaciones del mes:', error);
        return [];
    }
}

// Mostrar programaciones del día
async function showDaySchedule(date) {
    selectedDate = date;
    
    const modal = document.getElementById('dayScheduleModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !modalTitle) return;
    
    // Actualizar título
    const dateStr = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    modalTitle.textContent = `Programaciones - ${dateStr}`;
    
    // Cargar programaciones del día
    await loadDaySchedules(date);
    
    // Mostrar modal
    modal.style.display = 'flex';
}

// Cargar programaciones del día específico
async function loadDaySchedules(date) {
    try {
        const schedulesList = document.getElementById('schedulesList');
        if (!schedulesList) return;
        
        schedulesList.innerHTML = '<div class="loading">Cargando programaciones...</div>';
        
        // Obtener programaciones del día
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .select(`
                id,
                zone_id,
                scheduled_time,
                duration,
                executed,
                completed,
                started_at,
                zonas (
                    name
                )
            `)
            .gte('scheduled_time', startOfDay.toISOString())
            .lte('scheduled_time', endOfDay.toISOString())
            .order('scheduled_time', { ascending: true });
        
        if (error) throw error;
        
        // Renderizar programaciones
        renderDaySchedules(data || []);
        
    } catch (error) {
        console.error('Error al cargar programaciones del día:', error);
        const schedulesList = document.getElementById('schedulesList');
        if (schedulesList) {
            schedulesList.innerHTML = '<div class="error">Error al cargar programaciones</div>';
        }
    }
}

// Renderizar programaciones del día
function renderDaySchedules(schedules) {
    const schedulesList = document.getElementById('schedulesList');
    if (!schedulesList) return;
    
    if (schedules.length === 0) {
        schedulesList.innerHTML = '<div class="empty-schedules">No hay programaciones para este día</div>';
        return;
    }
    
    let html = '';
    schedules.forEach(schedule => {
        const scheduleTime = new Date(schedule.scheduled_time);
        const timeStr = scheduleTime.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const zoneName = schedule.zone_id === 0 ? 'Todas las zonas' : 
                        (schedule.zonas ? schedule.zonas.name : `Zona ${schedule.zone_id}`);
        
        let statusClass = 'pending';
        let statusText = 'Programado';
        let actionButton = '';
        
        // Verificar si el riego está activo actualmente
        const activeIrrigations = window.getActiveIrrigations ? window.getActiveIrrigations() : [];
        const isActive = activeIrrigations.some(irrigation => irrigation.id === schedule.id);
        
        if (schedule.completed) {
            statusClass = 'completed';
            statusText = 'Completado';
        } else if (isActive) {
            statusClass = 'running';
            statusText = 'En ejecución';
            actionButton = `<button class="btn danger small" onclick="stopActiveIrrigation(${schedule.id})">
                <i class="fas fa-stop"></i> Detener
            </button>`;
        } else if (scheduleTime.getTime() > Date.now()) {
            // Solo mostrar opción de cancelar si es futuro
            actionButton = `<button class="btn secondary small" onclick="cancelScheduledIrrigation(${schedule.id})">
                <i class="fas fa-times"></i> Cancelar
            </button>`;
        }
        
        html += `
            <div class="schedule-item ${statusClass}">
                <div class="schedule-time">${timeStr}</div>
                <div class="schedule-zone">${zoneName}</div>
                <div class="schedule-duration">${schedule.duration} min</div>
                <div class="schedule-status">${statusText}</div>
                <div class="schedule-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    });
    
    schedulesList.innerHTML = html;
}

// Cargar zonas para el formulario
async function loadZonesForForm() {
    try {
        if (!window.supabaseClient) return;
        
        const { data, error } = await window.supabaseClient
            .from('zonas')
            .select('id, name')
            .order('id', { ascending: true });
        
        if (error) throw error;
        
        zonesList = data || [];
        
        // Actualizar select del formulario
        const zoneSelect = document.getElementById('scheduleZone');
        if (zoneSelect) {
            zoneSelect.innerHTML = '<option value="">Seleccionar zona...</option>';
            zonesList.forEach(zone => {
                zoneSelect.innerHTML += `<option value="${zone.id}">${zone.name}</option>`;
            });
            zoneSelect.innerHTML += '<option value="0">Todas las zonas</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar zonas:', error);
    }
}

// Manejar envío del formulario
async function handleScheduleSubmit(event) {
    event.preventDefault();
    
    if (!window.supabaseClient || !selectedDate) return;
    
    try {
        const time = document.getElementById('scheduleTime').value;
        const duration = parseInt(document.getElementById('scheduleDuration').value);
        const zoneId = parseInt(document.getElementById('scheduleZone').value) || 0;
        
        if (!time || !duration || duration <= 0) {
            showNotification('Por favor complete todos los campos correctamente', 'error');
            return;
        }
        
        // Crear fecha y hora combinada
        const scheduleDateTime = new Date(selectedDate);
        const [hours, minutes] = time.split(':');
        scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Verificar que no sea en el pasado
        if (scheduleDateTime.getTime() < Date.now()) {
            showNotification('No se puede programar en el pasado', 'error');
            return;
        }
        
        // Usar la función del scheduler para agregar la programación
        const newSchedule = await window.scheduleIrrigation(zoneId, scheduleDateTime.toISOString(), duration);
        
        if (newSchedule) {
            // Cerrar modal y actualizar
            closeDayModal();
            await renderCalendar();
            await loadMonthSchedules();
            updateUpcomingSchedulesDisplay();
            
            // Limpiar formulario
            document.getElementById('scheduleForm').reset();
            
            showNotification('Programación guardada correctamente', 'success');
        } else {
            showNotification('Error al guardar la programación', 'error');
        }
        
    } catch (error) {
        console.error('Error al guardar programación:', error);
        showNotification('Error al guardar la programación', 'error');
    }
}

// Cargar estadísticas del mes
async function loadMonthSchedules() {
    try {
        const schedules = await getMonthSchedules();
        
        const totalSchedules = schedules.length;
        const executedSchedules = schedules.filter(s => s.completed).length;
        const pendingSchedules = schedules.filter(s => !s.completed && new Date(s.scheduled_time) > new Date()).length;
        
        // Actualizar interfaz
        const totalElement = document.getElementById('totalSchedules');
        const executedElement = document.getElementById('executedSchedules');
        const pendingElement = document.getElementById('pendingSchedules');
        
        if (totalElement) totalElement.textContent = totalSchedules;
        if (executedElement) executedElement.textContent = executedSchedules;
        if (pendingElement) pendingElement.textContent = pendingSchedules;
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Navegación del calendario
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendarHeader();
    renderCalendar();
    loadMonthSchedules();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendarHeader();
    renderCalendar();
    loadMonthSchedules();
}

// Cerrar modales
function closeDayModal() {
    const modal = document.getElementById('dayScheduleModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeQuickActionModal() {
    const modal = document.getElementById('quickActionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeModals() {
    closeDayModal();
    closeQuickActionModal();
}

// Acciones rápidas
function showTodaySchedule() {
    showDaySchedule(new Date());
}

function showUpcomingSchedules() {
    // Mostrar el widget de próximos riegos
    const upcomingWidget = document.getElementById('upcoming-schedules-widget');
    if (upcomingWidget) {
        upcomingWidget.scrollIntoView({ behavior: 'smooth' });
        upcomingWidget.classList.add('highlight');
        setTimeout(() => {
            upcomingWidget.classList.remove('highlight');
        }, 2000);
    }
}

function createQuickSchedule() {
    showDaySchedule(new Date());
}

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="closeNotification(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Agregar al DOM
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    notificationContainer.appendChild(notification);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        closeNotification(notification.querySelector('.notification-close'));
    }, 5000);
}

// Cerrar notificación
function closeNotification(button) {
    const notification = button.closest('.notification');
    if (notification) {
        notification.remove();
    }
}

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
    if (displayUpdateInterval) {
        clearInterval(displayUpdateInterval);
    }
});