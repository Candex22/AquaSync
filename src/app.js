// app.js - Funcionalidades principales para AquaSync

// Variables globales
let weatherData = null;
let zonesList = [];

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando aplicación AquaSync...');

    // Inicializar Supabase (definido en supabase-config.js)
    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    // Cargar datos iniciales
    loadWeatherData();
    loadZonesFromDatabase();

    // Configurar event listeners
    setupEventListeners();
});

// Configurar todos los event listeners necesarios
function setupEventListeners() {
    // Botón para control manual
    const manualControlBtn = document.querySelector('.control-actions button');
    if (manualControlBtn) {
        manualControlBtn.addEventListener('click', toggleAllZones);
    }

    // Botón para programar riego (general, not specific to adding zones)
    const scheduleBtn = document.querySelector('.schedule-btn');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', showScheduleForm);
    }
}

// Obtener datos del clima desde una API
async function loadWeatherData() {
    try {
        const weatherWidget = document.querySelector('.weather-widget');

        // Muestra indicador de carga
        if (weatherWidget) {
            weatherWidget.querySelector('.weather-info').innerHTML = '<div class="loading">Cargando datos del clima...</div>';
        }

        // Utilizamos OpenWeatherMap API (necesitarías una API key real)
        // Por ahora usamos una ubicación por defecto (Buenos Aires)
        const apiKey = '2261de86fcc2b517c6db4a7b24065acf';
        const city = 'Buenos Aires';
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;


        const response = await fetch(url);
        weatherData = await response.json();

        // Actualizar la interfaz con los datos del clima
        updateWeatherUI();

    } catch (error) {
        console.error('Error al cargar datos del clima:', error);

        // Muestra mensaje de error en el widget
        const weatherWidget = document.querySelector('.weather-widget');
        if (weatherWidget) {
            weatherWidget.querySelector('.weather-info').innerHTML =
                '<div class="error">Error al cargar datos del clima</div>';
        }
    }
}

// Actualizar la interfaz con los datos del clima
function updateWeatherUI() {
    if (!weatherData) return;

    const weatherWidget = document.querySelector('.weather-widget');
    if (!weatherWidget) return;

    // Determinar ícono según el tipo de clima
    let weatherIcon = 'fa-sun';
    if (weatherData.weather && weatherData.weather[0]) {
        const weatherCondition = weatherData.weather[0].main;
        if (weatherCondition === 'Rain') weatherIcon = 'fa-cloud-rain';
        else if (weatherCondition === 'Clouds') weatherIcon = 'fa-cloud';
        else if (weatherCondition === 'Snow') weatherIcon = 'fa-snowflake';
        else if (weatherCondition === 'Thunderstorm') weatherIcon = 'fa-bolt';
        else if (weatherCondition === 'Drizzle') weatherIcon = 'fa-cloud-drizzle';
        else if (weatherCondition === 'Mist' || weatherCondition === 'Fog') weatherIcon = 'fa-smog';
    }

    // Actualizar HTML
    weatherWidget.querySelector('.weather-info').innerHTML = `
        <div class="weather-temp">${Math.round(weatherData.main.temp)}°C</div>
        <i class="fas ${weatherIcon} weather-icon"></i>
    `;

    // Actualizar detalles
    const weatherDetails = weatherWidget.querySelector('.weather-details');
    if (weatherDetails) {
        weatherDetails.innerHTML = `
            <div class="weather-detail-item">
                <div class="weather-detail-value">${weatherData.main.humidity}%</div>
                <div class="weather-detail-label">Humedad</div>
            </div>
            <div class="weather-detail-item">
                <div class="weather-detail-value">${weatherData.wind.speed} km/h</div>
                <div class="weather-detail-label">Viento</div>
            </div>
            <div class="weather-detail-item">
                <div class="weather-detail-value">${weatherData.weather[0].main === 'Rain' ?
                    'Sí' : '0%'}</div>
                <div class="weather-detail-label">Lluvia</div>
            </div>
        `;
    }
}

