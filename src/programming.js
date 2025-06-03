// Variables globales
let currentDate = new Date();
let selectedDate = null;
let schedules = {};
let zones = [];

// Nombres de los meses en español
const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    // Esperar a que Supabase esté listo
    await waitForSupabase();
    
    initializeCalendar();
    loadZones();
    loadMonthSchedules();
    
    // Event listeners
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
        loadMonthSchedules();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
        loadMonthSchedules();
    });
    
    document.getElementById('scheduleForm').addEventListener('submit', handleScheduleSubmit);
});

// Inicializar el calendario
function initializeCalendar() {
    renderCalendar();
}

// Renderizar el calendario
function renderCalendar() {
    const calendarBody = document.getElementById('calendarBody');
    const currentMonthElement = document.getElementById('currentMonth');
    
    // Actualizar el título del mes
    currentMonthElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    // Limpiar el calendario
    calendarBody.innerHTML = '';
    
    // Obtener el primer día del mes y el último día
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Días del mes anterior para completar la primera semana
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generar 42 días (6 semanas)
    for (let i = 0; i < 42; i++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + i);
        
        const dayElement = createDayElement(currentDay);
        calendarBody.appendChild(dayElement);
    }
}

// Crear elemento de día
function createDayElement(date) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const isToday = isDateToday(date);
    const dateKey = formatDateKey(date);
    const daySchedules = schedules[dateKey] || [];
    
    // Aplicar clases CSS
    if (!isCurrentMonth) {
        dayElement.classList.add('other-month');
    }
    if (isToday) {
        dayElement.classList.add('today');
    }
    if (daySchedules.length > 0) {
        dayElement.classList.add('has-schedules');
    }
    
    // Contenido del día
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();
    dayElement.appendChild(dayNumber);
    
    // Indicadores de programaciones
    if (daySchedules.length > 0) {
        const indicators = document.createElement('div');
        indicators.className = 'schedule-indicators';
        
        if (daySchedules.length <= 3) {
            // Mostrar puntos individuales
            daySchedules.forEach(() => {
                const dot = document.createElement('div');
                dot.className = 'schedule-dot';
                indicators.appendChild(dot);
            });
        } else {
            // Mostrar contador
            const count = document.createElement('div');
            count.className = 'schedule-count';
            count.textContent = daySchedules.length;
            indicators.appendChild(count);
        }
        
        dayElement.appendChild(indicators);
    }
    
    // Event listener para click en el día
    dayElement.addEventListener('click', () => {
        if (isCurrentMonth) {
            selectedDate = new Date(date);
            showDayScheduleModal(date);
        }
    });
    
    return dayElement;
}

// Verificar si una fecha es hoy
function isDateToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Formatear fecha para usar como clave
function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

// Mostrar modal de programaciones del día
function showDayScheduleModal(date) {
    const modal = document.getElementById('dayScheduleModal');
    const modalTitle = document.getElementById('modalTitle');
    const dateKey = formatDateKey(date);
    
    // Actualizar título
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    modalTitle.textContent = `${dayName}, ${dateStr}`;
    
    // Cargar programaciones del día
    loadDaySchedules(dateKey);
    
    // Limpiar formulario
    document.getElementById('scheduleForm').reset();
    
    // Mostrar modal
    modal.style.display = 'flex';
}

// Cerrar modal del día
function closeDayModal() {
    document.getElementById('dayScheduleModal').style.display = 'none';
    selectedDate = null;
}

// Cargar programaciones del día
async function loadDaySchedules(dateKey) {
    const schedulesList = document.getElementById('schedulesList');
    schedulesList.innerHTML = '<div class="loading">Cargando programaciones...</div>';
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('programacion')
            .select(`
                id, 
                scheduled_time, 
                duration, 
                executed,
                zonas:zone_id (id, name)
            `)
            .gte('scheduled_time', `${dateKey}T00:00:00`)
            .lt('scheduled_time', `${dateKey}T23:59:59`)
            .order('scheduled_time', { ascending: true });
            
        if (error) throw error;
        
        if (data.length === 0) {
            schedulesList.innerHTML = `
                <div class="empty-schedules">
                    <i class="fas fa-calendar-times"></i>
                    <p>No hay riegos programados para este día</p>
                </div>
            `;
        } else {
            schedulesList.innerHTML = '';
            data.forEach(schedule => {
                const scheduleElement = createScheduleElement(schedule);
                schedulesList.appendChild(scheduleElement);
            });
        }
    } catch (error) {
        console.error('Error cargando programaciones:', error);
        schedulesList.innerHTML = `<div class="error-message">Error al cargar las programaciones: ${error.message}</div>`;
    }
}

