import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/upload/image - Upload image (defect photos, meter photos, signatures)
   */
  fastify.post(
    '/api/upload/image',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Starting image upload');

      try {
        const data = await request.file();
        if (!data) {
          app.logger.warn({ userId: session.user.id }, 'No file provided in upload request');
          return reply.status(400).send({ error: 'No file provided' });
        }

        const buffer = await data.toBuffer();
        const timestamp = Date.now();
        const userId = session.user.id;
        const key = `uploads/${userId}/${timestamp}-${data.filename}`;

        app.logger.info(
          { userId, filename: data.filename, size: buffer.length },
          'Uploading file to storage'
        );

        const uploadedKey = await app.storage.upload(key, buffer);

        app.logger.info(
          { userId, key: uploadedKey, size: buffer.length },
          'File uploaded successfully'
        );

        // Generate a signed URL for client access
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        return {
          url,
          filename: data.filename,
          key: uploadedKey,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to upload image'
        );
        throw error;
      }
    }
  );
}