// Cargar zonas desde la base de datos
async function loadZonesFromDatabase() {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            console.error('Cliente de Supabase no inicializado');
            return;
        }

        // Preparar la interfaz para mostrar estado de carga
        const zonesGrid = document.querySelector('.zones-grid');
        if (zonesGrid) {
            zonesGrid.innerHTML = '<div class="loading">Cargando zonas...</div>';
        }

        // Obtener zonas de Supabase
        const { data, error } = await window.supabaseClient
            .from('zonas')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        // Si no hay datos, mostrar un mensaje de que no hay zonas configuradas
        if (!data || data.length === 0) {
            if (zonesGrid) {
                zonesGrid.innerHTML = `
                    <div class="empty-zones">
                        <h4>No hay zonas configuradas.</h4>
                        <p>Contacte al administrador para configurar las zonas de riego.</p>
                    </div>
                `;
            }
            zonesList = []; // Ensure zonesList is empty if no data
            return;
        }

        // Guardar datos en variable global
        zonesList = data;

        // Actualizar la interfaz
        renderZonesList();

    } catch (error) {
        console.error('Error al cargar zonas:', error);

        // Mostrar mensaje de error
        const zonesGrid = document.querySelector('.zones-grid');
        if (zonesGrid) {
            zonesGrid.innerHTML = `
                <div class="error-message">Error al cargar las zonas. Por favor, recargue la página.</div>
            `;
        }
    }
}

// Renderizar lista de zonas
function renderZonesList() {
    const zonesGrid = document.querySelector('.zones-grid');
    if (!zonesGrid || !zonesList) return;

    // Si la lista está vacía, mostrar mensaje apropiado (ya manejado en loadZonesFromDatabase)
    if (zonesList.length === 0) {
        return;
    }

    // Limpiar contenedor
    zonesGrid.innerHTML = '';

    // Agregar cada zona
    zonesList.forEach(zone => {
        const zoneCard = document.createElement('div');
        zoneCard.className = 'zone-card';
        zoneCard.innerHTML = `
            <div class="zone-status ${zone.active ? 'zone-active' : 'zone-inactive'}"></div>
            <div class="zone-name">${zone.name}</div>
            <div class="zone-humidity">
                Humedad:
                <div class="humidity-bar">
                    <div class="humidity-level" style="width: ${zone.humidity}%"></div>
                </div>
            </div>
            <div class="zone-actions">
                <button class="zone-btn activate-btn" data-zone-id="${zone.id}">
                    ${zone.active ? 'Desactivar' : 'Activar'}
                </button>
                <button class="zone-btn schedule-btn" data-zone-id="${zone.id}">Programar</button>
            </div>
        `;

        // Agregar al contenedor
        zonesGrid.appendChild(zoneCard);

        // Configurar event listeners para esta zona
        const activateBtn = zoneCard.querySelector('.activate-btn');
        if (activateBtn) {
            activateBtn.addEventListener('click', () => toggleZone(zone.id));
        }

        const scheduleBtn = zoneCard.querySelector('.schedule-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => showScheduleForm(zone.id));
        }
    });
}

// Activar/Desactivar todas las zonas
async function toggleAllZones() {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            alert('Error: No se pudo conectar con la base de datos');
            return;
        }

        // Verificar si alguna zona está activa
        const anyZoneActive = zonesList.some(zone => zone.active);

        // Valor a establecer (activar todas o desactivar todas)
        const newState = !anyZoneActive;

        // Actualizar tabla control en Supabase
        const { data, error } = await window.supabaseClient
            .from('control')
            .update({ estado: newState })
            .eq('id', 1); // Asumimos que hay un registro con id=1

        if (error) throw error;

        // Actualizar zonas en la base de datos
        const { error: zonesError } = await window.supabaseClient
            .from('zonas')
            .update({ active: newState })
            .gt('id', 0); // Actualizar todas las zonas

        if (zonesError) throw zonesError;

        // Actualizar interfaz
        loadZonesFromDatabase();

        // Cambiar texto del botón
        const manualControlBtn = document.querySelector('.control-actions button');
        if (manualControlBtn) {
            manualControlBtn.innerHTML = newState ?
                '<i class="fas fa-power-off"></i> Desactivar Todas las Zonas' :
                '<i class="fas fa-power-off"></i> Activar Todas las Zonas';
        }

    } catch (error) {
        console.error('Error al cambiar estado de las zonas:', error);
        alert('Error al cambiar el estado de las zonas. Intente nuevamente.');
    }
}

