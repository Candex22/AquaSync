// Variables globales
let gridSize = 10; // Tamaño del grid por defecto
let sprinklerType = 'medium'; // Tipo de aspersor seleccionado
let sprinklerRadius = 2; // Radio de cobertura (en celdas)
let fieldType = 'futbol'; // Tipo de campo seleccionado
let sprinklers = []; // Array para almacenar los aspersores
let sprinklerId = 1; // Contador para IDs de aspersores
let selectedSprinkler = null; // Aspersor seleccionado para editar

// Referencias a elementos DOM
const fieldMap = document.getElementById('field-map');
const gridOverlay = document.getElementById('grid-overlay');
const sprinklersLayer = document.getElementById('sprinklers-layer');
const coverageLayer = document.getElementById('coverage-layer');
const fieldTypeSelect = document.getElementById('field-type');
const gridSizeSelect = document.getElementById('grid-size');
const sprinklerTypeSelect = document.getElementById('sprinkler-type');
const sprinklerCountDisplay = document.getElementById('sprinkler-count');
const coveragePercentDisplay = document.getElementById('coverage-percent');
const zonesCountDisplay = document.getElementById('zones-count');
const sprinklerList = document.getElementById('sprinkler-list');
const btnSaveMap = document.getElementById('btn-save-map');
const btnClearMap = document.getElementById('btn-clear-map');
const btnDownloadConfig = document.getElementById('btn-download-config');

// Modal
const sprinklerModal = document.getElementById('sprinkler-modal');
const closeModal = document.querySelector('.close-modal');
const editSprinklerId = document.getElementById('edit-sprinkler-id');
const editSprinklerName = document.getElementById('edit-sprinkler-name');
const editSprinklerType = document.getElementById('edit-sprinkler-type');
const editSprinklerZone = document.getElementById('edit-sprinkler-zone');
const btnUpdateSprinkler = document.getElementById('btn-update-sprinkler');
const btnDeleteSprinkler = document.getElementById('btn-delete-sprinkler');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Crear el grid inicial
    initializeGrid();
    
    // Event listeners para controles
    fieldTypeSelect.addEventListener('change', changeFieldType);
    gridSizeSelect.addEventListener('change', changeGridSize);
    sprinklerTypeSelect.addEventListener('change', changeSprinklerType);
    btnSaveMap.addEventListener('click', saveFieldConfiguration);
    btnClearMap.addEventListener('click', clearField);
    btnDownloadConfig.addEventListener('click', downloadConfiguration);
    
    // Event listeners para el modal
    closeModal.addEventListener('click', () => sprinklerModal.style.display = 'none');
    btnUpdateSprinkler.addEventListener('click', updateSprinkler);
    btnDeleteSprinkler.addEventListener('click', deleteSprinkler);
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === sprinklerModal) {
            sprinklerModal.style.display = 'none';
        }
    });
    
    // Cargar configuración guardada (si existe)
    loadSavedConfiguration();
});

/**
 * Inicializa el grid en el campo
 */
