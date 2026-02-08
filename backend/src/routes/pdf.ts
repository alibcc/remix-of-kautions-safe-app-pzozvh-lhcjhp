import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import PDFDocument from 'pdfkit';

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/inspections/:id/generate-pdf - Generate German PDF report
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/api/inspections/:id/generate-pdf',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info({ inspectionId: id, userId: session.user.id }, 'Generating PDF report');

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

        // Create PDF document
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
        });

        // Stream the PDF to a buffer
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));

        const pdfPromise = new Promise<Buffer>((resolve, reject) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);
        });

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Wohnungsübergabeprotokoll', {
          align: 'center',
        });
        doc.moveDown(0.5);

        // Header info
        doc.fontSize(11).font('Helvetica');

        const inspectionTypeGerman =
          inspection.inspectionType === 'move_in' ? 'Einzug' : 'Auszug';
        const dateStr = new Date(inspection.createdAt).toLocaleDateString('de-DE');

        doc.text(`Art der Übergabe: ${inspectionTypeGerman}`, { width: 500 });
        doc.text(`Datum: ${dateStr}`, { width: 500 });
        doc.text(`Adresse: ${inspection.propertyAddress}`, { width: 500 });

        doc.moveDown(0.5);

        if (inspection.landlordName) {
          doc.text(`Vermieter: ${inspection.landlordName}`, { width: 500 });
        }
        if (inspection.tenantName) {
          doc.text(`Mieter: ${inspection.tenantName}`, { width: 500 });
        }

        doc.moveDown(1);

        // Legal disclaimer
        doc.fontSize(9).font('Helvetica-Oblique');
        doc.text(
          'Dieses Protokoll dient der Dokumentation des Zustands bei Wohnungsübergabe und ist verbindlich für beide Parteien.',
          { width: 500, align: 'center' }
        );

        doc.moveDown(1);

        // Rooms section
        doc.fontSize(14).font('Helvetica-Bold').text('Rauminspektionen', { underline: true });
        doc.moveDown(0.5);

        if (rooms.length === 0) {
          doc.fontSize(11).font('Helvetica').text('Keine Räume erfasst.');
          doc.moveDown(1);
        } else {
          for (const room of rooms) {
            doc.fontSize(11).font('Helvetica-Bold').text(`${room.roomName}`);
            doc.fontSize(10).font('Helvetica');

            const conditionText = room.condition === 'ok' ? 'In Ordnung' : 'Beschädigungen vorhanden';
            doc.text(`Zustand: ${conditionText}`, { width: 500 });

            if (room.condition === 'defect') {
              if (room.defectDescription) {
                doc.text(`Beschreibung: ${room.defectDescription}`, { width: 500 });
              }
            }

            doc.moveDown(0.3);
          }
        }

        doc.moveDown(1);

        // Meters section
        doc.fontSize(14).font('Helvetica-Bold').text('Zählerstände', { underline: true });
        doc.moveDown(0.5);

        if (meters.length === 0) {
          doc.fontSize(11).font('Helvetica').text('Keine Zähler erfasst.');
          doc.moveDown(1);
        } else {
          const meterTypeLabels: Record<string, string> = {
            electricity: 'Strom',
            gas: 'Gas',
            water: 'Wasser',
            heating: 'Heizung',
          };

          doc.fontSize(10).font('Helvetica');

          // Table header
          const tableTop = doc.y;
          const col1 = 50;
          const col2 = 200;
          const col3 = 350;
          const col4 = 480;

          doc.text('Zählertyp', col1, tableTop);
          doc.text('Zählernummer', col2, tableTop);
          doc.text('Zählerstand', col3, tableTop);
          doc.text('Datum', col4, tableTop);

          doc.moveTo(col1 - 5, tableTop + 15).lineTo(550, tableTop + 15).stroke();
          doc.moveDown(0.7);

          for (const meter of meters) {
            const meterLabel = meterTypeLabels[meter.meterType] || meter.meterType;
            const meterDate = new Date(meter.createdAt).toLocaleDateString('de-DE');

            doc.text(meterLabel, col1);
            doc.text(meter.meterNumber, col2, doc.y);
            doc.text(meter.reading, col3, doc.y);
            doc.text(meterDate, col4, doc.y);
            doc.moveDown(0.5);
          }
        }

        doc.moveDown(1.5);

        // Signatures section
        doc.fontSize(14).font('Helvetica-Bold').text('Unterschriften', { underline: true });
        doc.moveDown(1);

        const sigHeight = 80;
        const sigLeft = 50;
        const sigRight = 320;

        // Landlord signature
        if (inspection.landlordSignature) {
          doc.image(Buffer.from(inspection.landlordSignature.split(',')[1], 'base64'), sigLeft, doc.y, {
            width: 150,
            height: sigHeight,
          });
        } else {
          doc.rect(sigLeft, doc.y, 150, sigHeight).stroke();
          doc.fontSize(9).text('(Unterschrift Vermieter)', sigLeft, doc.y + sigHeight + 5, {
            width: 150,
          });
        }

        const leftY = doc.y;
        doc.fontSize(10).font('Helvetica').text('Vermieter', sigLeft, leftY + sigHeight + 5, {
          width: 150,
          align: 'center',
        });

        // Tenant signature
        if (inspection.tenantSignature) {
          doc.image(Buffer.from(inspection.tenantSignature.split(',')[1], 'base64'), sigRight, leftY, {
            width: 150,
            height: sigHeight,
          });
        } else {
          doc.rect(sigRight, leftY, 150, sigHeight).stroke();
          doc.fontSize(9).text('(Unterschrift Mieter)', sigRight, leftY + sigHeight + 5, {
            width: 150,
          });
        }

        doc.fontSize(10).font('Helvetica').text('Mieter', sigRight, leftY + sigHeight + 5, {
          width: 150,
          align: 'center',
        });

        // Finalize PDF
        doc.end();

        const pdfBuffer = await pdfPromise;

        // Upload PDF to storage
        const pdfKey = `inspections/${inspection.userId}/${id}-inspection-${Date.now()}.pdf`;
        const uploadedKey = await app.storage.upload(pdfKey, pdfBuffer);

        // Get signed URL for PDF
        const { url: pdfUrl } = await app.storage.getSignedUrl(uploadedKey);

        // Update inspection status
        await app.db
          .update(schema.inspections)
          .set({
            status: 'exported',
            updatedAt: new Date(),
          })
          .where(eq(schema.inspections.id, id));

        app.logger.info(
          { inspectionId: id, pdfKey: uploadedKey },
          'PDF report generated successfully'
        );

        return { pdfUrl, key: uploadedKey };
      } catch (error) {
        app.logger.error(
          { err: error, inspectionId: id, userId: session.user.id },
          'Failed to generate PDF report'
        );
        throw error;
      }
    }
  );
}
