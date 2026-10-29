# Reto Oficial Hackathon 2026 — Ecosistema Multi-Agente para Ventas y Gestión Conversacional

Universidad Técnica de Ambato · FISEI · Edición Especial Ambato Meetup
29 de octubre, 08:00 · Auditorio 1 Fac. Adm. · Aliados: SpaceX, GDG Quito, Supabase

## 1. Problema

Un centro de capacitación tecnológica recibe consultas de prospectos a cualquier hora (madrugadas, fines de semana, feriados). Responder tarde o usar bots rígidos de menús baja la conversión y genera fricción.

**Objetivo:** un modelo híbrido autónomo–humano que responda y persuada con naturalidad conversacional, respaldado por un panel de mando reactivo que permita a un operador humano intervenir en tiempo real.

## 2. Componentes

### Módulo A — Canal conversacional: agente de atención (Telegram)
- Agente impulsado por LLM.
- Perfila prospectos, resuelve dudas técnicas del pénsum de cursos, argumenta ante objeciones comerciales y canaliza la inscripción con tono empático, no robótico.

### Módulo B — Supervisión y handover: panel de mando (dashboard web)
- Interfaz web en tiempo real con las interacciones activas concurrentes.
- El operador audita métricas e interviene de inmediato en el hilo sin romper la experiencia del usuario.

## 3. Requisitos críticos y casos de borde

1. **Transición transparente (seamless handover):** al detectar frustración del cliente o recibir intervención directa del operador, la IA pausa su inferencia automáticamente. Los mensajes del administrador salen por Telegram bajo la misma identidad del bot.
2. **Termómetro de interacción en tiempo real:** clasificación semántica del estado del prospecto (interesado, dudoso, frustrado o lead caliente) visible al instante en las tarjetas de chat con indicadores sutiles.
3. **Resiliencia y seguridad (prompt injection):** defensa sólida contra intentos de obtener cursos gratis, forzar descuentos no autorizados o alterar las directrices del centro.

## 4. Entregables obligatorios

1. Bot de Telegram en vivo, desplegado y accesible para que el jurado lo pruebe.
2. URL del dashboard web funcional, reactivo y sin problemas de CORS.
3. Repositorio con código limpio, configuración de variables de entorno y guía de despliegue.

## 5. Rúbrica (100 puntos)

| Criterio | Qué evalúan | Pts |
|---|---|---|
| **A. Comportamiento y lógica del agente** | | **30** |
| Persuasión y tono humano | Lenguaje natural y adaptable; nada de respuestas tipo catálogo; promueve el valor académico del pénsum | 10 |
| Intención y derivación oportuna | Sabe cuándo cerrar la inscripción o transferir a un docente/asesor humano | 10 |
| Resiliencia ante casos de borde e inyecciones | Tolera faltas de ortografía, giros de tema, jailbreaks y pedidos de descuento indebidos | 10 |
| **B. Panel de control web e intervención humana** | | **30** |
| Sincronización bidireccional en tiempo real | WebSockets o SSE, sin recargar la pantalla | 10 |
| Handover y pausa de IA | Congelar la inferencia al intervenir y reanudar de forma clara y sin fricción | 10 |
| Diseño UI/UX y visibilidad del estado | Claridad visual, termómetro de intención, ergonomía con múltiples chats concurrentes | 10 |
| **C. Arquitectura, integración y eficiencia** | | **20** |
| Diseño modular y separación de capas | Conectores de mensajería, pipeline de inferencia y persistencia bien separados | 10 |
| Gestión de tokens y ventana de contexto | Prompt estructurado e historial conciso para optimizar latencia y consumo | 10 |
| **D. Innovación, valor agregado y sustentación** | | **20** |
| Funcionalidades complementarias | Transcripción de audio, resúmenes automáticos para el operador, métricas analíticas | 10 |
| Sustentación y demo en vivo | Claridad ante preguntas del jurado y estabilidad durante las pruebas | 10 |
