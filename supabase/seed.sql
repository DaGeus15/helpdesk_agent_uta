-- CodeAndes Academy — catálogo oficial (fuente: docs/CATALOGO.md)
-- Ejecutar después de migrations/001_init.sql. Idempotente.

insert into courses (id, name, level, duration_weeks, hours_per_week, price_usd, modality, start_date, schedules, syllabus, outcomes) values
('python-fundamentos', 'Fundamentos de Programación con Python', 'inicial', 8, 6, 180.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-09',
 '["Lun-Mié-Vie 19:00-21:00", "Sábados 08:00-14:00"]',
 '[{"module":1,"title":"Primeros pasos","topics":["instalación","variables","tipos de datos","entrada y salida"]},
   {"module":2,"title":"Control de flujo","topics":["condicionales","bucles","manejo de errores"]},
   {"module":3,"title":"Estructuras de datos y funciones","topics":["listas","diccionarios","tuplas","conjuntos","funciones","módulos"]},
   {"module":4,"title":"Programación orientada a objetos","topics":["clases","herencia","buenas prácticas"]},
   {"module":5,"title":"Proyecto final","topics":["automatización con archivos","consumo de APIs","Git y GitHub"]}]',
 'Escribes programas en Python, automatizas tareas y tienes la base para web, datos o IA. No requiere experiencia previa.'),

('fullstack-js', 'Desarrollo Web Full Stack (JavaScript, React y Node.js)', 'intermedio', 12, 8, 350.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-16',
 '["Mar-Jue 18:30-21:30 + Sábados 09:00-11:00", "Sábados 08:00-16:00"]',
 '[{"module":1,"title":"HTML5, CSS3 y diseño responsive","topics":["HTML5","CSS3","Tailwind"]},
   {"module":2,"title":"JavaScript moderno","topics":["ES6+","asincronía","fetch","DOM"]},
   {"module":3,"title":"React","topics":["componentes","hooks","estado","enrutamiento"]},
   {"module":4,"title":"Backend con Node.js y Express","topics":["APIs REST","autenticación JWT"]},
   {"module":5,"title":"Bases de datos","topics":["PostgreSQL","ORM Prisma"]},
   {"module":6,"title":"Proyecto final","topics":["aplicación full stack desplegada en la nube"]}]',
 'Construyes y despliegas aplicaciones web completas listas para portafolio. Requiere lógica de programación básica.'),

('ciencia-datos', 'Ciencia de Datos con Python', 'intermedio', 10, 6, 320.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-16',
 '["Lun-Mié 18:00-21:00", "Sábados 14:00-20:00"]',
 '[{"module":1,"title":"Python para datos","topics":["NumPy","pandas"]},
   {"module":2,"title":"Limpieza y transformación","topics":["datos reales","valores faltantes","transformaciones"]},
   {"module":3,"title":"Visualización","topics":["Matplotlib","Seaborn","Power BI"]},
   {"module":4,"title":"Estadística aplicada y SQL","topics":["estadística descriptiva e inferencial","SQL para análisis"]},
   {"module":5,"title":"Machine learning con scikit-learn","topics":["regresión","clasificación","clustering"]},
   {"module":6,"title":"Proyecto final","topics":["análisis de un dataset de una empresa local con dashboard"]}]',
 'Limpias, analizas y visualizas datos reales y construyes modelos predictivos. Requiere Python básico.'),

('ia-aplicada', 'Inteligencia Artificial Aplicada y LLMs', 'avanzado', 8, 6, 380.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-23',
 '["Mar-Jue 19:00-22:00", "Sábados 08:00-14:00"]',
 '[{"module":1,"title":"Redes neuronales y deep learning","topics":["fundamentos","entrenamiento"]},
   {"module":2,"title":"Modelos de lenguaje","topics":["LLMs","prompt engineering"]},
   {"module":3,"title":"APIs de LLMs","topics":["Gemini","OpenAI","Claude","salidas estructuradas"]},
   {"module":4,"title":"RAG","topics":["embeddings","bases vectoriales","búsqueda semántica"]},
   {"module":5,"title":"Agentes","topics":["herramientas","seguridad y prompt injection"]},
   {"module":6,"title":"Proyecto final","topics":["asistente inteligente desplegado"]}]',
 'Integras modelos de lenguaje en productos reales: chatbots, RAG y agentes. Requiere Python intermedio.'),

