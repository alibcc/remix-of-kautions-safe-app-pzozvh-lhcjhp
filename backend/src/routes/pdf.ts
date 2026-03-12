import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import PDFDocument from 'pdfkit';

async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function base64ToBuffer(base64String: string): Buffer | null {
  try {
    const base64Data = base64String.includes(',')
      ? base64String.split(',')[1]
      : base64String;
    return Buffer.from(base64Data, 'base64');
  } catch {
    return null;
  }
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

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
        // Fetch inspection
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

        // Fetch rooms and meters
        const rooms = await app.db.query.rooms.findMany({
          where: eq(schema.rooms.inspectionId, id),
        });

        const meters = await app.db.query.meters.findMany({
          where: eq(schema.meters.inspectionId, id),
        });

        // Pre-fetch all room photos as buffers
        const roomPhotoBuffers: Record<string, Buffer | null> = {};
        for (const room of rooms) {
          if (room.defectPhotoUrl) {
            // Generate signed URL from Supabase storage
            const path = room.defectPhotoUrl.includes('/storage/v1/object/')
              ? room.defectPhotoUrl.split('/storage/v1/object/public/')[1]
              : room.defectPhotoUrl;

            try {
              const { data } = await app.supabase.storage
                .from(path.split('/')[0])
                .createSignedUrl(path.split('/').slice(1).join('/'), 60);

              if (data?.signedUrl) {
                roomPhotoBuffers[room.id] = await fetchImageAsBuffer(data.signedUrl);
              }
            } catch {
              // Try using the URL directly as fallback
              roomPhotoBuffers[room.id] = await fetchImageAsBuffer(room.defectPhotoUrl);
            }
          }
        }

        // Pre-fetch meter photos
        const meterPhotoBuffers: Record<string, Buffer | null> = {};
        for (const meter of meters) {
          if (meter.photoUrl) {
            meterPhotoBuffers[meter.id] = await fetchImageAsBuffer(meter.photoUrl);
          }
        }

        // Create PDF
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));

        const pdfPromise = new Promise<Buffer>((resolve, reject) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);
        });

        const inspectionTypeGerman =
          inspection.inspectionType === 'move_in' ? 'Einzug' : 'Auszug';
        const dateStr = new Date(inspection.createdAt).toLocaleDateString('de-DE');
        const pageWidth = 515; // A4 width minus margins

        // ── HEADER ──────────────────────────────────────────────
        doc.fontSize(20).font('Helvetica-Bold').text('Wohnungsübergabeprotokoll', {
          align: 'center',
        });
        doc.moveDown(0.3);
        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`Art der Übergabe: ${inspectionTypeGerman}`, { width: pageWidth })
          .text(`Datum: ${dateStr}`, { width: pageWidth })
          .text(`Adresse: ${inspection.propertyAddress}`, { width: pageWidth });

        doc.moveDown(0.5);

        // ── PARTIES ─────────────────────────────────────────────
        if (inspection.landlordName || inspection.tenantName) {
          doc.fontSize(13).font('Helvetica-Bold').text('Beteiligte Parteien', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(11).font('Helvetica');
          if (inspection.landlordName) {
            doc.text(`Vermieter: ${inspection.landlordName}`, { width: pageWidth });
          }
          if (inspection.tenantName) {
            doc.text(`Mieter: ${inspection.tenantName}`, { width: pageWidth });
          }
          doc.moveDown(0.5);
        }

        // ── LEGAL DISCLAIMER ────────────────────────────────────
        doc.fontSize(9).font('Helvetica-Oblique').text(
          'Dieses Protokoll dient der Dokumentation des Zustands bei Wohnungsübergabe und ist verbindlich für beide Parteien.',
          { width: pageWidth, align: 'center' }
        );
        doc.moveDown(1);

        // ── ROOMS ───────────────────────────────────────────────
        doc.fontSize(14).font('Helvetica-Bold').text('Rauminspektionen', { underline: true });
        doc.moveDown(0.5);

        if (rooms.length === 0) {
          doc.fontSize(11).font('Helvetica').text('Keine Räume erfasst.');
          doc.moveDown(1);
        } else {
          // Sort rooms by sortOrder
          const sortedRooms = [...rooms].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

          for (const room of sortedRooms) {
            doc.fontSize(12).font('Helvetica-Bold').text(room.roomName);
            doc.fontSize(10).font('Helvetica');

            const conditionText =
              room.condition === 'ok' ? '✓ In Ordnung' : '✗ Beschädigungen vorhanden';
            doc.text(`Zustand: ${conditionText}`, { width: pageWidth });

            if (room.condition === 'defect' && room.defectDescription) {
              doc.text(`Beschreibung: ${room.defectDescription}`, { width: pageWidth });
            }

            // Embed room photo if available
            const photoBuffer = roomPhotoBuffers[room.id];
            if (photoBuffer) {
              try {
                doc.moveDown(0.3);
                doc.image(photoBuffer, { width: 200, height: 150 });
                doc.moveDown(0.3);
              } catch {
                doc.text('[Foto konnte nicht geladen werden]', { width: pageWidth });
              }
            }

            doc.moveDown(0.5);
          }
        }

        doc.moveDown(0.5);

        // ── METERS ──────────────────────────────────────────────
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

          const col1 = 50, col2 = 180, col3 = 320, col4 = 430;
          const tableTop = doc.y;

          // Table header
          doc.font('Helvetica-Bold');
          doc.text('Typ', col1, tableTop);
          doc.text('Nummer', col2, tableTop);
          doc.text('Stand', col3, tableTop);
          doc.text('Datum', col4, tableTop);
          doc.moveDown(0.3);
          doc
            .moveTo(col1 - 5, doc.y)
            .lineTo(550, doc.y)
            .stroke();
          doc.moveDown(0.4);

          doc.font('Helvetica');
          for (const meter of meters) {
            const meterLabel = meterTypeLabels[meter.meterType] || meter.meterType;
            const meterDate = new Date(meter.createdAt).toLocaleDateString('de-DE');
            const rowY = doc.y;

            doc.text(meterLabel, col1, rowY);
            doc.text(meter.meterNumber, col2, rowY);
            doc.text(meter.reading, col3, rowY);
            doc.text(meterDate, col4, rowY);
            doc.moveDown(0.5);

            // Meter photo
            const meterPhoto = meterPhotoBuffers[meter.id];
            if (meterPhoto) {
              try {
                doc.image(meterPhoto, { width: 150, height: 100 });
                doc.moveDown(0.3);
              } catch {
                // skip
              }
            }
          }
        }

        doc.moveDown(1.5);

        // ── SIGNATURES ──────────────────────────────────────────
        doc.fontSize(14).font('Helvetica-Bold').text('Unterschriften', { underline: true });
        doc.moveDown(1);

        const sigHeight = 80;
        const sigLeft = 50;
        const sigRight = 320;
        const sigY = doc.y;

        // Landlord signature
        if (inspection.landlordSignature) {
          const sigBuffer = base64ToBuffer(inspection.landlordSignature);
          if (sigBuffer) {
            try {
              doc.image(sigBuffer, sigLeft, sigY, { width: 150, height: sigHeight });
            } catch {
              doc.rect(sigLeft, sigY, 150, sigHeight).stroke();
            }
          } else {
            doc.rect(sigLeft, sigY, 150, sigHeight).stroke();
          }
        } else {
          doc.rect(sigLeft, sigY, 150, sigHeight).stroke();
        }

        // Tenant signature
        if (inspection.tenantSignature) {
          const sigBuffer = base64ToBuffer(inspection.tenantSignature);
          if (sigBuffer) {
            try {
              doc.image(sigBuffer, sigRight, sigY, { width: 150, height: sigHeight });
            } catch {
              doc.rect(sigRight, sigY, 150, sigHeight).stroke();
            }
          } else {
            doc.rect(sigRight, sigY, 150, sigHeight).stroke();
          }
        } else {
          doc.rect(sigRight, sigY, 150, sigHeight).stroke();
        }

        // Signature labels
        doc.fontSize(9).font('Helvetica');
        doc.text('Vermieter', sigLeft, sigY + sigHeight + 5, { width: 150, align: 'center' });
        doc.text('Mieter', sigRight, sigY + sigHeight + 5, { width: 150, align: 'center' });

        // Finalize
        doc.end();
        const pdfBuffer = await pdfPromise;

        // Upload to storage
        const pdfKey = `inspections/${inspection.userId}/${id}-inspection-${Date.now()}.pdf`;
        const uploadedKey = await app.storage.upload(pdfKey, pdfBuffer);

        // Get signed URL
        const { url: pdfUrl } = await app.storage.getSignedUrl(uploadedKey);

        // Update inspection status
        await app.db
          .update(schema.inspections)
          .set({ status: 'exported', updatedAt: new Date() })
          .where(eq(schema.inspections.id, id));

        app.logger.info({ inspectionId: id, pdfKey: uploadedKey }, 'PDF report generated successfully');

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