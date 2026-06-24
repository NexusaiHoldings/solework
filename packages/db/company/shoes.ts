import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const shoeDesignValidationStatusEnum = pgEnum("shoe_design_validation_status", [
  "pending",
  "valid",
  "rejected",
]);

export const shoePrintJobStatusEnum = pgEnum("shoe_print_job_status", [
  "queued",
  "printing",
  "qc_hold",
  "shipped",
  "cancelled",
]);

export const shoePrintJobIpClearanceStatusEnum = pgEnum("shoe_print_job_ip_clearance_status", [
  "pending",
  "cleared",
  "rejected",
]);

export const shoeSilhouettes = pgTable("shoe_silhouettes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  meshUrl: text("mesh_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  complianceCertified: boolean("compliance_certified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoeColorways = pgTable("shoe_colorways", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  hexPrimary: varchar("hex_primary", { length: 7 }).notNull(),
  hexSecondary: varchar("hex_secondary", { length: 7 }).notNull(),
  materialType: varchar("material_type", { length: 120 }).notNull(),
});

export const shoeDesignSessions = pgTable("shoe_design_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  silhouetteId: uuid("silhouette_id")
    .notNull()
    .references(() => shoeSilhouettes.id, { onDelete: "restrict" }),
  colorwayId: uuid("colorway_id")
    .notNull()
    .references(() => shoeColorways.id, { onDelete: "restrict" }),
  soleProfile: varchar("sole_profile", { length: 120 }).notNull(),
  toeShape: varchar("toe_shape", { length: 120 }).notNull(),
  usSize: numeric("us_size", { precision: 4, scale: 1 }).notNull(),
  validationStatus: shoeDesignValidationStatusEnum("validation_status")
    .notNull()
    .default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const printJobs = pgTable("print_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  designSessionId: uuid("design_session_id")
    .notNull()
    .references(() => shoeDesignSessions.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull(),
  status: shoePrintJobStatusEnum("status").notNull().default("queued"),
  ipClearanceStatus: shoePrintJobIpClearanceStatusEnum("ip_clearance_status")
    .notNull()
    .default("pending"),
  printerFarmJobId: varchar("printer_farm_job_id", { length: 120 }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoeSkus = pgTable("shoe_skus", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  silhouetteId: uuid("silhouette_id")
    .notNull()
    .references(() => shoeSilhouettes.id, { onDelete: "restrict" }),
  colorwayId: uuid("colorway_id")
    .notNull()
    .references(() => shoeColorways.id, { onDelete: "restrict" }),
  usSize: numeric("us_size", { precision: 4, scale: 1 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  priceCents: integer("price_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const shoeSilhouettesRelations = relations(shoeSilhouettes, ({ many }) => ({
  designSessions: many(shoeDesignSessions),
  skus: many(shoeSkus),
}));

export const shoeColorwaysRelations = relations(shoeColorways, ({ many }) => ({
  designSessions: many(shoeDesignSessions),
  skus: many(shoeSkus),
}));

export const shoeDesignSessionsRelations = relations(shoeDesignSessions, ({ one, many }) => ({
  silhouette: one(shoeSilhouettes, {
    fields: [shoeDesignSessions.silhouetteId],
    references: [shoeSilhouettes.id],
  }),
  colorway: one(shoeColorways, {
    fields: [shoeDesignSessions.colorwayId],
    references: [shoeColorways.id],
  }),
  printJobs: many(printJobs),
}));

export const printJobsRelations = relations(printJobs, ({ one }) => ({
  designSession: one(shoeDesignSessions, {
    fields: [printJobs.designSessionId],
    references: [shoeDesignSessions.id],
  }),
}));

export const shoeSkusRelations = relations(shoeSkus, ({ one }) => ({
  silhouette: one(shoeSilhouettes, {
    fields: [shoeSkus.silhouetteId],
    references: [shoeSilhouettes.id],
  }),
  colorway: one(shoeColorways, {
    fields: [shoeSkus.colorwayId],
    references: [shoeColorways.id],
  }),
}));

export type ShoeSilhouette = typeof shoeSilhouettes.$inferSelect;
export type NewShoeSilhouette = typeof shoeSilhouettes.$inferInsert;

export type ShoeColorway = typeof shoeColorways.$inferSelect;
export type NewShoeColorway = typeof shoeColorways.$inferInsert;

export type ShoeDesignSession = typeof shoeDesignSessions.$inferSelect;
export type NewShoeDesignSession = typeof shoeDesignSessions.$inferInsert;

export type PrintJob = typeof printJobs.$inferSelect;
export type NewPrintJob = typeof printJobs.$inferInsert;

export type ShoeSku = typeof shoeSkus.$inferSelect;
export type NewShoeSku = typeof shoeSkus.$inferInsert;
