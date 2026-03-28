# PadelQ - Plataforma de Gestión de Club de Pádel

Esta es una plataforma integral diseñada con una arquitectura moderna y escalable.

## Estructura del Proyecto

- **Backend (.NET 8/9)**: Núcleo del sistema, API REST y persistencia de datos.
  - `/PadelQ.Domain`: Entidades de negocio y lógica pura.
  - `/PadelQ.Application`: Casos de uso y mediadores.
  - `/PadelQ.Infrastructure`: Repositorios y servicios externos.
  - `/PadelQ.Api`: Punto de entrada RESTful.
- **Web Admin (React)**: Panel administrativo para la gestión del club.
  - `/PadelQ.AdminWeb`: Frontend SPA con React y Tailwind CSS.
- **Mobile App (Flutter)**: Aplicación móvil para clientes.
  - `/PadelQ.MobileApp`: App multiplataforma (iOS/Android).

## Prerrequisitos

- [.NET SDK 8 or 9](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (Para el Panel Web)
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (Para la App Móvil)
- [SQL Server](https://www.microsoft.com/sql-server)

## Cómo empezar

1. **Backend**:
   ```bash
   cd PadelQ.Api
   dotnet run
   ```
2. **Web Admin**:
   ```bash
   cd PadelQ.AdminWeb
   npm install
   npm run dev
   ```
3. **Mobile App**:
   ```bash
   cd PadelQ.MobileApp
   flutter pub get
   flutter run
   ```
