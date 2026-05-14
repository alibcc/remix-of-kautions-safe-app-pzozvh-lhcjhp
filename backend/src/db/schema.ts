import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const inspections = pgTable('inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  propertyAddress: text('property_address').notNull(),
  inspectionType: text('inspection_type').notNull(), // "move_in" or "move_out"
  landlordName: text('landlord_name'),
  tenantName: text('tenant_name'),
  landlordSignature: text('landlord_signature'), // base64 image data
  tenantSignature: text('tenant_signature'), // base64 image data
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  status: text('status').notNull().default('draft'), // "draft", "completed", "exported"
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id').notNull(),
  roomName: text('room_name').notNull(),
  condition: text('condition').notNull(), // "ok" or "defect"
  defectDescription: text('defect_description'),
  defectPhotoUrl: text('defect_photo_url'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const meters = pgTable('meters', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id').notNull(),
  meterType: text('meter_type').notNull(), // "electricity", "gas", "water", "heating"
  meterNumber: text('meter_number').notNull(),
  reading: text('reading').notNull(),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
