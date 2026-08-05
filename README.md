# GFC Producción

Aplicación web progresiva (PWA) para:

- Registrar materias primas y precios por kilogramo.
- Crear fórmulas en kilogramos o porcentajes.
- Calcular cantidades según el peso final deseado.
- Calcular costo total y costo por kilogramo.
- Registrar lotes con fórmula, precios y costos congelados.
- Conservar historial cerrado desde la interfaz.
- Exportar un respaldo JSON.

## Cómo probarla

Necesita servirse desde un servidor web, no abrirse directamente como archivo.

Una opción rápida en computadora:

```bash
python3 -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Cómo instalarla en iPhone

1. Publica la carpeta en un hosting HTTPS, por ejemplo GitHub Pages, Netlify o Vercel.
2. Abre el enlace en Safari.
3. Pulsa Compartir.
4. Selecciona “Agregar a pantalla de inicio”.

## Importante

Los datos se guardan localmente en el navegador del dispositivo. Conviene usar “Exportar respaldo” con frecuencia.
Para uso multiusuario o respaldo en la nube se necesita una segunda versión con base de datos y autenticación.
