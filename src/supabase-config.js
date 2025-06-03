// supabase-config.js
const SUPABASE_URL = 'https://fqauhrsdburhobgllhyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxYXVocnNkYnVyaG9iZ2xsaHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NDIyOTIsImV4cCI6MjA2MjMxODI5Mn0.9iu9D8MbHk5IFjd6S_p8YV9AKhqdHLDapsh2s4syUCE';

// Variable global para el cliente
let supabase;

// Función para inicializar Supabase
function initSupabase() {
    try {
        console.log('Inicializando cliente de Supabase...');
        
        // Verifica que la biblioteca supabase esté cargada
        if (typeof window.supabase === 'undefined') {
            console.error('Error: La biblioteca de Supabase no está disponible');
            return false;
        }
        
        // Crea el cliente de Supabase y lo asigna a la variable global
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // También lo asigna a window para compatibilidad
        window.supabaseClient = supabase;
        
        console.log('Cliente de Supabase inicializado correctamente');
        return true;
    } catch (error) {
        console.error('Error al inicializar Supabase:', error);
        return false;
    }
}

// Función para esperar a que Supabase esté listo
function waitForSupabase() {
    return new Promise((resolve) => {
        if (supabase) {
            resolve(true);
            return;
        }
        
        const checkSupabase = () => {
            if (typeof window.supabase !== 'undefined') {
                initSupabase();
                resolve(true);
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        
        checkSupabase();
    });
}

// Inicializar cuando la página esté lista
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initSupabase, 100); // Pequeño delay para asegurar que supabase esté cargado
    });
} else {
    setTimeout(initSupabase, 100);
}