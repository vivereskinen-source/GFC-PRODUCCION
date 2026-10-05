# GFC Manager v1.3.2 — corrección de estabilidad

Corrección crítica de arranque y persistencia de datos.

- Corrige el orden de inicialización que podía impedir que la aplicación arrancara o hacer que una base existente se interpretara como vacía al recargar.
- Mantiene la misma clave de base de datos (`gfc_produccion_db_v1`) para conservar compatibilidad.
- Conserva respaldo local automático (`gfc_produccion_db_v1_backup`) y validación de escritura.
- Mantiene materias primas en Ventas con selección para incluir/excluir en la lista de precios.
- Actualiza la caché PWA a v1.3.2.

Antes de uso real, validar persistencia con datos ficticios: guardar, F5, cerrar pestaña y volver a abrir.
