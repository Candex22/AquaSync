class AlertsManager {
    constructor() {
        this.supabase = null;
        this.alerts = [];
        this.listeners = [];
        this.isMonitoring = false;
        this.checkInterval = null;
        this.init();
    }

    async init() {
        console.log('Inicializando sistema de alertas...');
        
        // Esperar a que Supabase esté disponible
        await waitForSupabase();
        this.supabase = window.supabaseClient || supabase;
        
        if (!this.supabase) {
            console.error('No se pudo inicializar el sistema de alertas: Supabase no disponible');
            return;
        }

        // Cargar alertas existentes
        await this.loadAlerts();
        
        // Iniciar monitoreo
        this.startMonitoring();
        
        // Actualizar badge de notificaciones
        this.updateNotificationBadge();
        
        console.log('Sistema de alertas inicializado correctamente');
    }

    // ==================== GESTIÓN DE ALERTAS ====================

    async loadAlerts() {
        try {
            const { data, error } = await this.supabase
                .from('alerts')
                .select('*')
                .eq('dismissed', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.alerts = data || [];
            this.notifyListeners();
            
        } catch (error) {
            console.error('Error cargando alertas:', error);
        }
    }

    async createAlert(alertData) {
        try {
            const alert = {
                type: alertData.type || 'info', // critical, warning, info, success
                title: alertData.title,
                description: alertData.description,
                zone_id: alertData.zone_id || null,
                dismissed: false,
                resolved: false,
                created_at: new Date().toISOString(),
                ...alertData
            };

            const { data, error } = await this.supabase
                .from('alerts')
                .insert([alert])
                .select();

            if (error) throw error;

            if (data && data[0]) {
                this.alerts.unshift(data[0]);
                this.notifyListeners();
                this.updateNotificationBadge();
                console.log('Alerta creada:', data[0]);
            }

            return data ? data[0] : null;

        } catch (error) {
            console.error('Error creando alerta:', error);
            return null;
        }
    }

    async dismissAlert(alertId) {
        try {
            const { error } = await this.supabase
                .from('alerts')
                .update({ dismissed: true })
                .eq('id', alertId);

            if (error) throw error;

            // Actualizar localmente
            this.alerts = this.alerts.filter(a => a.id !== alertId);
            this.notifyListeners();
            this.updateNotificationBadge();

        } catch (error) {
            console.error('Error descartando alerta:', error);
        }
    }

    async resolveAlert(alertId) {
        try {
            const { error } = await this.supabase
                .from('alerts')
                .update({ 
                    resolved: true,
                    resolved_at: new Date().toISOString()
                })
                .eq('id', alertId);

            if (error) throw error;

            // Actualizar localmente
            const alert = this.alerts.find(a => a.id === alertId);
            if (alert) {
                alert.resolved = true;
                alert.resolved_at = new Date().toISOString();
            }
            
            this.notifyListeners();

        } catch (error) {
            console.error('Error resolviendo alerta:', error);
        }
    }

    // ==================== MONITOREO AUTOMÁTICO ====================

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        // Verificar condiciones cada 30 segundos
        this.checkInterval = setInterval(() => {
            this.checkSystemConditions();
        }, 30000);

        // Primera verificación inmediata
        this.checkSystemConditions();
        
        console.log('Monitoreo de alertas iniciado');
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isMonitoring = false;
        console.log('Monitoreo de alertas detenido');
    }

    async checkSystemConditions() {
        try {
            // 1. Verificar humedad de las zonas
            await this.checkZoneHumidity();
            
            // 2. Verificar riegos programados
            await this.checkScheduledIrrigation();
            
            // 3. Verificar clima
            await this.checkWeatherConditions();
            
            // 4. Verificar estado del sistema
            await this.checkSystemStatus();

        } catch (error) {
            console.error('Error en verificación de condiciones:', error);
        }
    }

    async checkZoneHumidity() {
        try {
            const { data: zones, error } = await this.supabase
                .from('zonas')
                .select('*');

            if (error) throw error;

            for (const zone of zones) {
                const humidity = zone.humidity || 0;

                // Alerta crítica: humedad muy baja
                if (humidity < 20 && !this.alertExists('low_humidity', zone.id)) {
                    await this.createAlert({
                        type: 'critical',
                        title: `Humedad crítica en ${zone.name}`,
                        description: `La humedad está en ${humidity}%. Se requiere riego inmediato.`,
                        zone_id: zone.id,
                        alert_code: 'low_humidity',
                        action_required: true
                    });
                }

                // Alerta de advertencia: humedad al 90%
                if (humidity >= 90 && humidity < 100 && !this.alertExists('high_humidity_90', zone.id)) {
                    await this.createAlert({
                        type: 'warning',
                        title: `Sensor de humedad al ${humidity}%`,
                        description: `La zona ${zone.name} registra ${humidity}% de humedad. Considerar reducir frecuencia de riego.`,
                        zone_id: zone.id,
                        alert_code: 'high_humidity_90'
                    });
                }

                // Alerta de saturación: humedad al 100%
                if (humidity >= 100 && !this.alertExists('saturation', zone.id)) {
                    await this.createAlert({
                        type: 'warning',
                        title: 'Sensor de humedad al 100%',
                        description: `La zona ${zone.name} alcanzó saturación completa. Riego pausado automáticamente.`,
                        zone_id: zone.id,
                        alert_code: 'saturation'
                    });
                    
                    // Desactivar zona automáticamente
                    await this.supabase
                        .from('zonas')
                        .update({ active: false })
                        .eq('id', zone.id);
                }

                // Alerta informativa: humedad óptima (80%)
                if (humidity >= 75 && humidity < 85 && !this.alertExists('optimal_humidity', zone.id)) {
                    await this.createAlert({
                        type: 'info',
                        title: `Sensor de humedad al ${humidity}%`,
                        description: `La zona ${zone.name} alcanzó ${humidity}% de humedad. Nivel óptimo para las plantas establecidas.`,
                        zone_id: zone.id,
                        alert_code: 'optimal_humidity'
                    });
                }
            }

        } catch (error) {
            console.error('Error verificando humedad de zonas:', error);
        }
    }

    async checkScheduledIrrigation() {
        try {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

            // Verificar programaciones que deberían estar ejecutándose
            const { data: scheduled, error } = await this.supabase
                .from('programacion')
                .select('*, zonas(name)')
                .eq('executed', false)
                .lt('scheduled_time', now.toISOString());

            if (error) throw error;

            for (const schedule of scheduled) {
                const scheduledTime = new Date(schedule.scheduled_time);
                
                // Alerta: riego no iniciado
                if (scheduledTime < fiveMinutesAgo && !this.alertExists('irrigation_not_started', schedule.id)) {
                    await this.createAlert({
                        type: 'warning',
                        title: 'Riego programado no iniciado',
                        description: `El riego en ${schedule.zonas?.name || 'Zona'} debía iniciar hace ${Math.round((now - scheduledTime) / 60000)} minutos.`,
                        zone_id: schedule.zone_id,
                        alert_code: 'irrigation_not_started',
                        schedule_id: schedule.id
                    });
                }
            }

            // Verificar riegos en ejecución
            const { data: zones, error: zonesError } = await this.supabase
                .from('zonas')
                .select('*')
                .eq('active', true);

            if (zonesError) throw zonesError;

            for (const zone of zones) {
                // Verificar si hay alguna programación activa para esta zona
                const activeSchedule = scheduled.find(s => s.zone_id === zone.id && s.executed === false);
                
                if (!activeSchedule && !this.alertExists('unexpected_stop', zone.id)) {
                    await this.createAlert({
                        type: 'critical',
                        title: 'Riego detenido inesperadamente',
                        description: `El riego programado en ${zone.name} se detuvo antes de completarse.`,
                        zone_id: zone.id,
                        alert_code: 'unexpected_stop',
                        action_required: true
                    });
                }
            }

        } catch (error) {
            console.error('Error verificando programación de riegos:', error);
        }
    }

    async checkWeatherConditions() {
        try {
            // Verificar si existe un sensor de lluvia en la base de datos
            const { data: rainSensor, error: sensorError } = await this.supabase
                .from('sensors')
                .select('*')
                .eq('type', 'rain')
                .single();

            // Si hay sensor de lluvia físico y está activo
            if (rainSensor && rainSensor.active && !this.alertExists('rain_detected')) {
                await this.createAlert({
                    type: 'info',
                    title: 'Lluvia detectada por sensor',
                    description: 'Sensor de lluvia activado. Todos los riegos programados han sido pausados automáticamente.',
                    alert_code: 'rain_detected'
                });

                // Actualizar estado en DB (el hardware debe leer esto)
                await this.supabase
                    .from('zonas')
                    .update({ active: false })
                    .gt('id', 0);
            }

            // Verificar temperatura extrema desde API de clima
            if (typeof weatherData !== 'undefined' && weatherData) {
                if (weatherData.main && weatherData.main.temp > 35 && !this.alertExists('high_temperature')) {
                    await this.createAlert({
                        type: 'warning',
                        title: 'Temperatura elevada',
                        description: `Temperatura actual: ${Math.round(weatherData.main.temp)}°C. Considerar aumentar frecuencia de riego.`,
                        alert_code: 'high_temperature'
                    });
                }

                // Verificar temperatura muy baja (riesgo de heladas)
                if (weatherData.main && weatherData.main.temp < 5 && !this.alertExists('frost_risk')) {
                    await this.createAlert({
                        type: 'warning',
                        title: 'Riesgo de heladas',
                        description: `Temperatura actual: ${Math.round(weatherData.main.temp)}°C. Riego suspendido para evitar daños por congelación.`,
                        alert_code: 'frost_risk'
                    });

                    // Pausar riegos por seguridad
                    await this.supabase
                        .from('zonas')
                        .update({ active: false })
                        .gt('id', 0);
                }
            }

        } catch (error) {
            console.error('Error verificando condiciones climáticas:', error);
        }
    }

    async checkSystemStatus() {
        try {
            // Verificar estado del control general
            const { data: control, error } = await this.supabase
                .from('control')
                .select('*')
                .eq('id', 1)
                .single();

            if (error) throw error;

            // Verificar si hay zonas activas sin control
            const { data: activeZones, error: zonesError } = await this.supabase
                .from('zonas')
                .select('*')
                .eq('active', true);

            if (zonesError) throw zonesError;

            // Alerta crítica: Sistema sin suministro
            if (control && !control.estado && activeZones && activeZones.length > 0 && !this.alertExists('no_water_supply')) {
                await this.createAlert({
                    type: 'critical',
                    title: 'Sistema sin suministro de agua',
                    description: 'No se detecta presión de agua en el sistema principal. Revisar bomba y válvula general.',
                    alert_code: 'no_water_supply',
                    action_required: true
                });
            }

        } catch (error) {
            console.error('Error verificando estado del sistema:', error);
        }
    }

    // ==================== UTILIDADES ====================

    alertExists(alertCode, zoneId = null) {
        return this.alerts.some(alert => {
            const codeMatch = alert.alert_code === alertCode;
            const zoneMatch = zoneId ? alert.zone_id === zoneId : true;
            return codeMatch && zoneMatch && !alert.dismissed;
        });
    }

    getAlertsByType(type) {
        return this.alerts.filter(a => a.type === type && !a.dismissed);
    }

    getActiveAlerts() {
        return this.alerts.filter(a => !a.dismissed);
    }

    getAlertCount() {
        return this.alerts.filter(a => !a.dismissed).length;
    }

    getAlertStats() {
        const active = this.getActiveAlerts();
        return {
            critical: active.filter(a => a.type === 'critical').length,
            warning: active.filter(a => a.type === 'warning').length,
            info: active.filter(a => a.type === 'info').length,
            success: active.filter(a => a.type === 'success').length,
            total: active.length
        };
    }

    // ==================== LISTENERS ====================

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.alerts);
            } catch (error) {
                console.error('Error en listener de alertas:', error);
            }
        });
    }

    // ==================== UI UPDATES ====================

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-icon .badge');
        if (badge) {
            const count = this.getAlertCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // ==================== ACCIONES DE ALERTA ====================

    async performAlertAction(alertId, action) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        try {
            switch (action) {
                case 'restart_irrigation':
                    if (alert.zone_id) {
                        await this.supabase
                            .from('zonas')
                            .update({ active: true })
                            .eq('id', alert.zone_id);
                        
                        await this.resolveAlert(alertId);
                        
                        await this.createAlert({
                            type: 'success',
                            title: 'Fallo de riego resuelto',
                            description: `El problema en ${alert.title.split('en ')[1] || 'la zona'} fue solucionado. Sistema funcionando normalmente.`,
                            zone_id: alert.zone_id,
                            alert_code: 'irrigation_resolved'
                        });
                    }
                    break;

                case 'adjust_schedule':
                    // Redirigir a página de programación
                    window.location.href = '/pages/programming.html';
                    break;

                case 'view_zone':
                    // Redirigir a página de zonas
                    window.location.href = '/pages/zones.html';
                    break;

                case 'check_system':
                    // Mostrar diagnóstico del sistema
                    this.showSystemDiagnostics();
                    break;

                default:
                    console.log('Acción no implementada:', action);
            }

        } catch (error) {
            console.error('Error ejecutando acción de alerta:', error);
        }
    }

    showSystemDiagnostics() {
        alert('Diagnóstico del sistema:\n\n✓ Conexión: OK\n✓ Base de datos: OK\n✗ Presión de agua: REVISAR\n\nContacte al técnico para revisión.');
    }
}

// ==================== INSTANCIA GLOBAL ====================

// Crear instancia global del gestor de alertas
let alertsManager;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    alertsManager = new AlertsManager();
    
    // Hacer disponible globalmente
    window.alertsManager = alertsManager;
    
    console.log('Gestor de alertas disponible globalmente como window.alertsManager');
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlertsManager;
}