# Module Management - React Client

This is the React frontend application for the Module Management system.

## Setup

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm run dev
```

The React app will run on `http://localhost:3000` and proxy API requests to `http://localhost:5287`.

Make sure the ASP.NET Core backend is running on port 5287.

## Build

Build for production:
```bash
npm run build
```

This will build the React app and output the files to `../wwwroot` directory, which will be served by the ASP.NET Core application.

## Project Structure

- `src/components/` - Reusable React components
- `src/pages/` - Page components (ModulesPage, ModuleFieldsPage, ModuleRecordsPage)
- `src/services/` - API service functions
- `src/App.jsx` - Main app component with routing
- `src/index.js` - Entry point

