// Sistema Automático de Riego - scheduler.js
class IrrigationScheduler {
    constructor() {
        this.activeSchedules = new Map(); // Programaciones activas
        this.scheduledJobs = new Map(); // Trabajos programados
        this.runningIrrigations = new Map(); // Riegos en ejecución
        this.checkInterval = null;
        this.isInitialized = false;
    }

    // Inicializar el sistema de programación automática
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Inicializando sistema de programación automática...');
        
        // Cargar todas las programaciones pendientes
        await this.loadScheduledIrrigations();
        
        // Iniciar el verificador de programaciones cada minuto
        this.startScheduleChecker();
        
        this.isInitialized = true;
        console.log('Sistema de programación automática inicializado');
    }

    // Cargar todas las programaciones pendientes de la base de datos
    async loadScheduledIrrigations() {
        try {
            if (!window.supabaseClient) {
                console.error('Supabase no está disponible');
                return;
            }

            const now = new Date();
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            // Obtener todas las programaciones pendientes para hoy y los próximos días
            const { data: schedules, error } = await window.supabaseClient
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
                .eq('executed', false)
                .eq('completed', false)
                .gte('scheduled_time', now.toISOString())
                .order('scheduled_time', { ascending: true });

            if (error) {
                console.error('Error al cargar programaciones:', error);
                return;
            }

            // Programar cada riego
            schedules.forEach(schedule => {
                this.scheduleIrrigation(schedule);
            });

            console.log(`Cargadas ${schedules.length} programaciones pendientes`);

        } catch (error) {
            console.error('Error al cargar programaciones:', error);
        }
    }

    // Programar un riego específico
    scheduleIrrigation(schedule) {
        const scheduleTime = new Date(schedule.scheduled_time);
        const now = new Date();
        const timeUntilStart = scheduleTime.getTime() - now.getTime();

        // Solo programar si es en el futuro
        if (timeUntilStart > 0) {
            const timeoutId = setTimeout(() => {
                this.executeIrrigation(schedule);
            }, timeUntilStart);

            // Guardar referencia del timeout
            this.scheduledJobs.set(schedule.id, {
                timeoutId: timeoutId,
                schedule: schedule,
                scheduledTime: scheduleTime
            });

            console.log(`Riego programado para ${scheduleTime.toLocaleString()}: Zona ${schedule.zone_id}, Duración: ${schedule.duration}min`);
        }
    }

    // Ejecutar un riego automáticamente
    async executeIrrigation(schedule) {
        try {
            console.log(`Iniciando riego automático: ID ${schedule.id}`);
            
            // Remover de programaciones pendientes
            this.scheduledJobs.delete(schedule.id);
            
            // Marcar como ejecutado en la base de datos
            const startTime = new Date();
            const { error: updateError } = await window.supabaseClient
                .from('programacion')
                .update({
                    executed: true,
                    started_at: startTime.toISOString()
                })
                .eq('id', schedule.id);

            if (updateError) {
                console.error('Error al actualizar programación:', updateError);
                return;
            }

            // Activar la(s) zona(s) de riego
            await this.activateZones(schedule.zone_id);

            // Programar la detención automática
            const stopTimeoutId = setTimeout(() => {
                this.stopIrrigation(schedule.id, schedule.zone_id);
            }, schedule.duration * 60 * 1000); // Convertir minutos a milisegundos

            // Guardar información del riego en ejecución
            this.runningIrrigations.set(schedule.id, {
                zoneId: schedule.zone_id,
                zoneName: schedule.zone_id === 0 ? 'Todas las zonas' : 
                         (schedule.zonas ? schedule.zonas.name : `Zona ${schedule.zone_id}`),
                duration: schedule.duration,
                startTime: startTime,
                stopTimeoutId: stopTimeoutId,
                scheduleId: schedule.id
            });

            // Notificar inicio del riego
            this.notifyIrrigationStart(schedule);

            console.log(`Riego iniciado automáticamente: ${schedule.id}, se detendrá en ${schedule.duration} minutos`);

        } catch (error) {
            console.error('Error al ejecutar riego automático:', error);
        }
    }

    // Activar zonas de riego
    async activateZones(zoneId) {
        try {
            if (zoneId === 0) {
                // Activar todas las zonas
                const { error } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: true })
                    .gt('id', 0);
                
                if (error) throw error;
                console.log('Todas las zonas activadas');
            } else {
                // Activar zona específica
                const { error } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: true })
                    .eq('id', zoneId);
                
                if (error) throw error;
                console.log(`Zona ${zoneId} activada`);
            }

            // Activar control general
            const { error: controlError } = await window.supabaseClient
                .from('control')
                .update({ estado: true })
                .eq('id', 1);

            if (controlError) throw controlError;

        } catch (error) {
            console.error('Error al activar zonas:', error);
            throw error;
        }
    }

    // Detener riego automáticamente
    async stopIrrigation(scheduleId, zoneId) {
        try {
            console.log(`Deteniendo riego automático: ${scheduleId}`);

            // Remover de riegos en ejecución
            const irrigationInfo = this.runningIrrigations.get(scheduleId);
            if (irrigationInfo) {
                clearTimeout(irrigationInfo.stopTimeoutId);
                this.runningIrrigations.delete(scheduleId);
            }

            // Desactivar zonas
            await this.deactivateZones(zoneId);

            // Marcar como completado en la base de datos
            const { error } = await window.supabaseClient
                .from('programacion')
                .update({
                    completed: true,
                    completed_at: new Date().toISOString()
                })
                .eq('id', scheduleId);

            if (error) {
                console.error('Error al marcar riego como completado:', error);
            }

            // Notificar finalización del riego
            this.notifyIrrigationStop(scheduleId, zoneId);

            console.log(`Riego completado automáticamente: ${scheduleId}`);

        } catch (error) {
            console.error('Error al detener riego:', error);
        }
    }

    // Desactivar zonas de riego
    async deactivateZones(zoneId) {
        try {
            if (zoneId === 0) {
                // Desactivar todas las zonas
                const { error } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .gt('id', 0);
                
                if (error) throw error;
                console.log('Todas las zonas desactivadas');
            } else {
                // Desactivar zona específica
                const { error } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: false })
                    .eq('id', zoneId);
                
                if (error) throw error;
                console.log(`Zona ${zoneId} desactivada`);
            }

            // Verificar si hay otras zonas activas
            const { data: activeZones, error: checkError } = await window.supabaseClient
                .from('zonas')
                .select('id')
                .eq('active', true);

            if (checkError) throw checkError;

            // Si no hay zonas activas, desactivar control general
            if (!activeZones || activeZones.length === 0) {
                const { error: controlError } = await window.supabaseClient
                    .from('control')
                    .update({ estado: false })
                    .eq('id', 1);

                if (controlError) throw controlError;
                console.log('Control general desactivado');
            }

        } catch (error) {
            console.error('Error al desactivar zonas:', error);
            throw error;
        }
    }

    // Detener riego manualmente
    async stopIrrigationManually(scheduleId) {
        try {
            const irrigationInfo = this.runningIrrigations.get(scheduleId);
            if (!irrigationInfo) {
                console.log('No se encontró riego activo con ID:', scheduleId);
                return false;
            }

            console.log(`Deteniendo riego manualmente: ${scheduleId}`);
            
            // Cancelar timeout automático
            clearTimeout(irrigationInfo.stopTimeoutId);
            
            // Desactivar zonas
            await this.deactivateZones(irrigationInfo.zoneId);
            
            // Marcar como completado
            const { error } = await window.supabaseClient
                .from('programacion')
                .update({
                    completed: true,
                    completed_at: new Date().toISOString()
                })
                .eq('id', scheduleId);

            if (error) {
                console.error('Error al marcar riego como completado:', error);
            }

            // Remover de riegos activos
            this.runningIrrigations.delete(scheduleId);

            // Notificar detención manual
            this.notifyIrrigationStop(scheduleId, irrigationInfo.zoneId, true);

            return true;

        } catch (error) {
            console.error('Error al detener riego manualmente:', error);
            return false;
        }
    }

    // Agregar nueva programación
    async addSchedule(zoneId, scheduledTime, duration) {
        try {
            const { data, error } = await window.supabaseClient
                .from('programacion')
                .insert([{
                    zone_id: zoneId,
                    scheduled_time: scheduledTime,
                    duration: duration,
                    executed: false,
                    completed: false
                }])
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
                `);

            if (error) throw error;

            if (data && data.length > 0) {
                const newSchedule = data[0];
                this.scheduleIrrigation(newSchedule);
                console.log('Nueva programación agregada:', newSchedule.id);
                return newSchedule;
            }

        } catch (error) {
            console.error('Error al agregar programación:', error);
            throw error;
        }
    }

    // Cancelar programación pendiente
    cancelSchedule(scheduleId) {
        const scheduledJob = this.scheduledJobs.get(scheduleId);
        if (scheduledJob) {
            clearTimeout(scheduledJob.timeoutId);
            this.scheduledJobs.delete(scheduleId);
            console.log('Programación cancelada:', scheduleId);
            return true;
        }
        return false;
    }

    // Verificador de programaciones (ejecuta cada minuto)
    startScheduleChecker() {
        this.checkInterval = setInterval(async () => {
            try {
                // Recargar programaciones nuevas cada 5 minutos
                if (new Date().getMinutes() % 5 === 0) {
                    await this.loadScheduledIrrigations();
                }

                // Verificar riegos que podrían haberse perdido
                await this.checkMissedIrrigations();

            } catch (error) {
                console.error('Error en verificador de programaciones:', error);
            }
        }, 60000); // Cada minuto
    }

    // Verificar riegos que podrían haberse perdido por algún fallo
    async checkMissedIrrigations() {
        try {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

            const { data: missedSchedules, error } = await window.supabaseClient
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
                .eq('executed', false)
                .eq('completed', false)
                .lte('scheduled_time', fiveMinutesAgo.toISOString());

            if (error) throw error;

            // Ejecutar riegos perdidos
            if (missedSchedules && missedSchedules.length > 0) {
                console.log(`Encontrados ${missedSchedules.length} riegos perdidos, ejecutando...`);
                
                for (const schedule of missedSchedules) {
                    if (!this.runningIrrigations.has(schedule.id) && !this.scheduledJobs.has(schedule.id)) {
                        console.log(`Ejecutando riego perdido: ${schedule.id}`);
                        await this.executeIrrigation(schedule);
                    }
                }
            }

        } catch (error) {
            console.error('Error al verificar riegos perdidos:', error);
        }
    }

    // Obtener estado de riegos activos
    getActiveIrrigations() {
        const active = [];
        this.runningIrrigations.forEach((irrigation, scheduleId) => {
            const elapsed = Date.now() - irrigation.startTime.getTime();
            const remaining = Math.max(0, (irrigation.duration * 60 * 1000) - elapsed);
            
            active.push({
                id: scheduleId,
                zoneId: irrigation.zoneId,
                zoneName: irrigation.zoneName,
                duration: irrigation.duration,
                startTime: irrigation.startTime,
                elapsedTime: elapsed,
                remainingTime: remaining,
                progress: Math.min(100, (elapsed / (irrigation.duration * 60 * 1000)) * 100)
            });
        });
        return active;
    }

    // Obtener programaciones pendientes
    getScheduledIrrigations() {
        const scheduled = [];
        this.scheduledJobs.forEach((job, scheduleId) => {
            const timeUntilStart = job.scheduledTime.getTime() - Date.now();
            
            scheduled.push({
                id: scheduleId,
                zoneId: job.schedule.zone_id,
                zoneName: job.schedule.zone_id === 0 ? 'Todas las zonas' : 
                         (job.schedule.zonas ? job.schedule.zonas.name : `Zona ${job.schedule.zone_id}`),
                scheduledTime: job.scheduledTime,
                duration: job.schedule.duration,
                timeUntilStart: timeUntilStart
            });
        });
        return scheduled.sort((a, b) => a.scheduledTime - b.scheduledTime);
    }

    // Notificaciones
    notifyIrrigationStart(schedule) {
        const zoneName = schedule.zone_id === 0 ? 'Todas las zonas' : 
                        (schedule.zonas ? schedule.zonas.name : `Zona ${schedule.zone_id}`);
        
        console.log(`🌊 RIEGO INICIADO: ${zoneName} - ${schedule.duration} minutos`);
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('irrigationStarted', {
            detail: {
                scheduleId: schedule.id,
                zoneId: schedule.zone_id,
                zoneName: zoneName,
                duration: schedule.duration
            }
        }));
    }

    notifyIrrigationStop(scheduleId, zoneId, manual = false) {
        const zoneName = zoneId === 0 ? 'Todas las zonas' : `Zona ${zoneId}`;
        const reason = manual ? 'DETENIDO MANUALMENTE' : 'COMPLETADO AUTOMÁTICAMENTE';
        
        console.log(`🛑 RIEGO ${reason}: ${zoneName}`);
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('irrigationStopped', {
            detail: {
                scheduleId: scheduleId,
                zoneId: zoneId,
                zoneName: zoneName,
                manual: manual
            }
        }));
    }

    // Destruir el scheduler
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Cancelar todos los timeouts programados
        this.scheduledJobs.forEach((job) => {
            clearTimeout(job.timeoutId);
        });

        // Cancelar todos los timeouts de detención
        this.runningIrrigations.forEach((irrigation) => {
            clearTimeout(irrigation.stopTimeoutId);
        });

        this.scheduledJobs.clear();
        this.runningIrrigations.clear();
        this.isInitialized = false;
        
        console.log('Sistema de programación destruido');
    }
}

// Instancia global del scheduler
window.irrigationScheduler = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que Supabase esté disponible
    setTimeout(() => {
        if (window.supabaseClient) {
            window.irrigationScheduler = new IrrigationScheduler();
            window.irrigationScheduler.initialize();
        }
    }, 1500);
});

// Funciones de utilidad para usar desde otros archivos
window.scheduleIrrigation = async (zoneId, scheduledTime, duration) => {
    if (window.irrigationScheduler) {
        return await window.irrigationScheduler.addSchedule(zoneId, scheduledTime, duration);
    }
};

window.stopIrrigationManually = async (scheduleId) => {
    if (window.irrigationScheduler) {
        return await window.irrigationScheduler.stopIrrigationManually(scheduleId);
    }
    return false;
};

window.getActiveIrrigations = () => {
    if (window.irrigationScheduler) {
        return window.irrigationScheduler.getActiveIrrigations();
    }
    return [];
};

window.getScheduledIrrigations = () => {
    if (window.irrigationScheduler) {
        return window.irrigationScheduler.getScheduledIrrigations();
    }
    return [];
};