// Activar/Desactivar una zona específica
async function toggleZone(zoneId) {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            alert('Error: No se pudo conectar con la base de datos');
            return;
        }

        // Encontrar la zona en la lista
        const zone = zonesList.find(z => z.id === zoneId);
        if (!zone) return;

        // Nuevo estado (invertir el actual)
        const newState = !zone.active;

        // Actualizar en Supabase
        const { data, error } = await window.supabaseClient
            .from('zonas')
            .update({ active: newState })
            .eq('id', zoneId);

        if (error) throw error;

        // Actualizar tabla control en Supabase (si se activa la zona)
        if (newState) {
            const { error: testError } = await window.supabaseClient
                .from('control')
                .update({ estado: true })
                .eq('id', 1);

            if (testError) throw testError;
        }

        // Actualizar interfaz
        loadZonesFromDatabase();

    } catch (error) {
        console.error(`Error al cambiar estado de la zona ${zoneId}:`, error);
        alert('Error al cambiar el estado de la zona. Intente nuevamente.');
    }
}

// Mostrar formulario para programar riego
function showScheduleForm(zoneId) {
    // Crear el overlay si no existe
    let overlay = document.getElementById('form-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'form-overlay';
        document.body.appendChild(overlay);
    }

    // Título diferente si es una zona específica o todas
    let title = 'Programar Riego';
    if (zoneId) {
        const zone = zonesList.find(z => z.id === zoneId);
        if (zone) {
            title += ` - ${zone.name}`;
        }
    } else {
        title += ' - Todas las Zonas';
    }

    // Obtener fecha y hora actual para valores por defecto
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const timeString = now.toTimeString().substring(0, 5);

    // Crear el formulario
    overlay.innerHTML = `
        <div class="modal-form">
            <div class="form-header">
                <h3>${title}</h3>
                <button class="close-form"><i class="fas fa-times"></i></button>
            </div>
            <form id="schedule-form">
                <input type="hidden" id="schedule-zone-id" value="${zoneId || 0}">
                <div class="form-group">
                    <label for="schedule-date">Fecha</label>
                    <input type="date" id="schedule-date" name="date" value="${dateString}" required>
                </div>
                <div class="form-group">
                    <label for="schedule-time">Hora</label>
                    <input type="time" id="schedule-time" name="time" value="${timeString}" required>
                </div>
                <div class="form-group">
                    <label for="schedule-duration">Duración (minutos)</label>
                    <input type="number" id="schedule-duration" name="duration" min="1" max="120" value="30">
                </div>
                <button type="submit" class="zone-btn activate-btn">Programar</button>
            </form>
        </div>
    `;

    // Mostrar el overlay
    overlay.style.display = 'flex';

    // Configurar event listeners
    overlay.querySelector('.close-form').addEventListener('click', hideFormOverlay); // Changed to a more general close function
    document.getElementById('schedule-form').addEventListener('submit', handleScheduleSubmit);
}

