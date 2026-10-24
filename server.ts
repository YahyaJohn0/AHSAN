import { startServer } from './backend/server.ts';

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