// Crear elemento de programación
function createScheduleElement(schedule) {
    const scheduleElement = document.createElement('div');
    scheduleElement.className = `schedule-item ${schedule.executed ? 'schedule-executed' : ''}`;
    
    const time = new Date(schedule.scheduled_time).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    scheduleElement.innerHTML = `
        <div class="schedule-info">
            <div class="schedule-time">${time}</div>
            <div class="schedule-details">
                ${schedule.zonas?.name || 'Zona eliminada'} - ${schedule.duration} minutos
            </div>
        </div>
        <div class="schedule-actions">
            ${!schedule.executed ? `
                <button class="edit-btn" onclick="editSchedule(${schedule.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
            ` : ''}
            <button class="delete-btn" onclick="deleteSchedule(${schedule.id})" title="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return scheduleElement;
}

// Cargar zonas para el select
async function loadZones() {
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('zonas')
            .select('id, name')
            .order('name', { ascending: true });
            
        if (error) throw error;
        
        zones = data;
        const zoneSelect = document.getElementById('scheduleZone');
        zoneSelect.innerHTML = '<option value="">Seleccionar zona...</option>';
        
        data.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.id;
            option.textContent = zone.name;
            zoneSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando zonas:', error);
    }
}

// Cargar programaciones del mes
async function loadMonthSchedules() {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('programacion')
            .select('id, scheduled_time, executed')
            .gte('scheduled_time', startOfMonth.toISOString())
            .lte('scheduled_time', endOfMonth.toISOString());
            
        if (error) throw error;
        
        // Agrupar por fecha
        schedules = {};
        data.forEach(schedule => {
            const dateKey = schedule.scheduled_time.split('T')[0];
            if (!schedules[dateKey]) {
                schedules[dateKey] = [];
            }
            schedules[dateKey].push(schedule);
        });
        
        // Actualizar estadísticas
        updateScheduleStats(data);
        
        // Re-renderizar calendario con los nuevos datos
        renderCalendar();
    } catch (error) {
        console.error('Error cargando programaciones del mes:', error);
    }
}

// Actualizar estadísticas del mes
function updateScheduleStats(data) {
    const total = data.length;
    const executed = data.filter(s => s.executed).length;
    const pending = total - executed;
    
    document.getElementById('totalSchedules').textContent = total;
    document.getElementById('executedSchedules').textContent = executed;
    document.getElementById('pendingSchedules').textContent = pending;
}

// Manejar envío del formulario de programación
async function handleScheduleSubmit(event) {
    event.preventDefault();
    
    if (!selectedDate) return;
    
    const formData = new FormData(event.target);
    const time = document.getElementById('scheduleTime').value;
    const duration = parseInt(document.getElementById('scheduleDuration').value);
    const zoneId = parseInt(document.getElementById('scheduleZone').value);
    
    // Crear fecha y hora completa
    const scheduledDateTime = new Date(selectedDate);
    const [hours, minutes] = time.split(':');
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('programacion')
            .insert([
                {
                    zone_id: zoneId,
                    scheduled_time: scheduledDateTime.toISOString(),
                    duration: duration,
                    executed: false
                }
            ]);
            
        if (error) throw error;
        
        // Recargar programaciones del día
        const dateKey = formatDateKey(selectedDate);
        loadDaySchedules(dateKey);
        
        // Recargar programaciones del mes
        loadMonthSchedules();
        
        // Limpiar formulario
        event.target.reset();
        
        // Mostrar mensaje de éxito
        showNotification('Programación guardada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error guardando programación:', error);
        showNotification('Error al guardar la programación', 'error');
    }
}

// Eliminar programación
async function deleteSchedule(scheduleId) {
    if (!confirm('¿Está seguro de que desea eliminar esta programación?')) {
        return;
    }
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { error } = await supabase
            .from('programacion')
            .delete()
            .eq('id', scheduleId);
            
        if (error) throw error;
        
        // Recargar programaciones
        if (selectedDate) {
            const dateKey = formatDateKey(selectedDate);
            loadDaySchedules(dateKey);
        }
        loadMonthSchedules();
        
        showNotification('Programación eliminada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error eliminando programación:', error);
        showNotification('Error al eliminar la programación', 'error');
    }
}

// Editar programación (funcionalidad básica)
async function editSchedule(scheduleId) {
    // Por simplicidad, por ahora solo permite cambiar la duración
    const newDuration = prompt('Nueva duración en minutos:', '30');
    
    if (newDuration && !isNaN(newDuration) && parseInt(newDuration) > 0) {
        try {
            // Verificar que supabase esté disponible
            if (!supabase) {
                throw new Error('Cliente de Supabase no está inicializado');
            }
            
            const { error } = await supabase
                .from('programacion')
                .update({ duration: parseInt(newDuration) })
                .eq('id', scheduleId);
                
            if (error) throw error;
            
            // Recargar programaciones
            if (selectedDate) {
                const dateKey = formatDateKey(selectedDate);
                loadDaySchedules(dateKey);
            }
            
            showNotification('Programación actualizada exitosamente', 'success');
            
        } catch (error) {
            console.error('Error actualizando programación:', error);
            showNotification('Error al actualizar la programación', 'error');
        }
    }
}

// Mostrar programaciones de hoy
function showTodaySchedule() {
    const today = new Date();
    selectedDate = today;
    showDayScheduleModal(today);
}

// Mostrar próximos 7 días
function showUpcomingSchedules() {
    const modal = document.getElementById('quickActionModal');
    const title = document.getElementById('quickActionTitle');
    const content = document.getElementById('quickActionContent');
    
    title.textContent = 'Próximos 7 Días';
    content.innerHTML = '<div class="loading">Cargando programaciones...</div>';
    
    modal.style.display = 'flex';
    
    loadUpcomingSchedules();
}

// Cargar próximas programaciones
async function loadUpcomingSchedules() {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('programacion')
            .select(`
                id, 
                scheduled_time, 
                duration, 
                executed,
                zonas:zone_id (id, name)
            `)
            .gte('scheduled_time', today.toISOString())
            .lte('scheduled_time', nextWeek.toISOString())
            .eq('executed', false)
            .order('scheduled_time', { ascending: true });
            
        if (error) throw error;
        
        const content = document.getElementById('quickActionContent');
        
        if (data.length === 0) {
            content.innerHTML = `
                <div class="empty-schedules">
                    <i class="fas fa-calendar-check"></i>
                    <p>No hay riegos programados para los próximos 7 días</p>
                </div>
            `;
        } else {
            let html = '<div class="upcoming-schedules">';
            
            data.forEach(schedule => {
                const date = new Date(schedule.scheduled_time);
                const dateStr = date.toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                });
                const timeStr = date.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                html += `
                    <div class="schedule-item">
                        <div class="schedule-info">
                            <div class="schedule-time">${dateStr} - ${timeStr}</div>
                            <div class="schedule-details">
                                ${schedule.zonas?.name || 'Zona eliminada'} - ${schedule.duration} minutos
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            content.innerHTML = html;
        }
    } catch (error) {
        console.error('Error cargando próximas programaciones:', error);
        const content = document.getElementById('quickActionContent');
        content.innerHTML = '<div class="error-message">Error al cargar las programaciones</div>';
    }
}

