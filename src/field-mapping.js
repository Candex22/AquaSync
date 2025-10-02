// Variables globales
let gridSize = 10; // Tamaño del grid por defecto
let fieldType = 'futbol'; // Tipo de campo seleccionado
let sprinklers = []; // Array para almacenar los aspersores
let sprinklerId = 1; // Contador para IDs de aspersores

// Configuración por defecto desde Supabase
const defaultSprinklers = [
    {
        id: 1,
        name: 'Aspersor 1',
        type: 'large',
        radius: 3,
        row: 2,
        col: 3,
        zone: 1,
        active: true
    },
    {
        id: 2,
        name: 'Aspersor 2',
        type: 'large',
        radius: 3,
        row: 2,
        col: 1,
        zone: 2,
        active: true
    }
];

// Referencias a elementos DOM
const fieldMap = document.getElementById('field-map');
const gridOverlay = document.getElementById('grid-overlay');
const sprinklersLayer = document.getElementById('sprinklers-layer');
const coverageLayer = document.getElementById('coverage-layer');
const sprinklerCountDisplay = document.getElementById('sprinkler-count');
const coveragePercentDisplay = document.getElementById('coverage-percent');
const zonesCountDisplay = document.getElementById('zones-count');
const sprinklerList = document.getElementById('sprinkler-list');
const btnDownloadConfig = document.getElementById('btn-download-config');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar configuración desde Supabase
    loadFromSupabase();
    
    // Event listeners solo para descarga
    btnDownloadConfig.addEventListener('click', downloadConfiguration);
});

/**
 * Carga la configuración desde Supabase
 */
async function loadFromSupabase() {
    try {
        // Intentar cargar desde Supabase
        if (typeof supabase !== 'undefined') {
            const { data, error } = await supabase
                .from('field_configuration')
                .select('*')
                .single();
            
            if (data && !error) {
                fieldType = data.field_type || 'futbol';
                gridSize = data.grid_size || 10;
                sprinklers = data.sprinklers || defaultSprinklers;
                sprinklerId = Math.max(...sprinklers.map(s => s.id)) + 1;
                
                fieldMap.className = `field-map ${fieldType}`;
                initializeGrid();
                updateSprinklerList();
                updateStats();
                return;
            }
        }
    } catch (error) {
        console.log('Usando configuración por defecto');
    }
    
    // Si no hay datos en Supabase, usar configuración por defecto
    sprinklers = defaultSprinklers;
    sprinklerId = 3;
    initializeGrid();
    updateSprinklerList();
    updateStats();
}

/**
 * Inicializa el grid en el campo (SOLO VISUALIZACIÓN)
 */
function initializeGrid() {
    // Limpiar grid existente
    gridOverlay.innerHTML = '';
    
    // Crear celdas del grid (SOLO VISUALIZACIÓN - sin eventos de clic)
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell grid-cell-readonly';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            gridOverlay.appendChild(cell);
        }
    }
    
    // Actualizar estilo CSS para grid dinámico
    gridOverlay.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridOverlay.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
    
    // Actualizar visualización
    updateFieldVisualization();
}

/**
 * Actualiza la visualización del campo y los aspersores (SOLO LECTURA)
 */
function updateFieldVisualization() {
    // Limpiar capas
    sprinklersLayer.innerHTML = '';
    
    // Actualizar coberturas
    updateCoverageLayer();
    
    // Colocar aspersores (sin interacción)
    sprinklers.forEach(sprinkler => {
        // Calcular posición en píxeles
        const cellWidth = fieldMap.offsetWidth / gridSize;
        const cellHeight = fieldMap.offsetHeight / gridSize;
        
        const posX = (sprinkler.col + 0.5) * cellWidth;
        const posY = (sprinkler.row + 0.5) * cellHeight;
        
        // Crear elemento visual del aspersor
        const sprinklerElement = document.createElement('div');
        sprinklerElement.className = `sprinkler ${sprinkler.type} sprinkler-readonly`;
        sprinklerElement.dataset.id = sprinkler.id;
        sprinklerElement.style.left = `${posX}px`;
        sprinklerElement.style.top = `${posY}px`;
        sprinklerElement.style.cursor = 'default';
        
        // Icono para el aspersor
        const icon = document.createElement('i');
        icon.className = 'fas fa-tint';
        sprinklerElement.appendChild(icon);
        
        sprinklersLayer.appendChild(sprinklerElement);
    });
    
    // Marcar celdas que tienen aspersores
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        if (sprinklers.some(s => s.row === row && s.col === col)) {
            cell.classList.add('has-sprinkler');
        } else {
            cell.classList.remove('has-sprinkler');
        }
    });
}

/**
 * Actualiza la capa de cobertura con los círculos de riego
 */