// Ocultar formulario genérico (used for schedule form)
function hideFormOverlay() {
    const overlay = document.getElementById('form-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Manejar envío del formulario para programar riego
async function handleScheduleSubmit(event) {
    event.preventDefault();

    // Verificar que el cliente de Supabase esté inicializado
    if (!window.supabaseClient) {
        alert('Error: No se pudo conectar con la base de datos');
        return;
    }

    // Obtener datos del formulario
    const zoneId = document.getElementById('schedule-zone-id').value;
    const date = document.getElementById('schedule-date').value;
    const time = document.getElementById('schedule-time').value;
    const duration = document.getElementById('schedule-duration').value;

    // Combinar fecha y hora
    const scheduledDateTime = new Date(`${date}T${time}`);

    try {
        // Insertar en Supabase
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .insert([
                {
                    zone_id: parseInt(zoneId),
                    scheduled_time: scheduledDateTime.toISOString(),
                    duration: parseInt(duration),
                    executed: false
                }
            ]);

        if (error) throw error;

        // Ocultar formulario
        hideFormOverlay();

        // Recargar programación
        loadScheduledIrrigation();

        // Mostrar mensaje de éxito
        alert('Riego programado correctamente');

    } catch (error) {
        console.error('Error al programar riego:', error);
        alert('Error al programar el riego. Intente nuevamente.');
    }
}

// Cargar programación de riego
async function loadScheduledIrrigation() {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            console.error('Cliente de Supabase no inicializado');
            return;
        }

        // Preparar la interfaz
        const scheduledWidget = document.querySelector('.next-schedule-widget');
        if (!scheduledWidget) return;

        // Mostrar estado de carga
        scheduledWidget.innerHTML = '<div class="loading">Cargando programación...</div>';

        // Obtener programación de Supabase
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .select(`
                id,
                zone_id,
                scheduled_time,
                duration,
                executed,
                zonas (
                    name
                )
            `)
            .eq('executed', false)
            .order('scheduled_time', { ascending: true })
            .limit(5);

        if (error) throw error;

        // Actualizar la interfaz
        updateScheduleUI(data || []);

    } catch (error) {
        console.error('Error al cargar programación:', error);

        // Mostrar mensaje de error
        const scheduledWidget = document.querySelector('.next-schedule-widget');
        if (scheduledWidget) {
            scheduledWidget.innerHTML = '<div class="error">Error al cargar la programación</div>';
        }
    }
}