function initializeGrid() {
    // Limpiar grid existente
    gridOverlay.innerHTML = '';
    
    // Crear celdas del grid
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Event listener para colocar aspersores al hacer clic
            cell.addEventListener('click', (e) => {
                placeSprinkler(row, col);
            });
            
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
 * Cambia el tipo de campo (fútbol o rugby)
 */
function changeFieldType() {
    fieldType = fieldTypeSelect.value;
    
    // Actualizar clase CSS del campo
    fieldMap.className = `field-map ${fieldType}`;
    
    // Recalcular coberturas
    updateCoverageLayer();
}

/**
 * Cambia el tamaño del grid
 */
function changeGridSize() {
    const newSize = parseInt(gridSizeSelect.value);
    
    // Si hay aspersores colocados, confirmar antes de cambiar
    if (sprinklers.length > 0) {
        if (!confirm('Cambiar el tamaño del grid eliminará todos los aspersores colocados. ¿Desea continuar?')) {
            // Restaurar valor anterior
            gridSizeSelect.value = gridSize;
            return;
        }
        // Limpiar aspersores
        clearField();
    }
    
    // Actualizar tamaño
    gridSize = newSize;
    
    // Reinicializar grid
    initializeGrid();
}

/**
 * Cambia el tipo de aspersor seleccionado
 */
function changeSprinklerType() {
    sprinklerType = sprinklerTypeSelect.value;
    sprinklerRadius = parseInt(sprinklerTypeSelect.options[sprinklerTypeSelect.selectedIndex].dataset.radius);
}

/**
 * Coloca un aspersor en una posición del grid
 */
function placeSprinkler(row, col) {
    // Verificar si ya hay un aspersor en esa posición
    const existingSprinkler = sprinklers.find(s => s.row === row && s.col === col);
    
    if (existingSprinkler) {
        // Si ya existe, seleccionarlo para editar
        openEditModal(existingSprinkler);
        return;
    }
    
    // Crear nuevo aspersor
    const sprinkler = {
        id: sprinklerId++,
        name: `Aspersor ${sprinklerId - 1}`,
        type: sprinklerType,
        radius: sprinklerRadius,
        row: row,
        col: col,
        zone: 1, // Zona por defecto
        active: true
    };
    
    // Añadir al array
    sprinklers.push(sprinkler);
    
    // Actualizar visualización
    updateFieldVisualization();
    updateSprinklerList();
    updateStats();
}

/**
 * Actualiza la visualización del campo y los aspersores
 */
function updateFieldVisualization() {
    // Limpiar capas
    sprinklersLayer.innerHTML = '';
    
    // Actualizar coberturas
    updateCoverageLayer();
    
    // Colocar aspersores
    sprinklers.forEach(sprinkler => {
        // Calcular posición en píxeles
        const cellWidth = fieldMap.offsetWidth / gridSize;
        const cellHeight = fieldMap.offsetHeight / gridSize;
        
        const posX = (sprinkler.col + 0.5) * cellWidth;
        const posY = (sprinkler.row + 0.5) * cellHeight;
        
        // Crear elemento visual del aspersor
        const sprinklerElement = document.createElement('div');
        sprinklerElement.className = `sprinkler ${sprinkler.type}`;
        sprinklerElement.dataset.id = sprinkler.id;
        sprinklerElement.style.left = `${posX}px`;
        sprinklerElement.style.top = `${posY}px`;
        
        // Icono para el aspersor
        const icon = document.createElement('i');
        icon.className = 'fas fa-tint';
        sprinklerElement.appendChild(icon);
        
        // Event listener para editar
        sprinklerElement.addEventListener('click', () => {
            openEditModal(sprinkler);
        });
        
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
 * Actualiza la lista de aspersores en la tabla
 */
function updateSprinklerList() {
    // Limpiar lista
    sprinklerList.innerHTML = '';
    
    if (sprinklers.length === 0) {
        // Mostrar mensaje si no hay aspersores
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-message';
        emptyRow.innerHTML = '<td colspan="5">No hay aspersores colocados en el campo</td>';
        sprinklerList.appendChild(emptyRow);
        return;
    }
    
    // Crear filas para cada aspersor
    sprinklers.forEach(sprinkler => {
        const row = document.createElement('tr');
        
        // ID y nombre
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
        
        // Acciones
        const actionsCell = document.createElement('td');
        
        // Botón editar
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-sprinkler';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', () => openEditModal(sprinkler));
        actionsCell.appendChild(editBtn);
        
        // Botón eliminar
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-sprinkler';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`¿Está seguro de eliminar el aspersor #${sprinkler.id}?`)) {
                deleteSprinklerById(sprinkler.id);
            }
        });
        actionsCell.appendChild(deleteBtn);
        
        row.appendChild(actionsCell);
        
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
    // Esto es una aproximación simplificada
    calculateCoveragePercentage();
}

/**
 * Calcula el porcentaje de cobertura aproximado
 */
function calculateCoveragePercentage() {
    // Esta es una aproximación. En un sistema real, se debería
    // calcular con más precisión la superposición de áreas
    
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
 * Abre el modal para editar un aspersor
 */
function openEditModal(sprinkler) {
    selectedSprinkler = sprinkler;
    
    // Llenar el formulario con los datos del aspersor
    editSprinklerId.value = sprinkler.id;
    editSprinklerName.value = sprinkler.name;
    editSprinklerType.value = sprinkler.type;
    editSprinklerZone.value = sprinkler.zone;
    
    // Mostrar modal
    sprinklerModal.style.display = 'flex';
}

/**
 * Actualiza los datos de un aspersor
 */
function updateSprinkler() {
    if (!selectedSprinkler) return;
    
    // Actualizar datos
    selectedSprinkler.name = editSprinklerName.value;
    
    // Si el tipo cambió, actualizar radio
    if (selectedSprinkler.type !== editSprinklerType.value) {
        selectedSprinkler.type = editSprinklerType.value;
        
        // Actualizar radio basado en el tipo
        switch(selectedSprinkler.type) {
            case 'small':
                selectedSprinkler.radius = 1;
                break;
            case 'medium':
                selectedSprinkler.radius = 2;
                break;
            case 'large':
                selectedSprinkler.radius = 3;
                break;
        }
    }
    
    selectedSprinkler.zone = parseInt(editSprinklerZone.value);
    
    // Actualizar visualización
    updateFieldVisualization();
    updateSprinklerList();
    updateStats();
    
    // Cerrar modal
    sprinklerModal.style.display = 'none';
}

/**
 * Elimina un aspersor por su ID
 */
function deleteSprinklerById(id) {
    const index = sprinklers.findIndex(s => s.id === id);
    if (index !== -1) {
        sprinklers.splice(index, 1);
        
        // Actualizar visualización
        updateFieldVisualization();
        updateSprinklerList();
        updateStats();
    }
}

/**
 * Elimina el aspersor seleccionado
 */
function deleteSprinkler() {
    if (!selectedSprinkler) return;
    
    // Confirmar eliminación
    if (confirm(`¿Está seguro de eliminar el aspersor #${selectedSprinkler.id}?`)) {
        deleteSprinklerById(selectedSprinkler.id);
        
        // Cerrar modal
        sprinklerModal.style.display = 'none';
    }
}

/**
 * Guarda la configuración actual en localStorage
 */
function saveFieldConfiguration() {
    const configuration = {
        fieldType: fieldType,
        gridSize: gridSize,
        sprinklers: sprinklers,
        nextSprinklerId: sprinklerId
    };
    
    // Guardar en localStorage
    localStorage.setItem('aquaSync_fieldConfig', JSON.stringify(configuration));
    
    // También se podría enviar a un servidor mediante la API de Supabase
    // Para este ejemplo, usamos solo localStorage
    
    alert('Configuración guardada correctamente');
}

/**
 * Carga la configuración guardada
 */
function loadSavedConfiguration() {
    const savedConfig = localStorage.getItem('aquaSync_fieldConfig');
    
    if (!savedConfig) return;
    
    try {
        const config = JSON.parse(savedConfig);
        
        // Restaurar tipo de campo
        fieldType = config.fieldType;
        fieldTypeSelect.value = fieldType;
        fieldMap.className = `field-map ${fieldType}`;
        
        // Restaurar tamaño del grid
        gridSize = config.gridSize;
        gridSizeSelect.value = gridSize;
        
        // Restaurar aspersores
        sprinklers = config.sprinklers;
        sprinklerId = config.nextSprinklerId || (sprinklers.length + 1);
        
        // Actualizar visualización
        initializeGrid();
        updateSprinklerList();
        updateStats();
        
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
    }
}

/**
 * Limpia todos los aspersores del campo
 */
function clearField() {
    if (sprinklers.length === 0) return;
    
    if (confirm('¿Está seguro de eliminar todos los aspersores del campo?')) {
        sprinklers = [];
        updateFieldVisualization();
        updateSprinklerList();
        updateStats();
    }
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