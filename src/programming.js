// Variables globales para la página de programación
let currentDate = new Date();
let selectedDate = null;
let zonesList = [];
let irrigationTimer = null;

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
        
        // Inicializar sistema de timers
        initializeTimerSystem();
        
        // Configurar event listeners
        setupEventListeners();
        
        console.log('Página de programación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la página:', error);
    }
}

// Inicializar sistema de timers
function initializeTimerSystem() {
    // Crear instancia del timer si no existe
    if (!window.irrigationTimer) {
        window.irrigationTimer = new IrrigationTimer();
    }
    
    // Asignar a variable local
    irrigationTimer = window.irrigationTimer;
    
    // Inicializar el timer
    irrigationTimer.initialize();
    
    // Crear contenedor de timers en la página de programación
    createTimersSection();
}

// Crear sección de timers activos en la página
function createTimersSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    // Verificar si ya existe
    if (document.getElementById('programming-timers-widget')) return;
    
    // Crear widget de timers
    const timersWidget = document.createElement('div');
    timersWidget.id = 'programming-timers-widget';
    timersWidget.className = 'widget active-timers-widget';
    timersWidget.innerHTML = `
        <div class="widget-header">
            <h3 class="widget-title">
                <i class="fas fa-stopwatch"></i>
                Riegos en Ejecución
            </h3>
            <div class="widget-actions">
                <button onclick="refreshActiveTimers()" title="Actualizar">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        </div>
        <div id="programming-timers-container" class="programming-timers-container">
            <div class="no-active-timers">
                <i class="fas fa-clock"></i>
                <p>No hay riegos activos en este momento</p>
            </div>
        </div>
    `;
    
    // Insertar después del resumen del mes
    const scheduleWidget = document.querySelector('.schedule-summary');
    if (scheduleWidget) {
        scheduleWidget.after(timersWidget);
    } else {
        mainContent.appendChild(timersWidget);
    }
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
        
        // Verificar si tiene programaciones
        const daySchedules = monthSchedules.filter(schedule => {
            const scheduleDate = new Date(schedule.scheduled_time);
            return scheduleDate.toDateString() === currentDay.toDateString();
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
        let statusText = 'Pendiente';
        let actionButton = '';
        
        if (schedule.completed) {
            statusClass = 'completed';
            statusText = 'Completado';
        } else if (schedule.executed && schedule.started_at) {
            statusClass = 'running';
            statusText = 'En ejecución';
            actionButton = `<button class="btn danger small" onclick="stopIrrigation(${schedule.id})">
                <i class="fas fa-stop"></i> Detener
            </button>`;
        } else if (scheduleTime.getTime() < Date.now()) {
            statusClass = 'missed';
            statusText = 'Perdido';
        } else {
            actionButton = `<button class="btn secondary small" onclick="executeNow(${schedule.id})">
                <i class="fas fa-play"></i> Ejecutar Ahora
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
                    <button class="btn danger small" onclick="deleteSchedule(${schedule.id})">
                        <i class="fas fa-trash"></i>
                    </button>
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
        
        // Crear fecha y hora combinada
        const scheduleDateTime = new Date(selectedDate);
        const [hours, minutes] = time.split(':');
        scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Verificar que no sea en el pasado
        if (scheduleDateTime.getTime() < Date.now()) {
            alert('No se puede programar en el pasado');
            return;
        }
        
        // Insertar en base de datos
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .insert([{
                zone_id: zoneId,
                scheduled_time: scheduleDateTime.toISOString(),
                duration: duration,
                executed: false,
                completed: false
            }]);
        
        if (error) throw error;
        
        // Cerrar modal y actualizar
        closeDayModal();
        await renderCalendar();
        await loadMonthSchedules();
        
        alert('Programación guardada correctamente');
        
    } catch (error) {
        console.error('Error al guardar programación:', error);
        alert('Error al guardar la programación');
    }
}

// Ejecutar riego ahora
async function executeNow(scheduleId) {
    try {
        if (!window.supabaseClient) return;
        
        // Obtener datos de la programación
        const { data: schedule, error } = await window.supabaseClient
            .from('programacion')
            .select('*')
            .eq('id', scheduleId)
            .single();
        
        if (error) throw error;
        
        // Iniciar el riego
        await startIrrigationWithTimer(schedule);
        
        // Actualizar vista
        await loadDaySchedules(selectedDate);
        refreshActiveTimers();
        
    } catch (error) {
        console.error('Error al ejecutar riego:', error);
        alert('Error al ejecutar el riego');
    }
}

// Iniciar riego con timer
async function startIrrigationWithTimer(schedule) {
    try {
        const startTime = new Date();
        
        // Activar zona(s)
        if (schedule.zone_id > 0) {
            // Activar zona específica
            const { error: zoneError } = await window.supabaseClient
                .from('zonas')
                .update({ active: true })
                .eq('id', schedule.zone_id);
            
            if (zoneError) throw zoneError;
        } else {
            // Activar todas las zonas
            const { error: zonesError } = await window.supabaseClient
                .from('zonas')
                .update({ active: true })
                .gt('id', 0);
            
            if (zonesError) throw zonesError;
        }
        
        // Actualizar control general
        const { error: controlError } = await window.supabaseClient
            .from('control')
            .update({ estado: true })
            .eq('id', 1);
        
        if (controlError) throw controlError;
        
        // Marcar como iniciado en la programación
        const { error: scheduleError } = await window.supabaseClient
            .from('programacion')
            .update({
                executed: true,
                started_at: startTime.toISOString()
            })
            .eq('id', schedule.id);
        
        if (scheduleError) throw scheduleError;
        
        // Iniciar timer
        if (irrigationTimer) {
            await irrigationTimer.startIrrigation(schedule.id, schedule.zone_id, schedule.duration);
        }
        
        console.log(`Riego iniciado: ${schedule.id}`);
        
    } catch (error) {
        console.error('Error al iniciar riego:', error);
        throw error;
    }
}

// Detener riego
async function stopIrrigation(scheduleId) {
    try {
        if (!confirm('¿Está seguro de que desea detener este riego?')) return;
        
        // Usar el timer para detener
        if (irrigationTimer) {
            await irrigationTimer.cancelTimer(`timer_${scheduleId}`);
        }
        
        // Actualizar vista
        await loadDaySchedules(selectedDate);
        refreshActiveTimers();
        
    } catch (error) {
        console.error('Error al detener riego:', error);
        alert('Error al detener el riego');
    }
}

// Eliminar programación
async function deleteSchedule(scheduleId) {
    try {
        if (!confirm('¿Está seguro de que desea eliminar esta programación?')) return;
        
        const { error } = await window.supabaseClient
            .from('programacion')
            .delete()
            .eq('id', scheduleId);
        
        if (error) throw error;
        
        // Actualizar vista
        await loadDaySchedules(selectedDate);
        await renderCalendar();
        await loadMonthSchedules();
        
    } catch (error) {
        console.error('Error al eliminar programación:', error);
        alert('Error al eliminar la programación');
    }
}

// Refrescar timers activos
function refreshActiveTimers() {
    if (irrigationTimer) {
        irrigationTimer.refreshTimers();
        updateTimersDisplay();
    }
}

// Actualizar visualización de timers en la página
function updateTimersDisplay() {
    const container = document.getElementById('programming-timers-container');
    if (!container || !irrigationTimer) return;
    
    // Obtener timers activos
    const activeTimers = irrigationTimer.activeTimers;
    
    if (activeTimers.size === 0) {
        container.innerHTML = `
            <div class="no-active-timers">
                <i class="fas fa-clock"></i>
                <p>No hay riegos activos en este momento</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    activeTimers.forEach((timerInfo, timerId) => {
        const progress = Math.min(100, ((timerInfo.duration * 60 * 1000 - timerInfo.remainingTime) / (timerInfo.duration * 60 * 1000)) * 100);
        
        html += `
            <div class="active-timer-item" id="prog-timer-${timerInfo.id}">
                <div class="timer-info">
                    <div class="timer-zone">
                        <i class="fas fa-tint"></i>
                        <span>${timerInfo.zoneName}</span>
                    </div>
                    <div class="timer-time">
                        <span class="timer-remaining">${formatTime(timerInfo.remainingTime)}</span>
                        <span class="timer-total">/ ${timerInfo.duration}min</span>
                    </div>
                </div>
                <div class="timer-progress">
                    <div class="timer-progress-bar">
                        <div class="timer-progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="timer-actions">
                    <button class="timer-cancel-btn" onclick="stopIrrigation(${timerInfo.id})" title="Detener riego">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Formatear tiempo
function formatTime(milliseconds) {
    if (milliseconds <= 0) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Cargar estadísticas del mes
async function loadMonthSchedules() {
    try {
        const schedules = await getMonthSchedules();
        
        const totalSchedules = schedules.length;
        const executedSchedules = schedules.filter(s => s.completed).length;
        const pendingSchedules = schedules.filter(s => !s.executed && !s.completed).length;
        
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
    // Implementar vista de próximos 7 días
    alert('Función en desarrollo');
}

function createQuickSchedule() {
    showDaySchedule(new Date());
}

// Actualizar timers cada segundo
setInterval(() => {
    if (irrigationTimer && irrigationTimer.activeTimers.size > 0) {
        updateTimersDisplay();
    }
}, 1000);