// Crear riego rápido
function createQuickSchedule() {
    const modal = document.getElementById('quickActionModal');
    const title = document.getElementById('quickActionTitle');
    const content = document.getElementById('quickActionContent');
    
    title.textContent = 'Riego Rápido';
    
    content.innerHTML = `
        <form id="quickScheduleForm">
            <p>Programa un riego para que inicie en los próximos minutos:</p>
            
            <div class="form-group">
                <label for="quickZone">Zona de Riego:</label>
                <select id="quickZone" required>
                    <option value="">Seleccionar zona...</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="quickDelay">Iniciar en (minutos):</label>
                    <input type="number" id="quickDelay" min="1" max="60" value="5" required>
                </div>
                <div class="form-group">
                    <label for="quickDuration">Duración (minutos):</label>
                    <input type="number" id="quickDuration" min="5" max="120" value="15" required>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn secondary" onclick="closeQuickActionModal()">
                    Cancelar
                </button>
                <button type="submit" class="btn primary">
                    <i class="fas fa-play"></i> Programar Riego
                </button>
            </div>
        </form>
    `;
    
    // Llenar select de zonas
    const quickZoneSelect = content.querySelector('#quickZone');
    zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone.id;
        option.textContent = zone.name;
        quickZoneSelect.appendChild(option);
    });
    
    // Event listener para el formulario
    content.querySelector('#quickScheduleForm').addEventListener('submit', handleQuickSchedule);
    
    modal.style.display = 'flex';
}

// Manejar riego rápido
async function handleQuickSchedule(event) {
    event.preventDefault();
    
    const zoneId = parseInt(document.getElementById('quickZone').value);
    const delay = parseInt(document.getElementById('quickDelay').value);
    const duration = parseInt(document.getElementById('quickDuration').value);
    
    // Calcular fecha y hora de inicio
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + delay);
    
    try {
        // Verificar que supabase esté disponible
        if (!supabase) {
            throw new Error('Cliente de Supabase no está inicializado');
        }
        
        const { data, error } = await supabase
            .from('programacion')
            .insert([
                {
                    zone_id: zoneId,
                    scheduled_time: startTime.toISOString(),
                    duration: duration,
                    executed: false
                }
            ]);
            
        if (error) throw error;
        
        closeQuickActionModal();
        loadMonthSchedules();
        
        showNotification('Riego rápido programado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error programando riego rápido:', error);
        showNotification('Error al programar el riego rápido', 'error');
    }
}

// Cerrar modal de acciones rápidas
function closeQuickActionModal() {
    document.getElementById('quickActionModal').style.display = 'none';
}

// Mostrar notificación
function showNotification(message, type) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Estilos inline para la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        ${type === 'success' ? 'background-color: var(--medium-green);' : 'background-color: #d9534f;'}
    `;
    
    notification.querySelector('button').style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        margin-left: 15px;
        padding: 0;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}