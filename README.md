# AquaSync - Sistema de Riego Inteligente

<div align="center">
  <img src="https://img.shields.io/badge/Status-Activo-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</div>

## 📋 Descripción

AquaSync es un sistema de riego automatizado y zonificado diseñado para canchas deportivas con césped natural. El proyecto combina una plataforma web intuitiva con hardware especializado para optimizar el uso del agua y mejorar la eficiencia en la irrigación según las características específicas de cada zona del campo.

## 🎯 Características Principales

- **🗺️ Irrigación Zonificada**: Control independiente por zonas según necesidades específicas
- **📱 Plataforma Web Multiplataforma**: Acceso desde cualquier dispositivo (móvil, tablet, PC)
- **🌡️ Sensores en Tiempo Real**: Monitoreo de humedad del suelo en diferentes profundidades
- **🌤️ Integración Climática**: Datos meteorológicos y pronósticos para optimizar riegos
- **📅 Programación Inteligente**: Coordinación con calendario deportivo y eventos
- **💧 Recolección de Agua de Lluvia**: Sistema sustentable de aprovechamiento pluvial
- **📊 Historial y Estadísticas**: Seguimiento completo de consumo y rendimiento

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Frontend Web      │    │    Base de Datos    │    │     Hardware        │
│   (HTML/CSS/JS)     │◄──►│     (Supabase)      │◄──►│     (ESP32)         │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5, CSS3, JavaScript**: Desarrollo de la interfaz web
- **Font Awesome**: Iconografía
- **Diseño Responsivo**: Compatible con todos los dispositivos

### Backend y Base de Datos
- **Supabase**: Backend as a Service para base de datos y autenticación
- **PostgreSQL**: Base de datos relacional

### Hardware
- **ESP32**: Microcontrolador principal
- **C++**: Programación del microcontrolador
- **WiFi.h, HTTPClient.h, ArduinoJson**: Librerías para conectividad

### Componentes Físicos
- Sensores de humedad del suelo
- Electroválvulas
- Aspersores
- Relés
- Micro bomba de agua
- Sistema de mangueras

## 📂 Estructura del Proyecto

```
AQUASYNC/
├── pages/
│   ├── alerts.html          # Página de alertas
│   ├── programming.html     # Programación de riegos
│   ├── statistics.html      # Estadísticas y reportes
│   └── zones.html           # Gestión de zonas
├── src/
│   ├── app.js              # Lógica principal de la aplicación
│   ├── field-mapping.js    # Mapeo de campo y zonas
│   ├── programming.js      # Funciones de programación
│   ├── supabase-config.js  # Configuración de Supabase
│   └── timer.js            # Gestión de temporizadores
├── styles/
│   ├── alerts.css          # Estilos para alertas
│   ├── programming.css     # Estilos para programación
│   ├── statistics.css      # Estilos para estadísticas
│   ├── style.css           # Estilos principales
│   ├── timer.css           # Estilos para temporizadores
│   └── zones.css           # Estilos para zonas
├── index.html              # Página principal (Dashboard)
└── README.md               # Este archivo
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Navegador web moderno
- Conexión a internet
- Cuenta en Supabase (para desarrollo)

### Configuración
1. **Clona el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/aquasync.git
   cd aquasync
   ```

2. **Configura Supabase**
   - Edita `src/supabase-config.js`
   - Actualiza las credenciales de tu proyecto Supabase:
   ```javascript
   const SUPABASE_URL = 'tu-url-de-supabase';
   const SUPABASE_KEY = 'tu-clave-de-supabase';
   ```

3. **Ejecuta el proyecto**
   - Abre `index.html` en tu navegador
   - O utiliza un servidor local como Live Server en VS Code

## 💻 Uso del Sistema

### Dashboard Principal
- **Estado del Sistema**: Monitoreo en tiempo real
- **Clima Actual**: Información meteorológica actualizada
- **Próximos Riegos**: Programaciones pendientes
- **Control de Zonas**: Gestión individual por zona

### Programación de Riegos
- Crear programaciones automáticas
- Configurar horarios y duraciones
- Asignar zonas específicas

### Gestión de Zonas
- Agregar nuevas zonas de riego
- Vista de la ubicación del aspersor

### Estadísticas
- Consumo de agua histórico
- Eficiencia del sistema
- Reportes de rendimiento

### Alertas 
- Notificaciones del sistema 

## 🔧 Configuración de Hardware

El sistema incluye una maqueta funcional con:
- **ESP32** como controlador principal
- **Sensores de humedad** en diferentes profundidades
- **Electroválvulas** para control de flujo
- **Sistema de aspersores** zonificado
- **Bomba de agua** para presión
- **Relés** para activación de dispositivos

## 🌟 Ventajas Competitivas

- **Zonificación Real**: No trata el campo como unidad uniforme
- **Control Inteligente**: Reacciona a condiciones reales del terreno
- **Accesibilidad**: No requiere conocimientos técnicos para operar
- **Escalabilidad**: Fácil expansión a más zonas o canchas
- **Sustentabilidad**: Aprovechamiento de agua de lluvia
- **Integración Completa**: Software y hardware diseñados en conjunto

## 📊 Resultados Obtenidos

- ✅ Riego zonificado funcionando correctamente
- ✅ Interfaz web operativa en múltiples dispositivos
- ✅ Lectura en tiempo real de sensores de humedad
- ✅ Activación automática y manual de aspersores
- ✅ Historial completo de eventos y consumo
- ✅ Arquitectura modular y escalable validada

## 🔮 Mejoras Futuras

- **Inteligencia Artificial**: Optimización predictiva de riegos
- **App Móvil Nativa**: Aplicación dedicada con notificaciones
- **Más Sensores**: Control de fertilización y salud del césped
- **Multiusuario**: Diferentes niveles de acceso por roles
- **IoT Avanzado**: Integración con más dispositivos inteligentes

## 👥 Equipo de Desarrollo

**Autores**: Candela Molinari, Máximo Mayorga

**Institución**: Escuela de Educación Secundaria Técnica N.º 1 de Vicente López "Eduardo Ader"

**Supervisores**: Paula Balda, York Mansilla Muñoz

**Proyecto**: Actividades Científicas y Tecnológicas Educativas (ACTE) - Región 6

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Contacto

Para más información sobre el proyecto, puedes contactarnos a través de:
- **Email**: [candemolinari20@gmail.com]
- **GitHub**: [Candex22]

---

<div align="center">
  <p><strong>AquaSync</strong> - Innovación en Sistemas de Riego Inteligente</p>
  <p>Desarrollado con ❤️ por estudiantes de la EEST N°1 Vicente López</p>
</div>
