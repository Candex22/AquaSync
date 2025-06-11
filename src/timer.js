class IrrigationTimer {
    constructor() {
        this.activeTimers = new Map(); // Map<timerId, timerInfo>
        this.timerInterval = null;
        this.initialized = false;
        
        // Bind methods
        this.updateTimerDisplay = this.updateTimerDisplay.bind(this);
        this.checkActiveIrrigations = this.checkActiveIrrigations.bind(this);
    }

    // Inicializar el sistema de timers
    async initialize() {
        if (this.initialized) return;
        
        console.log('Inicializando sistema de timers de riego...');
        
        // Verificar que Supabase esté disponible
        if (!window.supabaseClient) {
            console.error('Cliente de Supabase no disponible para timers');
            return;
        }

        // Cargar riegos activos desde la base de datos
        await this.loadActiveIrrigations();
        
        // Iniciar el intervalo de actualización (cada segundo)
        this.timerInterval = setInterval(this.updateTimerDisplay, 1000);
        
        // Verificar riegos activos cada 30 segundos
        setInterval(this.checkActiveIrrigations, 30000);
        
        this.initialized = true;
        console.log('Sistema de timers inicializado correctamente');
    }

    // Cargar riegos activos desde la base de datos
    async loadActiveIrrigations() {
        try {
            // Obtener riegos que están ejecutándose actualmente
            const { data: activeSchedules, error } = await window.supabaseClient
                .from('programacion')
                .select(`
                    id,
                    zone_id,
                    duration,
                    started_at,
                    zonas (
                        name,
                        active
                    )
                `)
                .eq('executed', true)
                .eq('completed', false)
                .not('started_at', 'is', null);

            if (error) throw error;

            // Procesar cada riego activo
            if (activeSchedules && activeSchedules.length > 0) {
                activeSchedules.forEach(schedule => {
                    this.addTimer(schedule);
                });
            }

            // Actualizar la visualización
            this.renderTimersDisplay();

        } catch (error) {
            console.error('Error al cargar riegos activos:', error);
        }
    }

    // Verificar riegos activos en la base de datos
    async checkActiveIrrigations() {
        try {
            // Obtener zonas activas
            const { data: activeZones, error } = await window.supabaseClient
                .from('zonas')
                .select('id, name, active')
                .eq('active', true);

            if (error) throw error;

            // Si hay zonas activas pero no hay timers, algo puede haber salido mal
            if (activeZones && activeZones.length > 0 && this.activeTimers.size === 0) {
                console.log('Detectadas zonas activas sin timers. Recargando...');
                await this.loadActiveIrrigations();
            }

        } catch (error) {
            console.error('Error al verificar riegos activos:', error);
        }
    }

    // Agregar un nuevo timer
    addTimer(scheduleData) {
        const timerId = `timer_${scheduleData.id}`;
        const startTime = new Date(scheduleData.started_at);
        const durationMs = scheduleData.duration * 60 * 1000; // Convertir minutos a ms
        const endTime = new Date(startTime.getTime() + durationMs);

        const timerInfo = {
            id: scheduleData.id,
            zoneId: scheduleData.zone_id,
            zoneName: scheduleData.zonas ? scheduleData.zonas.name : 'Todas las zonas',
            startTime: startTime,
            endTime: endTime,
            duration: scheduleData.duration,
            remainingTime: Math.max(0, endTime.getTime() - Date.now())
        };

        this.activeTimers.set(timerId, timerInfo);
        console.log(`Timer agregado: ${timerId}`, timerInfo);

        // Programar la finalización automática
        this.scheduleTimerCompletion(timerId, timerInfo);
    }

    // Programar la finalización de un timer
    scheduleTimerCompletion(timerId, timerInfo) {
        const remainingTime = timerInfo.remainingTime;
        
        if (remainingTime <= 0) {
            // El timer ya debería haber terminado
            this.completeTimer(timerId);
            return;
        }

        // Programar la finalización
        setTimeout(() => {
            this.completeTimer(timerId);
        }, remainingTime);
    }

    // Completar un timer (detener el riego)
    async completeTimer(timerId) {
        try {
            const timerInfo = this.activeTimers.get(timerId);
            if (!timerInfo) return;

            console.log(`Completando timer: ${timerId}`);

            // Desactivar la zona en la base de datos
            if (timerInfo.zoneId > 0) {
                // Desactivar zona específica
                const { error: zoneError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .eq('id', timerInfo.zoneId);

                if (zoneError) throw zoneError;
            } else {
                // Desactivar todas las zonas
                const { error: zonesError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .gt('id', 0);

                if (zonesError) throw zonesError;
            }

            // Marcar como completado en la programación
            const { error: scheduleError } = await window.supabaseClient
                .from('programacion')
                .update({ completed: true })
                .eq('id', timerInfo.id);

            if (scheduleError) throw scheduleError;

            // Verificar si quedan zonas activas
            const { data: remainingActive, error: checkError } = await window.supabaseClient
                .from('zonas')
                .select('id')
                .eq('active', true);

            if (checkError) throw checkError;

            // Si no quedan zonas activas, actualizar control general
            if (!remainingActive || remainingActive.length === 0) {
                const { error: controlError } = await window.supabaseClient
                    .from('control')
                    .update({ estado: false })
                    .eq('id', 1);

                if (controlError) throw controlError;
            }

            // Remover el timer
            this.activeTimers.delete(timerId);

            // Actualizar visualización
            this.renderTimersDisplay();

            // Actualizar la interfaz principal si existe
            if (typeof loadZonesFromDatabase === 'function') {
                loadZonesFromDatabase();
            }

            console.log(`Timer ${timerId} completado exitosamente`);

        } catch (error) {
            console.error(`Error al completar timer ${timerId}:`, error);
        }
    }

    // Cancelar un timer manualmente
    async cancelTimer(timerId) {
        try {
            const timerInfo = this.activeTimers.get(timerId);
            if (!timerInfo) return;

            console.log(`Cancelando timer: ${timerId}`);

            // Desactivar la zona
            if (timerInfo.zoneId > 0) {
                const { error: zoneError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .eq('id', timerInfo.zoneId);

                if (zoneError) throw zoneError;
            } else {
                const { error: zonesError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .gt('id', 0);

                if (zonesError) throw zonesError;
            }

            // Marcar como completado (cancelado)
            const { error: scheduleError } = await window.supabaseClient
                .from('programacion')
                .update({ 
                    completed: true,
                    cancelled: true 
                })
                .eq('id', timerInfo.id);

            if (scheduleError) throw scheduleError;

            // Remover el timer
            this.activeTimers.delete(timerId);

            // Actualizar visualización
            this.renderTimersDisplay();

            // Actualizar interfaz principal
            if (typeof loadZonesFromDatabase === 'function') {
                loadZonesFromDatabase();
            }

        } catch (error) {
            console.error(`Error al cancelar timer ${timerId}:`, error);
        }
    }

    // Actualizar la visualización de los timers
    updateTimerDisplay() {
        if (this.activeTimers.size === 0) return;

        let hasExpiredTimers = false;

        // Actualizar tiempo restante para cada timer
        this.activeTimers.forEach((timerInfo, timerId) => {
            const now = Date.now();
            const remainingTime = Math.max(0, timerInfo.endTime.getTime() - now);
            
            timerInfo.remainingTime = remainingTime;

            // Si el timer ha expirado
            if (remainingTime <= 0) {
                hasExpiredTimers = true;
            }

            // Actualizar el elemento visual si existe
            const timerElement = document.getElementById(`timer-${timerInfo.id}`);
            if (timerElement) {
                const timeDisplay = timerElement.querySelector('.timer-remaining');
                if (timeDisplay) {
                    timeDisplay.textContent = this.formatTime(remainingTime);
                }

                // Actualizar barra de progreso
                const progressBar = timerElement.querySelector('.timer-progress-fill');
                if (progressBar) {
                    const totalTime = timerInfo.duration * 60 * 1000;
                    const elapsed = totalTime - remainingTime;
                    const progress = Math.min(100, (elapsed / totalTime) * 100);
                    progressBar.style.width = `${progress}%`;
                }
            }
        });

        // Si hay timers expirados, procesarlos
        if (hasExpiredTimers) {
            this.processExpiredTimers();
        }
    }

    // Procesar timers que han expirado
    processExpiredTimers() {
        const expiredTimers = [];
        
        this.activeTimers.forEach((timerInfo, timerId) => {
            if (timerInfo.remainingTime <= 0) {
                expiredTimers.push(timerId);
            }
        });

        // Completar cada timer expirado
        expiredTimers.forEach(timerId => {
            this.completeTimer(timerId);
        });
    }

    // Formatear tiempo en MM:SS
    formatTime(milliseconds) {
        if (milliseconds <= 0) return '00:00';
        
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Renderizar la visualización de timers
    renderTimersDisplay() {
        const timersContainer = document.getElementById('active-timers-container');
        if (!timersContainer) {
            this.createTimersContainer();
            return;
        }

        // Limpiar contenedor
        timersContainer.innerHTML = '';

        if (this.activeTimers.size === 0) {
            timersContainer.innerHTML = `
                <div class="no-active-timers">
                    <i class="fas fa-clock"></i>
                    <p>No hay riegos activos en este momento</p>
                </div>
            `;
            return;
        }

        // Crear elementos para cada timer
        this.activeTimers.forEach((timerInfo, timerId) => {
            const timerElement = this.createTimerElement(timerInfo);
            timersContainer.appendChild(timerElement);
        });
    }

    // Crear contenedor de timers si no existe
    createTimersContainer() {
        // Buscar el lugar apropiado para insertar el contenedor
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        // Crear el widget de timers activos
        const timersWidget = document.createElement('div');
        timersWidget.className = 'widget active-timers-widget';
        timersWidget.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">
                    <i class="fas fa-stopwatch"></i>
                    Riegos Activos
                </h3>
                <div class="widget-actions">
                    <button onclick="irrigationTimer.refreshTimers()" title="Actualizar">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>
            <div id="active-timers-container" class="active-timers-container">
                <!-- Los timers se insertan aquí -->
            </div>
        `;

        // Insertar después del calendario
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.after(timersWidget);
        } else {
            mainContent.appendChild(timersWidget);
        }

        // Llamar recursivamente para renderizar
        this.renderTimersDisplay();
    }

    // Crear elemento visual para un timer
    createTimerElement(timerInfo) {
        const timerDiv = document.createElement('div');
        timerDiv.className = 'active-timer-item';
        timerDiv.id = `timer-${timerInfo.id}`;

        const progress = Math.min(100, ((timerInfo.duration * 60 * 1000 - timerInfo.remainingTime) / (timerInfo.duration * 60 * 1000)) * 100);

        timerDiv.innerHTML = `
            <div class="timer-info">
                <div class="timer-zone">
                    <i class="fas fa-tint"></i>
                    <span>${timerInfo.zoneName}</span>
                </div>
                <div class="timer-time">
                    <span class="timer-remaining">${this.formatTime(timerInfo.remainingTime)}</span>
                    <span class="timer-total">/ ${timerInfo.duration}min</span>
                </div>
            </div>
            <div class="timer-progress">
                <div class="timer-progress-bar">
                    <div class="timer-progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            <div class="timer-actions">
                <button class="timer-cancel-btn" onclick="irrigationTimer.cancelTimer('timer_${timerInfo.id}')" title="Detener riego">
                    <i class="fas fa-stop"></i>
                </button>
            </div>
        `;

        return timerDiv;
    }

    // Refrescar timers (método público)
    async refreshTimers() {
        console.log('Refrescando timers...');
        await this.loadActiveIrrigations();
    }

    // Iniciar un nuevo riego y su timer
    async startIrrigation(scheduleId, zoneId, duration) {
        try {
            const startTime = new Date();

            // Actualizar la programación con el tiempo de inicio
            const { error: updateError } = await window.supabaseClient
                .from('programacion')
                .update({ 
                    started_at: startTime.toISOString(),
                    executed: true,
                    completed: false
                })
                .eq('id', scheduleId);

            if (updateError) throw updateError;

            // Crear datos del timer
            const scheduleData = {
                id: scheduleId,
                zone_id: zoneId,
                duration: duration,
                started_at: startTime.toISOString()
            };

            // Obtener información de la zona si es necesario
            if (zoneId > 0) {
                const { data: zoneData, error: zoneError } = await window.supabaseClient
                    .from('zonas')
                    .select('name')
                    .eq('id', zoneId)
                    .single();

                if (!zoneError && zoneData) {
                    scheduleData.zonas = zoneData;
                }
            }

            // Agregar el timer
            this.addTimer(scheduleData);

            // Actualizar visualización
            this.renderTimersDisplay();

            console.log(`Riego iniciado con timer: ${scheduleId}`);

        } catch (error) {
            console.error('Error al iniciar riego con timer:', error);
            throw error;
        }
    }

    // Limpiar todos los timers (para casos de error o reset)
    clearAllTimers() {
        this.activeTimers.clear();
        this.renderTimersDisplay();
        console.log('Todos los timers han sido limpiados');
    }

    // Destruir el sistema de timers
    destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        this.activeTimers.clear();
        this.initialized = false;
        console.log('Sistema de timers destruido');
    }
}

// Crear instancia global del sistema de timers
const irrigationTimer = new IrrigationTimer();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para asegurar que Supabase esté inicializado
    setTimeout(() => {
        irrigationTimer.initialize();
    }, 1500);
});

// Exportar para uso global
window.irrigationTimer = irrigationTimer;