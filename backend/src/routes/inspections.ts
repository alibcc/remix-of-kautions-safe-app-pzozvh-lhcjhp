import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/inspections - Create new inspection
   */
  fastify.post<{
    Body: {
      propertyAddress: string;
      inspectionType: 'move_in' | 'move_out';
      landlordName?: string;
      tenantName?: string;
    };
  }>(
    '/api/inspections',
    async (
      request: FastifyRequest<{
        Body: {
          propertyAddress: string;
          inspectionType: 'move_in' | 'move_out';
          landlordName?: string;
          tenantName?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { propertyAddress, inspectionType, landlordName, tenantName } = request.body;

      app.logger.info(
        { propertyAddress, inspectionType, userId: session.user.id },
        'Creating inspection'
      );

      try {
        const inspection = await app.db
          .insert(schema.inspections)
          .values({
            userId: session.user.id,
            propertyAddress,
            inspectionType,
            landlordName,
            tenantName,
            status: 'draft',
          })
          .returning();

        app.logger.info(
          { inspectionId: inspection[0].id, propertyAddress },
          'Inspection created successfully'
        );

        return inspection[0];
      } catch (error) {
        app.logger.error(
          { err: error, propertyAddress, inspectionType },
          'Failed to create inspection'
        );
        throw error;
      }
    }
  );

  /**
   * GET /api/inspections - Get all inspections for authenticated user
   */
  fastify.get('/api/inspections', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching inspections');

    try {
      const inspections = await app.db.query.inspections.findMany({
        where: eq(schema.inspections.userId, session.user.id),
      });

      // Add room and meter counts for each inspection
      const inspectionsWithCounts = await Promise.all(
        inspections.map(async (inspection) => {
          const roomCount = await app.db
            .select()
            .from(schema.rooms)
            .where(eq(schema.rooms.inspectionId, inspection.id));

          const meterCount = await app.db
            .select()
            .from(schema.meters)
            .where(eq(schema.meters.inspectionId, inspection.id));

          return {
            ...inspection,
            roomCount: roomCount.length,
            meterCount: meterCount.length,
          };
        })
      );

      app.logger.info(
        { userId: session.user.id, count: inspectionsWithCounts.length },
        'Inspections fetched successfully'
      );

      return inspectionsWithCounts;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id },
        'Failed to fetch inspections'
      );
      throw error;
    }
  });

  /**
   * GET /api/inspections/:id - Get single inspection with all rooms and meters
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/api/inspections/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info(
        { inspectionId: id, userId: session.user.id },
        'Fetching inspection details'
      );

      try {
        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, id),
        });

        if (!inspection) {
          app.logger.warn({ inspectionId: id }, 'Inspection not found');
          return reply.status(404).send({ error: 'Inspection not found' });
        }

        if (inspection.userId !== session.user.id) {
          app.logger.warn(
            { inspectionId: id, userId: session.user.id, ownerId: inspection.userId },
            'Unauthorized access to inspection'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const rooms = await app.db.query.rooms.findMany({
          where: eq(schema.rooms.inspectionId, id),
        });

        const meters = await app.db.query.meters.findMany({
          where: eq(schema.meters.inspectionId, id),
        });

        const result = {
          ...inspection,
          rooms,
          meters,
        };

        app.logger.info(
          { inspectionId: id, roomCount: rooms.length, meterCount: meters.length },
          'Inspection details fetched successfully'
        );

        return result;
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId: id, userId: session.user.id },
          'Failed to fetch inspection details'
        );
        throw error;
      }
    }
  );

  /**
   * PUT /api/inspections/:id - Update inspection details
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      propertyAddress?: string;
      landlordName?: string;
      tenantName?: string;
      landlordSignature?: string;
      tenantSignature?: string;
      status?: string;
    };
  }>(
    '/api/inspections/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          propertyAddress?: string;
          landlordName?: string;
          tenantName?: string;
          landlordSignature?: string;
          tenantSignature?: string;
          status?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const updateData = request.body;

      app.logger.info({ inspectionId: id, userId: session.user.id }, 'Updating inspection');

      try {
        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, id),
        });

        if (!inspection) {
          app.logger.warn({ inspectionId: id }, 'Inspection not found');
          return reply.status(404).send({ error: 'Inspection not found' });
        }

        if (inspection.userId !== session.user.id) {
          app.logger.warn(
            { inspectionId: id, userId: session.user.id },
            'Unauthorized update to inspection'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const updated = await app.db
          .update(schema.inspections)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(schema.inspections.id, id))
          .returning();

        app.logger.info(
          { inspectionId: id, status: updated[0].status },
          'Inspection updated successfully'
        );

        return updated[0];
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId: id, userId: session.user.id },
          'Failed to update inspection'
        );
        throw error;
      }
    }
  );

  /**
   * DELETE /api/inspections/:id - Delete inspection
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/api/inspections/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info({ inspectionId: id, userId: session.user.id }, 'Deleting inspection');

      try {
        const inspection = await app.db.query.inspections.findFirst({
          where: eq(schema.inspections.id, id),
        });

        if (!inspection) {
          app.logger.warn({ inspectionId: id }, 'Inspection not found');
          return reply.status(404).send({ error: 'Inspection not found' });
        }

        if (inspection.userId !== session.user.id) {
          app.logger.warn(
            { inspectionId: id, userId: session.user.id },
            'Unauthorized deletion of inspection'
          );
          return reply.status(403).send({ error: 'Forbidden' });
        }

        // Delete all associated rooms and meters
        await app.db.delete(schema.rooms).where(eq(schema.rooms.inspectionId, id));
        await app.db.delete(schema.meters).where(eq(schema.meters.inspectionId, id));

        // Delete the inspection
        await app.db.delete(schema.inspections).where(eq(schema.inspections.id, id));

        app.logger.info({ inspectionId: id }, 'Inspection deleted successfully');

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId: id, userId: session.user.id },
          'Failed to delete inspection'
        );
        throw error;
      }
    }
  );
}
