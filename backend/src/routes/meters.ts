import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/inspections/:inspectionId/meters - Add meter reading
   */
  fastify.post<{
    Params: { inspectionId: string };
    Body: {
      meterType: string;
      meterNumber: string;
      reading: string;
      photoUrl?: string;
    };
  }>(
    '/api/inspections/:inspectionId/meters',
    async (
      request: FastifyRequest<{
        Params: { inspectionId: string };
        Body: {
          meterType: string;
          meterNumber: string;
          reading: string;
          photoUrl?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { inspectionId } = request.params;
      const { meterType, meterNumber, reading, photoUrl } = request.body;

      app.logger.info(
        { inspectionId, meterType, meterNumber, userId: session.user.id },
        'Adding meter reading'
      );

      try {
        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, inspectionId),
        });

        if (!inspection) {
          app.logger.warn({ inspectionId }, 'Inspection not found');
          return reply.status(404).send({ error: 'Inspection not found' });
        }

        if (inspection.userId !== session.user.id) {
          app.logger.warn(
            { inspectionId, userId: session.user.id },
            'Unauthorized access to inspection'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const meter = await app.db
          .insert(schema.meters)
          .values({
            inspectionId,
            meterType,
            meterNumber,
            reading,
            photoUrl: photoUrl || null,
          })
          .returning();

        app.logger.info(
          { meterId: meter[0].id, inspectionId, meterType },
          'Meter reading added successfully'
        );

        return meter[0];
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId, meterType, userId: session.user.id },
          'Failed to add meter reading'
        );
        throw error;
      }
    }
  );

  /**
   * PUT /api/meters/:id - Update meter
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      meterType?: string;
      meterNumber?: string;
      reading?: string;
      photoUrl?: string;
    };
  }>(
    '/api/meters/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          meterType?: string;
          meterNumber?: string;
          reading?: string;
          photoUrl?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const updateData = request.body;

      app.logger.info({ meterId: id, userId: session.user.id }, 'Updating meter');

      try {
        const meter = await app.db.query.meters.findFirst({
          where: eq(schema.meters.id, id),
        });

        if (!meter) {
          app.logger.warn({ meterId: id }, 'Meter not found');
          return reply.status(404).send({ error: 'Meter not found' });
        }

        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, meter.inspectionId),
        });

        if (!inspection || inspection.userId !== session.user.id) {
          app.logger.warn(
            { meterId: id, userId: session.user.id },
            'Unauthorized update to meter'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const updated = await app.db
          .update(schema.meters)
          .set(updateData)
          .where(eq(schema.meters.id, id))
          .returning();

        app.logger.info(
          { meterId: id, meterType: updated[0].meterType },
          'Meter updated successfully'
        );

        return updated[0];
      } catch (error) {
        app.logger.error(
          { err: error, meterId: id, userId: session.user.id },
          'Failed to update meter'
        );
        throw error;
      }
    }
  );

  /**
   * DELETE /api/meters/:id - Delete meter
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/api/meters/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info({ meterId: id, userId: session.user.id }, 'Deleting meter');

      try {
        const meter = await app.db.query.meters.findFirst({
          where: eq(schema.meters.id, id),
        });

        if (!meter) {
          app.logger.warn({ meterId: id }, 'Meter not found');
          return reply.status(404).send({ error: 'Meter not found' });
        }

        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, meter.inspectionId),
        });

        if (!inspection || inspection.userId !== session.user.id) {
          app.logger.warn(
            { meterId: id, userId: session.user.id },
            'Unauthorized deletion of meter'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        await app.db.delete(schema.meters).where(eq(schema.meters.id, id));

        app.logger.info({ meterId: id }, 'Meter deleted successfully');

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, meterId: id, userId: session.user.id },
          'Failed to delete meter'
        );
        throw error;
      }
    }
  );
}
