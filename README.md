# 📌 Mimo Rewards — Estado del Proyecto & Hoja de Roadmap

Documento de sincronización técnica para desarrolladores. Resume los módulos operativos, la arquitectura actual y las tareas pendientes.

---

## 🛠️ Stack Tecnológico
- **Framework:** Next.js (App Router, Tailwind CSS, Lucide Icons)
- **Base de Datos & Auth:** Supabase (PostgreSQL)
- **Patrones:** Singleton client en Supabase, Optimistic UI en CRM, Server-side redirects

---

## ✅ Módulos Implementados & Funcionando

### 1. Dashboard de Métricas (`/admin/metricas`)
- **KPIs en tiempo real:** Conteo de clientes totales, sellos totales, visitas en los últimos 30 días y premios disponibles.
- **Gráfica semanal & Log reciente:** Renderizado de actividad dinámico a partir de la tabla `stamp_logs`.
- **Datos frescos:** Componente cliente optimizado con carga directa a Supabase y botón de refresco manual sin colisiones de caché.

### 2. Directorio & CRM de Clientes (`/admin/contactos`)
- **Buscador global:** Filtrado dinámico por código de cliente (`CLI-`), nombre o teléfono.
- **Sellado rápido:** Acción directa `+1 Sello Manual` con actualización optimista.
- **Modo Edición (Tuerca & Lápiz):**
  - Edición de nombre, teléfono y fecha de nacimiento (`birthdate`).
  - **Sincronización exacta de balance:** Si se incrementan o decrementan sellos manualmente, el sistema inserta o elimina selectivamente los IDs correspondientes en `stamp_logs` para evitar desfasajes en las métricas.
  - **Borrado en cascada:** Limpieza preventiva de logs asociados antes de borrar un cliente de la tabla `customers`.

### 3. Gestor UI de Automatizaciones (`/admin/automatizaciones`)
- **Panel visual:** Interfaz con tarjetas de KPIs y previsualización de mensajes en burbujas estilo chat.
- **Constructor de reglas:** Modal para crear y editar reglas con segmentación por evento (Cumpleaños, Inactividad, Nuevos registros, Meta alcanzada) y tags dinámicos (`{nombre}`, `{negocio}`, `{sellos_faltantes}`).
- **Pruebas en navegador:** Botón que arma el enlace de WhatsApp Web (`wa.me/?text=...`) con el texto interpolado para previsualizarlo manualmente.

### 4. Navegación & Base de Datos
- **Redirección de entrada:** La ruta `/admin` redirige automáticamente a `/admin/contactos`.
- **Permisos Supabase:** Row Level Security (RLS) configurado para permitir operaciones CRUD de sellos y auditoría sin bloqueos silenciosos.

---

## ⏳ Tareas Pendientes (Backlog)

### 1. Integración de Envío Real de WhatsApp (Backend)
- [ ] Conectar proveedor de mensajería (WhatsApp Cloud API / Twilio / Evolution API).
- [ ] Programar el CRON job / webhook que evalúe diariamente las condiciones (ej. cumpleaños o inactividad de 30 días).
- [ ] Ejecutar el envío automático en segundo plano y registrar la entrega real en `automation_logs`.

### 2. Interfaz de Caja & Canje de Recompensas (`/caja`)
- [ ] Detección visual en pantalla cuando un cliente alcanza la meta (ej. 10 sellos).
- [ ] Flujo de acción "Canjear Premio" (descuento de 10 sellos y reinicio de ciclo).
- [ ] Registro de auditoría del canje para alimentar el KPI de recompensas entregadas en métricas.

### 3. Configuración del Local (`/admin/ajustes`)
- [ ] Panel para actualizar nombre del comercio, logo y colores de marca.
- [ ] Configuración del objetivo de la tarjeta (personalizar meta de sellos y descripción del premio).

### 4. Centro de Mensajería & Conversaciones (`/admin/conversaciones`)
- [ ] Módulo para envíos manuales de mensajes directos por WhatsApp a clientes específicos o filtrados por segmento.

---

## 🚀 Puesta en Marcha Local
```bash
# Instalar dependencias
npm install

# Correr en desarrollo
npm run dev
```