// Actualizar la interfaz de programación
function updateScheduleUI(scheduleItems) {
    const scheduledWidget = document.querySelector('.next-schedule-widget');
    if (!scheduledWidget) return;

    // Verificar si hay elementos
    if (scheduleItems.length === 0) {
        scheduledWidget.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Próximos Riegos</h3>
                <div class="widget-actions">
                    <button><i class="fas fa-calendar"></i></button>
                </div>
            </div>
            <div class="empty-schedule">
                <p>No hay riegos programados</p>
                <button class="zone-btn schedule-btn">
                    <i class="fas fa-calendar-plus"></i> Programar Riego
                </button>
            </div>
        `;

        // Configurar event listener para el botón
        const scheduleBtn = scheduledWidget.querySelector('.schedule-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => showScheduleForm());
        }

        return;
    }

    // Preparar HTML
    let html = `
        <div class="widget-header">
            <h3 class="widget-title">Próximos Riegos</h3>
            <div class="widget-actions">
                <button><i class="fas fa-calendar"></i></button>
            </div>
        </div>
    `;

    // Agregar cada programación
    scheduleItems.forEach(item => {
        // Formatear fecha y hora
        const scheduleDate = new Date(item.scheduled_time);
        const today = new Date();

        let dateText = '';
        if (scheduleDate.toDateString() === today.toDateString()) {
            dateText = 'Hoy';
        } else if (scheduleDate.getDate() === today.getDate() + 1) {
            dateText = 'Mañana';
        } else {
            const options = { weekday: 'long', day: 'numeric', month: 'long' };
            dateText = scheduleDate.toLocaleDateString('es-ES', options);
        }

        // Formatear hora
        const timeText = scheduleDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Nombre de la zona
        let zoneName = 'Todas las zonas';
        if (item.zone_id > 0 && item.zonas) {
            zoneName = item.zonas.name;
        }

        // Agregar al HTML
        html += `
            <div class="next-irrigation">
                <div class="irrigation-time">${dateText}, ${timeText}</div>
                <div class="irrigation-zones">Zona: ${zoneName}</div>
                <div class="irrigation-duration">Duración: ${item.duration} minutos</div>
            </div>
        `;
    });

    // Actualizar widget
    scheduledWidget.innerHTML = html;
}

// Verificar y ejecutar la programación de riego
async function checkScheduledIrrigation() {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            console.error('Cliente de Supabase no inicializado');
            return;
        }

        // Obtener hora actual
        const now = new Date();

        // Obtener programación pendiente
        const { data, error } = await window.supabaseClient
            .from('programacion')
            .select('*')
            .eq('executed', false)
            .lt('scheduled_time', now.toISOString());

        if (error) throw error;

        // Si no hay programación pendiente, salir
        if (!data || data.length === 0) return;

        // Ejecutar cada programación
        for (const item of data) {
            console.log(`Ejecutando programación ${item.id}`);

            // Activar la zona (o todas)
            if (item.zone_id > 0) {
                // Activar zona específica
                const { error: zoneError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: true })
                    .eq('id', item.zone_id);

                if (zoneError) {
                    console.error(`Error al activar zona ${item.zone_id}:`, zoneError);
                    continue;
                }
            } else {
                // Activar todas las zonas
                const { error: zonesError } = await window.supabaseClient
                    .from('zonas')
                    .update({ active: true })
                    .gt('id', 0);

                if (zonesError) {
                    console.error('Error al activar todas las zonas:', zonesError);
                    continue;
                }
            }

            // Actualizar tabla control
            const { error: testError } = await window.supabaseClient
                .from('control')
                .update({ estado: true })
                .eq('id', 1);

            if (testError) {
                console.error('Error al actualizar tabla control:', testError);
            }

            // Marcar como ejecutada
            const { error: updateError } = await window.supabaseClient
                .from('programacion')
                .update({ executed: true })
                .eq('id', item.id);

            if (updateError) {
                console.error(`Error al marcar programación ${item.id} como ejecutada:`, updateError);
            }

            // Programar desactivación después de la duración
            setTimeout(async () => {
                if (item.zone_id > 0) {
                    // Desactivar zona específica
                    const { error: zoneError } = await window.supabaseClient
                        .from('zonas')
                        .update({ active: false })
                        .eq('id', item.zone_id);

                    if (zoneError) {
                        console.error(`Error al desactivar zona ${item.zone_id}:`, zoneError);
                    }
                } else {
                    // Desactivar todas las zonas
                    const { error: zonesError } = await window.supabaseClient
                        .from('zonas')
                        .update({ active: false })
                        .gt('id', 0);

                    if (zonesError) {
                        console.error('Error al desactivar todas las zonas:', zonesError);
                    }
                }

                // Actualizar tabla control
                const { error: testError } = await window.supabaseClient
                    .from('control')
                    .update({ estado: false })
                    .eq('id', 1);

                if (testError) {
                    console.error('Error al actualizar tabla control:', testError);
                }

                // Actualizar interfaz
                loadZonesFromDatabase();

            }, item.duration * 60 * 1000); // Convertir minutos a milisegundos
        }

        // Recargar programación
        loadScheduledIrrigation();

    } catch (error) {
        console.error('Error al verificar programación:', error);
    }
}

// Comprobar periódicamente la programación de riego
setInterval(checkScheduledIrrigation, 60000); // Cada minuto

// Función para inicializar la base de datos si es necesario
async function initializeDatabase() {
    try {
        // Verificar que el cliente de Supabase esté inicializado
        if (!window.supabaseClient) {
            console.error('Cliente de Supabase no inicializado');
            return;
        }

        console.log('Verificando tabla control...');

        // Verificar si existe el registro en la tabla control
        const { data, error } = await window.supabaseClient
            .from('control')
            .select('*')
            .eq('id', 1);

        if (error) {
            console.error('Error al verificar tabla control:', error);
            return;
        }

        // Si no existe, crear el registro
        if (!data || data.length === 0) {
            console.log('Creando registro inicial en tabla control...');

            const { error: insertError } = await window.supabaseClient
                .from('control')
                .insert([{ id: 1, estado: false }]);

            if (insertError) {
                console.error('Error al crear registro en tabla control:', insertError);
            } else {
                console.log('Registro creado correctamente');
            }
        } else {
            console.log('Tabla control ya inicializada');
        }

    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    }
}

// Llamar a la función de inicialización cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Supabase y luego la base de datos
    if (typeof initSupabase === 'function') {
        initSupabase();
        setTimeout(initializeDatabase, 1000); // Dar tiempo para que se inicialice Supabase
    }
    loadScheduledIrrigation(); // Also load scheduled irrigation on DOMContentLoaded
});