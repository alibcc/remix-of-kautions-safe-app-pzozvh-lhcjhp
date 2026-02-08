import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';

// Import route registration functions
import { register as registerInspectionsRoutes } from './routes/inspections.js';
import { register as registerRoomsRoutes } from './routes/rooms.js';
import { register as registerMetersRoutes } from './routes/meters.js';
import { register as registerUploadRoutes } from './routes/upload.js';
import { register as registerPdfRoutes } from './routes/pdf.js';

// Combine schemas for database initialization
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication and storage
app.withAuth();
app.withStorage();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerInspectionsRoutes(app, app.fastify);
registerRoomsRoutes(app, app.fastify);
registerMetersRoutes(app, app.fastify);
registerUploadRoutes(app, app.fastify);
registerPdfRoutes(app, app.fastify);

await app.run();
app.logger.info('Application running');