function updateCoverageLayer() {
    // Limpiar capa de cobertura
    coverageLayer.innerHTML = '';
    
    // Dibujar círculos de cobertura para cada aspersor
    sprinklers.forEach(sprinkler => {
        const cellWidth = fieldMap.offsetWidth / gridSize;
        const cellHeight = fieldMap.offsetHeight / gridSize;
        
        const centerX = (sprinkler.col + 0.5) * cellWidth;
        const centerY = (sprinkler.row + 0.5) * cellHeight;
        
        // Radio en píxeles (basado en el número de celdas)
        const radiusInPixels = sprinkler.radius * Math.min(cellWidth, cellHeight);
        
        // Crear círculo de cobertura
        const coverageCircle = document.createElement('div');
        coverageCircle.className = 'coverage-circle';
        coverageCircle.style.left = `${centerX - radiusInPixels}px`;
        coverageCircle.style.top = `${centerY - radiusInPixels}px`;
        coverageCircle.style.width = `${radiusInPixels * 2}px`;
        coverageCircle.style.height = `${radiusInPixels * 2}px`;
        
        // Asignar color según la zona
        const zoneColors = [
            'rgba(172, 189, 105, 0.5)',  // Zona 1 (verde)
            'rgba(155, 134, 104, 0.5)',  // Zona 2 (marrón)
            'rgba(100, 149, 237, 0.5)',  // Zona 3 (azul)
            'rgba(221, 160, 221, 0.5)'   // Zona 4 (púrpura)
        ];
        
        coverageCircle.style.backgroundColor = zoneColors[(sprinkler.zone - 1) % zoneColors.length];
        
        coverageLayer.appendChild(coverageCircle);
    });
}

/**
 * Actualiza la lista de aspersores en la tabla (SOLO VISUALIZACIÓN)
 */
function updateSprinklerList() {
    // Limpiar lista
    sprinklerList.innerHTML = '';
    
    if (sprinklers.length === 0) {
        // Mostrar mensaje si no hay aspersores
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-message';
        emptyRow.innerHTML = '<td colspan="4">No hay aspersores colocados en el campo</td>';
        sprinklerList.appendChild(emptyRow);
        return;
    }
    
    // Crear filas para cada aspersor (SIN BOTONES DE ACCIÓN)
    sprinklers.forEach(sprinkler => {
        const row = document.createElement('tr');
        
        // ID
        const idCell = document.createElement('td');
        idCell.textContent = sprinkler.id;
        row.appendChild(idCell);
        
        // Tipo
        const typeCell = document.createElement('td');
        let typeName = '';
        switch(sprinkler.type) {
            case 'small': typeName = 'Pequeño (6m)'; break;
            case 'medium': typeName = 'Mediano (12m)'; break;
            case 'large': typeName = 'Grande (18m)'; break;
        }
        typeCell.textContent = typeName;
        row.appendChild(typeCell);
        
        // Posición
        const posCell = document.createElement('td');
        posCell.textContent = `Fila ${sprinkler.row + 1}, Col ${sprinkler.col + 1}`;
        row.appendChild(posCell);
        
        // Zona
        const zoneCell = document.createElement('td');
        zoneCell.textContent = `Zona ${sprinkler.zone}`;
        row.appendChild(zoneCell);
        
        sprinklerList.appendChild(row);
    });
}

/**
 * Actualiza las estadísticas del campo
 */
function updateStats() {
    // Actualizar contador de aspersores
    sprinklerCountDisplay.textContent = sprinklers.length;
    
    // Calcular zonas únicas
    const uniqueZones = [...new Set(sprinklers.map(s => s.zone))];
    zonesCountDisplay.textContent = uniqueZones.length;
    
    // Calcular porcentaje de cobertura aproximado
    calculateCoveragePercentage();
}

/**
 * Calcula el porcentaje de cobertura aproximado
 */
function calculateCoveragePercentage() {
    // Crear una matriz para representar el campo
    const fieldMatrix = Array(gridSize).fill().map(() => Array(gridSize).fill(false));
    
    // Marcar las celdas cubiertas por aspersores
    sprinklers.forEach(sprinkler => {
        const radius = sprinkler.radius;
        const row = sprinkler.row;
        const col = sprinkler.col;
        
        // Marcar las celdas dentro del radio del aspersor
        for (let r = Math.max(0, row - radius); r <= Math.min(gridSize - 1, row + radius); r++) {
            for (let c = Math.max(0, col - radius); c <= Math.min(gridSize - 1, col + radius); c++) {
                // Calcular distancia al centro del aspersor
                const distance = Math.sqrt(Math.pow(r - row, 2) + Math.pow(c - col, 2));
                
                // Si está dentro del radio, marcar como cubierta
                if (distance <= radius) {
                    fieldMatrix[r][c] = true;
                }
            }
        }
    });
    
    // Contar celdas cubiertas
    let coveredCells = 0;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (fieldMatrix[r][c]) coveredCells++;
        }
    }
    
    // Calcular porcentaje
    const totalCells = gridSize * gridSize;
    const coveragePercent = Math.round((coveredCells / totalCells) * 100);
    
    // Actualizar display
    coveragePercentDisplay.textContent = `${coveragePercent}%`;
}

/**
 * Descarga la configuración actual como un archivo JSON
 */
function downloadConfiguration() {
    if (sprinklers.length === 0) {
        alert('No hay aspersores para exportar');
        return;
    }
    
    const configuration = {
        fieldType: fieldType,
        gridSize: gridSize,
        sprinklers: sprinklers,
        exportDate: new Date().toISOString()
    };
    
    // Crear blob y link de descarga
    const dataStr = JSON.stringify(configuration, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(dataBlob);
    downloadLink.download = `aquasync_field_config_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}