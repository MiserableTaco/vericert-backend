import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { verifyRoutes } from './routes/verify.js';

const fastify = Fastify({
  logger: true,
  bodyLimit: 52428800 // 50MB max
});

// CORS - allow frontend
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true
});

// Rate limiting - essential for public endpoint
await fastify.register(rateLimit, {
  max: 10, // 10 requests
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please wait before verifying another document.'
  })
});

// Multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 52428800, // 50MB max
    files: 1 // Only 1 file at a time
  }
});

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'ok',
    service: 'VeriCert',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
});

// Verification routes
await fastify.register(verifyRoutes, { prefix: '/api' });

// Start server
const PORT = parseInt(process.env.PORT || '3003', 10);

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🔍 VeriCert backend running on http://localhost:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
