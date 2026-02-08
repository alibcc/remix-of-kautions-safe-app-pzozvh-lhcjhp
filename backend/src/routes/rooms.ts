import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/inspections/:inspectionId/rooms - Add room to inspection
   */
  fastify.post<{
    Params: { inspectionId: string };
    Body: {
      roomName: string;
      condition: 'ok' | 'defect';
      defectDescription?: string;
      defectPhotoUrl?: string;
      sortOrder?: number;
    };
  }>(
    '/api/inspections/:inspectionId/rooms',
    async (
      request: FastifyRequest<{
        Params: { inspectionId: string };
        Body: {
          roomName: string;
          condition: 'ok' | 'defect';
          defectDescription?: string;
          defectPhotoUrl?: string;
          sortOrder?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { inspectionId } = request.params;
      const { roomName, condition, defectDescription, defectPhotoUrl, sortOrder } = request.body;

      app.logger.info(
        { inspectionId, roomName, condition, userId: session.user.id },
        'Adding room to inspection'
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

        const room = await app.db
          .insert(schema.rooms)
          .values({
            inspectionId,
            roomName,
            condition,
            defectDescription: condition === 'defect' ? defectDescription : null,
            defectPhotoUrl: condition === 'defect' ? defectPhotoUrl : null,
            sortOrder: sortOrder ?? 0,
          })
          .returning();

        app.logger.info(
          { roomId: room[0].id, inspectionId, roomName },
          'Room added successfully'
        );

        return room[0];
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId, roomName, userId: session.user.id },
          'Failed to add room'
        );
        throw error;
      }
    }
  );

  /**
   * PUT /api/rooms/:id - Update room
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      roomName?: string;
      condition?: 'ok' | 'defect';
      defectDescription?: string;
      defectPhotoUrl?: string;
      sortOrder?: number;
    };
  }>(
    '/api/rooms/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          roomName?: string;
          condition?: 'ok' | 'defect';
          defectDescription?: string;
          defectPhotoUrl?: string;
          sortOrder?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const updateData = request.body;

      app.logger.info({ roomId: id, userId: session.user.id }, 'Updating room');

      try {
        const room = await app.db.query.rooms.findFirst({
          where: eq(schema.rooms.id, id),
        });

        if (!room) {
          app.logger.warn({ roomId: id }, 'Room not found');
          return reply.status(404).send({ error: 'Room not found' });
        }

        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, room.inspectionId),
        });

        if (!inspection || inspection.userId !== session.user.id) {
          app.logger.warn(
            { roomId: id, userId: session.user.id },
            'Unauthorized update to room'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const updated = await app.db
          .update(schema.rooms)
          .set(updateData)
          .where(eq(schema.rooms.id, id))
          .returning();

        app.logger.info(
          { roomId: id, roomName: updated[0].roomName },
          'Room updated successfully'
        );

        return updated[0];
      } catch (error) {
        app.logger.error(
          { err: error, roomId: id, userId: session.user.id },
          'Failed to update room'
        );
        throw error;
      }
    }
  );

  /**
   * DELETE /api/rooms/:id - Delete room
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/api/rooms/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info({ roomId: id, userId: session.user.id }, 'Deleting room');

      try {
        const room = await app.db.query.rooms.findFirst({
          where: eq(schema.rooms.id, id),
        });

        if (!room) {
          app.logger.warn({ roomId: id }, 'Room not found');
          return reply.status(404).send({ error: 'Room not found' });
        }

        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, room.inspectionId),
        });

        if (!inspection || inspection.userId !== session.user.id) {
          app.logger.warn(
            { roomId: id, userId: session.user.id },
            'Unauthorized deletion of room'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        await app.db.delete(schema.rooms).where(eq(schema.rooms.id, id));

        app.logger.info({ roomId: id }, 'Room deleted successfully');

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, roomId: id, userId: session.user.id },
          'Failed to delete room'
        );
        throw error;
      }
    }
  );
}