('ciberseguridad', 'Ciberseguridad Esencial', 'inicial', 8, 6, 290.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-09',
 '["Lun-Mié 19:00-22:00", "Sábados 14:00-20:00"]',
 '[{"module":1,"title":"Fundamentos de redes","topics":["TCP/IP","DNS","HTTP"]},
   {"module":2,"title":"Linux para seguridad","topics":["terminal","permisos","servicios"]},
   {"module":3,"title":"Amenazas y vulnerabilidades","topics":["OWASP Top 10","malware","ingeniería social"]},
   {"module":4,"title":"Hacking ético en laboratorio","topics":["reconocimiento","explotación básica"]},
   {"module":5,"title":"Defensa","topics":["firewalls","monitoreo","respuesta a incidentes","preparación Security+"]}]',
 'Proteges redes y aplicaciones y te preparas para CompTIA Security+. Nivel inicial-intermedio: basta con conocimientos básicos de computación.'),

('cloud-devops', 'Cloud y DevOps (AWS, Docker y CI/CD)', 'intermedio', 10, 6, 340.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-23',
 '["Mar-Jue 18:00-21:00", "Sábados 08:00-14:00"]',
 '[{"module":1,"title":"Linux, redes y Git para operaciones","topics":["Linux","redes","Git"]},
   {"module":2,"title":"Contenedores","topics":["Docker","Docker Compose"]},
   {"module":3,"title":"AWS","topics":["EC2","S3","RDS","IAM"]},
   {"module":4,"title":"CI/CD","topics":["GitHub Actions"]},
   {"module":5,"title":"Infraestructura como código","topics":["Terraform","monitoreo"]}]',
 'Despliegas y automatizas aplicaciones en la nube y te preparas para AWS Cloud Practitioner. Requiere manejo básico de Linux o programación.'),

('ux-ui-figma', 'Diseño UX/UI con Figma', 'inicial', 6, 5, 160.00, 'híbrida (presencial en Ambato + online en vivo)', '2026-11-09',
 '["Mar-Jue 19:00-21:30", "Sábados 09:00-14:00"]',
 '[{"module":1,"title":"Principios de UX","topics":["investigación con usuarios","personas"]},
   {"module":2,"title":"Arquitectura de información","topics":["flujos","wireframes"]},
   {"module":3,"title":"Diseño visual","topics":["tipografía","color","sistemas de diseño"]},
   {"module":4,"title":"Prototipado","topics":["prototipos interactivos en Figma","pruebas de usabilidad"]},
   {"module":5,"title":"Proyecto final","topics":["caso de estudio para portafolio"]}]',
 'Diseñas interfaces centradas en el usuario y prototipos navegables para portafolio. No requiere experiencia previa.')
on conflict (id) do update set
  name = excluded.name, level = excluded.level, duration_weeks = excluded.duration_weeks,
  hours_per_week = excluded.hours_per_week, price_usd = excluded.price_usd, modality = excluded.modality,
  start_date = excluded.start_date, schedules = excluded.schedules, syllabus = excluded.syllabus,
  outcomes = excluded.outcomes, active = true;

insert into promotions (id, title, description, discount_percent, applies_to, conditions, valid_until) values
('PRONTO15', 'Inscripción anticipada', '15 % de descuento en cualquier curso por inscribirte antes de la fecha límite.', 15, null,
 'Pagar la inscripción (al menos la primera cuota) antes de la fecha límite. No acumulable con COMBO20.', '2026-11-15'),
('COMBO20', 'Combo de dos cursos', '20 % de descuento en el curso de menor precio al inscribirte en dos cursos a la vez.', 20, null,
 'Inscribir dos cursos al mismo tiempo; el descuento aplica al de menor precio. No acumulable con PRONTO15.', '2026-11-30')
on conflict (id) do update set
  title = excluded.title, description = excluded.description, discount_percent = excluded.discount_percent,
  applies_to = excluded.applies_to, conditions = excluded.conditions, valid_until = excluded.valid_until, active = true;
