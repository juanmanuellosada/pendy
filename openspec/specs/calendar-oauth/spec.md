# calendar-oauth Specification

## Purpose

Define el flujo de autorización OAuth 2.0 con PKCE (Google) para conectar integraciones de calendario, incluyendo el comportamiento diferenciado por plataforma (redirect de página completa en web vs. servidor HTTP de loopback en la build de escritorio), la protección CSRF mediante `state` aleatorio, y el manejo de errores del flujo de escritorio.

## Requirements

### Requirement: Autorización OAuth de calendario con PKCE

El sistema SHALL iniciar la conexión de un calendario de Google mediante OAuth 2.0 con PKCE (método `S256`), generando un `code_verifier` aleatorio por cada intento y derivando el `code_challenge` correspondiente. El `code_verifier` MUST conservarse hasta el intercambio de código.

#### Scenario: Inicio de conexión

- **WHEN** el usuario inicia la conexión de Google Calendar
- **THEN** el sistema genera un par PKCE, persiste el `code_verifier` para el intercambio posterior y abre la pantalla de consentimiento de Google con el `code_challenge`

### Requirement: Protección CSRF con `state` aleatorio

El sistema SHALL generar un valor `state` criptográficamente aleatorio por cada intento de conexión (distinto entre intentos), incluirlo en la URL de autorización de Google, almacenarlo en `sessionStorage` y validarlo al recibir el callback. Si el `state` devuelto no coincide con el almacenado, el sistema MUST abortar el intercambio y mostrar un error. El valor almacenado MUST eliminarse de `sessionStorage` tras el uso (ya sea exitoso o fallido).

#### Scenario: Validación exitosa del state

- **WHEN** Google devuelve `?code=...&state=<valor>` y el valor coincide con el almacenado en `sessionStorage`
- **THEN** el sistema acepta el code y procede al intercambio

#### Scenario: Mismatch de state (CSRF)

- **WHEN** Google devuelve `?code=...&state=<valor>` y el valor NO coincide con el almacenado en `sessionStorage`
- **THEN** el sistema descarta el code, limpia `sessionStorage`, y reporta un error de seguridad al usuario sin realizar el intercambio

### Requirement: Flujo de autorización en la plataforma web

En la plataforma web, el sistema SHALL usar un redirect de página completa hacia la pantalla de consentimiento de Google y SHALL capturar el `code` de autorización desde los parámetros de la URL de retorno, validando el `state` contra `sessionStorage`.

#### Scenario: Retorno del consentimiento en web

- **WHEN** Google redirige de vuelta a la app web con `?code=...&state=<valor_aleatorio>` y el `state` coincide con el valor en `sessionStorage`
- **THEN** el sistema captura el `code`, limpia la URL del navegador y dispara el intercambio de código

### Requirement: Flujo de autorización loopback en la plataforma de escritorio

En la build de escritorio (Tauri), el sistema SHALL completar la autorización mediante un servidor HTTP de loopback en `http://127.0.0.1:8765` que actúa como `redirect_uri`, abriendo la pantalla de consentimiento en el navegador del sistema. El sistema MUST NOT usar `window.location.origin` para construir el `redirect_uri` en escritorio.

#### Scenario: Conexión exitosa en escritorio

- **WHEN** el usuario inicia la conexión de Google Calendar en la app de escritorio
- **THEN** el sistema arranca un servidor loopback en `127.0.0.1:8765`, abre el navegador del sistema en la pantalla de consentimiento de Google, recibe el `code` en la request de retorno, valida el `state` aleatorio y dispara el intercambio de código

#### Scenario: Segundo intento concurrente rechazado

- **WHEN** el usuario hace click en "conectar" mientras ya hay una conexión OAuth en curso en escritorio
- **THEN** el sistema rechaza el segundo intento inmediatamente con un mensaje de error legible, sin intentar bindear el puerto, y la primera conexión en curso continúa sin interferencia

#### Scenario: El esquema tauri:// nunca se envía a Google

- **WHEN** se construye la URL de autorización de Google en la app de escritorio
- **THEN** el `redirect_uri` es `http://127.0.0.1:8765` y nunca un esquema `tauri://` o `file://`

### Requirement: Coherencia del redirect_uri entre autorización e intercambio

El `redirect_uri` enviado en la URL de autorización de Google MUST ser idéntico al `redirect_uri` enviado en la petición de intercambio de código a la Edge Function, en ambas plataformas.

#### Scenario: redirect_uri coincidente en escritorio

- **WHEN** se realiza el intercambio de código en la app de escritorio
- **THEN** el `redirect_uri` del cuerpo de la petición es `http://127.0.0.1:8765`, idéntico al usado en la URL de autorización

#### Scenario: redirect_uri coincidente en web

- **WHEN** se realiza el intercambio de código en la app web
- **THEN** el `redirect_uri` del cuerpo de la petición es la URL de retorno de la app web, idéntica a la usada en la URL de autorización

### Requirement: Manejo de errores del flujo de escritorio

El flujo de loopback de escritorio SHALL reportar de forma legible los fallos al usuario sin dejar recursos colgados.

#### Scenario: Puerto de loopback ocupado

- **WHEN** el puerto `8765` ya está en uso al iniciar la conexión en escritorio
- **THEN** el sistema aborta la conexión y muestra un mensaje de error indicando que el puerto está ocupado

#### Scenario: Consentimiento no completado

- **WHEN** el usuario no completa el consentimiento dentro del tiempo de espera del servidor loopback
- **THEN** el servidor loopback expira y se libera, y el sistema reporta que la conexión no se completó
