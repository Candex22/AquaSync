class StatisticsManager {
    constructor() {
        this.supabase = null;
        this.currentDateFilter = 'last7days';
        this.charts = {};
        this.isLoading = false;
        this.init();
    }

    async init() {
        try {
            // Esperar a que Supabase esté disponible
            await waitForSupabase();
            if (window.supabaseClient || supabase) {
                this.supabase = window.supabaseClient || supabase;
                console.log('Supabase client initialized for statistics');
            } else {
                console.error('Supabase client not available');
                return;
            }
            await this.loadStatistics();
            this.setupEventListeners();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Error initializing statistics:', error);
            this.showError('Error al inicializar las estadísticas');
        }
    }

    setupEventListeners() {
        // Filtro de fecha
        const filterSelect = document.querySelector('.filter-select');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.currentDateFilter = e.target.value;
                this.loadStatistics();
            });
        }

        // Botones de descarga
        document.querySelectorAll('[data-download]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.closest('[data-download]').dataset.download;
                this.downloadChart(chartType);
            });
        });

        // Tabs de gráficos ambientales
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.textContent.toLowerCase();
                this.switchEnvironmentalChart(type);
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    async loadStatistics() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            this.showLoading();

            const [
                kpiData,
                waterUsageData,
                zonePerformanceData,
                environmentalData,
                irrigationHistory,
                alertsData
            ] = await Promise.all([
                this.fetchKPIData(),
                this.fetchWaterUsageData(),
                this.fetchZonePerformanceData(),
                this.fetchEnvironmentalData(),
                this.fetchIrrigationHistory(),
                this.fetchAlertsData()
            ]);

            this.updateKPICards(kpiData);
            this.updateWaterUsageChart(waterUsageData);
            this.updateZonePerformanceChart(zonePerformanceData);
            this.updateEnvironmentalChart(environmentalData);
            this.updateIrrigationHistoryTable(irrigationHistory);
            this.updateAlertsSection(alertsData);

            this.hideLoading();
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.showError('Error al cargar las estadísticas');
            this.hideLoading();
        } finally {
            this.isLoading = false;
        }
    }

    // Obtener datos KPI desde Supabase
    async fetchKPIData() {
        const dateRange = this.getDateRange();

        try {
            // Obtener consumo de agua
            const { data: waterData, error: waterError } = await this.supabase
                .from('irrigation_history')
                .select('liters_used, created_at')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end)
                .eq('status', 'completed');

            if (waterError) throw waterError;

            // Obtener datos de energía (simulados por ahora)
            const { data: energyData, error: energyError } = await this.supabase
                .from('system_logs')
                .select('*')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end);

            // Calcular totales
            const totalWater = waterData?.reduce((sum, record) => sum + (record.liters_used || 0), 0) || 0;
            const averageEfficiency = 94; // Calcular basado en datos reales
            const estimatedSavings = Math.round(totalWater * 0.15); // Estimación

            return {
                waterUsage: {
                    value: totalWater,
                    change: this.calculatePercentageChange(totalWater, 2200) // Comparar con período anterior
                },
                energyConsumption: {
                    value: Math.round(totalWater * 0.02), // Estimación: 0.02 kWh por litro
                    change: -8
                },
                efficiency: {
                    value: averageEfficiency,
                    change: 3
                },
                savings: {
                    value: estimatedSavings,
                    change: 15
                }
            };
        } catch (error) {
            console.error('Error fetching KPI data:', error);
            return this.getDefaultKPIData();
        }
    }

    async fetchWaterUsageData() {
        const dateRange = this.getDateRange();

        try {
            const { data, error } = await this.supabase
                .from('irrigation_history')
                .select('liters_used, created_at')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end)
                .eq('status', 'completed')
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Agrupar por día
            const dailyData = {};
            data?.forEach(record => {
                const date = new Date(record.created_at).toISOString().split('T')[0];
                if (!dailyData[date]) {
                    dailyData[date] = 0;
                }
                dailyData[date] += record.liters_used || 0;
            });

            // Convertir a array para el gráfico
            return Object.entries(dailyData).map(([date, liters]) => ({
                date: new Date(date).toLocaleDateString('es-ES'),
                liters: Math.round(liters)
            }));
        } catch (error) {
            console.error('Error fetching water usage data:', error);
            return this.getDefaultWaterUsageData();
        }
    }

    async fetchZonePerformanceData() {
        const dateRange = this.getDateRange();

        try {
            // Obtener zonas
            const { data: zones, error: zonesError } = await this.supabase
                .from('zones')
                .select('*')
                .eq('active', true);

            if (zonesError) throw zonesError;

            // Obtener uso por zona
            const { data: usage, error: usageError } = await this.supabase
                .from('irrigation_history')
                .select('zone_id, liters_used')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end)
                .eq('status', 'completed');

            if (usageError) throw usageError;

            // Agrupar por zona
            const zoneUsage = {};
            usage?.forEach(record => {
                if (!zoneUsage[record.zone_id]) {
                    zoneUsage[record.zone_id] = 0;
                }
                zoneUsage[record.zone_id] += record.liters_used || 0;
            });

            const usageArray = Object.entries(zoneUsage).map(([zone_id, liters]) => ({
                zone_id: parseInt(zone_id),
                liters: Math.round(liters)
            }));

            return {
                zones: zones || [],
                usage: usageArray
            };
        } catch (error) {
            console.error('Error fetching zone performance data:', error);
            return this.getDefaultZonePerformanceData();
        }
    }

    async fetchEnvironmentalData() {
        const dateRange = this.getDateRange();

        try {
            const { data, error } = await this.supabase
                .from('environmental_data')
                .select('temperature, humidity, pressure, created_at')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            return data?.map(record => ({
                timestamp: record.created_at,
                temperature: record.temperature,
                humidity: record.humidity,
                pressure: record.pressure
            })) || [];
        } catch (error) {
            console.error('Error fetching environmental data:', error);
            return this.getDefaultEnvironmentalData();
        }
    }

    async fetchIrrigationHistory() {
        const dateRange = this.getDateRange();

        try {
            const { data, error } = await this.supabase
                .from('irrigation_history')
                .select('*')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            // Si necesitas información de zonas, hacer una consulta separada
            const zoneIds = [...new Set(data?.map(record => record.zone_id) || [])];
            let zonesData = [];

            if (zoneIds.length > 0) {
                const { data: zones, error: zonesError } = await this.supabase
                    .from('zones')
                    .select('id, description')
                    .in('id', zoneIds);

                if (!zonesError) {
                    zonesData = zones || [];
                }
            }

            // Combinar datos
            const enrichedData = data?.map(record => ({
                ...record,
                zone_description: zonesData.find(z => z.id === record.zone_id)?.description || `Zona ${record.zone_id}`
            })) || [];

            return enrichedData;
        } catch (error) {
            console.error('Error fetching irrigation history:', error);
            return this.getDefaultIrrigationHistory();
        }
    }

    async fetchAlertsData() {
        try {
            const { data, error } = await this.supabase
                .from('system_alerts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching alerts data:', error);
            return this.getDefaultAlertsData();
        }
    }

    // Métodos para actualizar UI
    updateKPICards(data) {
        this.updateKPICard('water', data.waterUsage.value, 'L', data.waterUsage.change);
        this.updateKPICard('energy', data.energyConsumption.value, ' kWh', data.energyConsumption.change);
        this.updateKPICard('efficiency', data.efficiency.value, '%', data.efficiency.change);
        this.updateKPICard('savings', data.savings.value, '$', data.savings.change);
    }

    updateKPICard(type, value, unit, change) {
        const card = document.querySelector(`[data-kpi="${type}"]`);
        if (!card) return;

        const valueElement = card.querySelector('.kpi-value');
        const changeElement = card.querySelector('.kpi-change');

        if (valueElement) {
            valueElement.textContent = `${this.formatNumber(value)}${unit}`;
        }

        if (changeElement && change !== undefined) {
            const isPositive = change >= 0;
            changeElement.className = `kpi-change ${isPositive ? 'positive' : 'negative'}`;
            changeElement.innerHTML = `
                <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i> 
                ${Math.abs(change).toFixed(0)}%
            `;
        }
    }

    updateWaterUsageChart(data) {
        const chartContainer = document.querySelector('.chart-bars');
        if (!chartContainer || !data.length) {
            chartContainer.innerHTML = '<div class="no-data">No hay datos disponibles</div>';
            return;
        }

        const maxValue = Math.max(...data.map(d => d.liters));

        chartContainer.innerHTML = data.map(day => {
            const height = maxValue > 0 ? (day.liters / maxValue) * 100 : 0;
            return `
                <div class="bar" 
                     style="height: ${height}%;" 
                     data-value="${day.liters}"
                     data-date="${day.date}"
                     title="${day.date}: ${day.liters}L">
                </div>
            `;
        }).join('');

        this.addBarHoverEffects();
    }

    updateZonePerformanceChart(data) {
        const { zones, usage } = data;
        const totalUsage = usage.reduce((sum, zone) => sum + zone.liters, 0);

        // Actualizar estadísticas de zona
        const zoneStats = document.querySelector('.zone-stats');
        if (zoneStats) {
            if (usage.length === 0) {
                zoneStats.innerHTML = '<div class="no-data">No hay datos de zonas disponibles</div>';
            } else {
                zoneStats.innerHTML = usage.map((zone, index) => {
                    const percentage = totalUsage > 0 ? (zone.liters / totalUsage * 100).toFixed(1) : 0;
                    const zoneInfo = zones.find(z => z.id === zone.zone_id) || { description: `Zona ${zone.zone_id}` };

                    return `
                        <div class="zone-stat-item">
                            <div class="zone-color zone-${(index % 5) + 1}"></div>
                            <span class="zone-name">${zoneInfo.description}</span>
                            <span class="zone-percentage">${percentage}%</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // Actualizar número de zonas activas
        const donutValue = document.querySelector('.donut-value');
        if (donutValue) {
            const activeZones = usage.filter(zone => zone.liters > 0).length;
            donutValue.textContent = 2;
        }

        // Actualizar gráfico donut
        this.updateDonutChart(usage, totalUsage);
    }

    updateDonutChart(usage, totalUsage) {
        const donutChart = document.querySelector('.donut-chart');
        if (!donutChart || !usage.length) return;

        let currentAngle = 0;
        const colors = [
            'var(--medium-green)',
            'var(--light-green)',
            'var(--light-brown)',
            'var(--dark-brown)',
            'rgba(156, 171, 99, 0.3)'
        ];

        const gradientStops = usage.map((zone, index) => {
            const percentage = totalUsage > 0 ? (zone.liters / totalUsage) : 0;
            const angle = percentage * 360;
            const color = colors[index % colors.length];

            const stop = `${color} ${currentAngle}deg ${currentAngle + angle}deg`;
            currentAngle += angle;

            return stop;
        }).join(', ');

        if (gradientStops) {
            donutChart.style.background = `conic-gradient(${gradientStops})`;
        }
    }

    updateEnvironmentalChart(data, type = 'temperatura') {
        if (!data || !data.length) {
            const svg = document.querySelector('.chart-svg');
            if (svg) {
                svg.innerHTML = '<text x="200" y="100" text-anchor="middle" fill="var(--dark-brown)">No hay datos ambientales disponibles</text>';
            }
            return;
        }

        const svg = document.querySelector('.chart-svg');
        if (!svg) return;

        const width = 400;
        const height = 200;
        const padding = 40;

        // Limpiar SVG
        svg.innerHTML = '';

        // Mapear tipo a campo de datos
        const fieldMap = {
            'temperatura': 'temperature',
            'humedad': 'humidity',
            'presión': 'pressure'
        };
        const field = fieldMap[type] || 'temperature';

        // Crear path para el gráfico de líneas
        const validData = data.filter(item => item[field] !== null && item[field] !== undefined);
        if (validData.length === 0) return;

        const points = validData.map((item, index) => {
            const x = padding + (index / (validData.length - 1)) * (width - 2 * padding);
            const maxValue = Math.max(...validData.map(d => d[field] || 0));
            const minValue = Math.min(...validData.map(d => d[field] || 0));
            const range = maxValue - minValue || 1;
            const y = height - padding - ((item[field] - minValue) / range) * (height - 2 * padding);
            return `${x},${y}`;
        });

        const pathData = `M ${points.join(' L ')}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', 'var(--medium-green)');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('class', 'chart-line');

        svg.appendChild(path);

        // Agregar puntos interactivos
        validData.forEach((item, index) => {
            const x = padding + (index / (validData.length - 1)) * (width - 2 * padding);
            const maxValue = Math.max(...validData.map(d => d[field] || 0));
            const minValue = Math.min(...validData.map(d => d[field] || 0));
            const range = maxValue - minValue || 1;
            const y = height - padding - ((item[field] - minValue) / range) * (height - 2 * padding);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', 'var(--medium-green)');
            circle.setAttribute('class', 'chart-point');
            circle.setAttribute('data-value', item[field]);
            circle.setAttribute('data-date', new Date(item.timestamp).toLocaleDateString('es-ES'));

            svg.appendChild(circle);
        });
    }

    switchEnvironmentalChart(type) {
        this.fetchEnvironmentalData().then(data => {
            this.updateEnvironmentalChart(data, type);
        });
    }

    updateIrrigationHistoryTable(data) {
        const tbody = document.querySelector('.stats-table tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos de riego disponibles</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(record => {
            const date = new Date(record.created_at).toLocaleDateString('es-ES');
            const time = new Date(record.created_at).toLocaleTimeString('es-ES');
            const duration = record.duration_minutes || 0;
            const liters = record.liters_used || 0;
            const status = record.status || 'unknown';

            const statusClass = status === 'completed' ? 'success' :
                status === 'error' ? 'error' :
                    status === 'running' ? 'warning' : 'info';

            const statusText = status === 'completed' ? 'Completado' :
                status === 'error' ? 'Error' :
                    status === 'running' ? 'En ejecución' : 'Desconocido';

            return `
                <tr>
                    <td>
                        <div class="date-time">
                            <div class="date">${date}</div>
                            <div class="time">${time}</div>
                        </div>
                    </td>
                    <td>${record.zone_description || `Zona ${record.zone_id}`}</td>
                    <td>${duration} min</td>
                    <td>${this.formatNumber(liters)} L</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateAlertsSection(data) {
        const alertsContainer = document.querySelector('.alerts-container');
        if (!alertsContainer) return;

        if (!data || data.length === 0) {
            alertsContainer.innerHTML = '<div class="no-data">No hay alertas recientes</div>';
            return;
        }

        alertsContainer.innerHTML = data.map(alert => {
            const date = new Date(alert.created_at).toLocaleDateString('es-ES');
            const time = new Date(alert.created_at).toLocaleTimeString('es-ES');
            const type = alert.type || 'info';

            const typeClass = type === 'error' ? 'error' :
                type === 'warning' ? 'warning' :
                    type === 'success' ? 'success' : 'info';

            const typeIcon = type === 'error' ? 'fas fa-exclamation-triangle' :
                type === 'warning' ? 'fas fa-exclamation-circle' :
                    type === 'success' ? 'fas fa-check-circle' : 'fas fa-info-circle';

            return `
                <div class="alert-item ${typeClass}">
                    <div class="alert-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div class="alert-content">
                        <div class="alert-title">${alert.title || 'Sin título'}</div>
                        <div class="alert-message">${alert.message || 'Sin mensaje'}</div>
                        <div class="alert-time">${date} ${time}</div>
                    </div>
                    <div class="alert-status">
                        ${alert.resolved ? '<span class="resolved">Resuelto</span>' : '<span class="pending">Pendiente</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Métodos utilitarios
    getDateRange() {
        const now = new Date();
        let start = new Date();

        switch (this.currentDateFilter) {
            case 'last7days':
                start.setDate(now.getDate() - 7);
                break;
            case 'last30days':
                start.setDate(now.getDate() - 30);
                break;
            case 'lastyear':
                start.setFullYear(now.getFullYear() - 1);
                break;
            default:
                start.setDate(now.getDate() - 7);
        }

        return {
            start: start.toISOString(),
            end: now.toISOString()
        };
    }

    calculatePercentageChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    addBarHoverEffects() {
        const bars = document.querySelectorAll('.bar');
        bars.forEach(bar => {
            bar.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'chart-tooltip';
                tooltip.textContent = `${e.target.dataset.date}: ${e.target.dataset.value}L`;
                tooltip.style.position = 'absolute';
                tooltip.style.backgroundColor = 'var(--dark-brown)';
                tooltip.style.color = 'white';
                tooltip.style.padding = '5px 10px';
                tooltip.style.borderRadius = '4px';
                tooltip.style.fontSize = '12px';
                tooltip.style.zIndex = '1000';

                document.body.appendChild(tooltip);

                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.top - 30) + 'px';
            });

            bar.addEventListener('mouseleave', () => {
                const tooltip = document.querySelector('.chart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });
        });
    }

    downloadChart(chartType) {
        console.log(`Descargando gráfico: ${chartType}`);
        // Implementar funcionalidad de descarga
        // Por ejemplo, usando html2canvas o similar
    }

    startAutoRefresh() {
        // Actualizar cada 5 minutos
        setInterval(() => {
            if (!this.isLoading) {
                this.loadStatistics();
            }
        }, 5 * 60 * 1000);
    }

    showLoading() {
        // Mostrar indicadores de carga
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.textContent = 'Cargando...';
        });
    }

    hideLoading() {
        // Ocultar indicadores de carga si es necesario
    }

    showError(message) {
        console.error(message);
        // Mostrar mensaje de error al usuario
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Datos por defecto en caso de error
    getDefaultKPIData() {
        return {
            waterUsage: { value: 0, change: 0 },
            energyConsumption: { value: 0, change: 0 },
            efficiency: { value: 0, change: 0 },
            savings: { value: 0, change: 0 }
        };
    }

    getDefaultWaterUsageData() {
        return [];
    }

    getDefaultZonePerformanceData() {
        return { zones: [], usage: [] };
    }

    getDefaultEnvironmentalData() {
        return [];
    }

    getDefaultIrrigationHistory() {
        return [];
    }

    getDefaultAlertsData() {
        return [];
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new StatisticsManager();
});