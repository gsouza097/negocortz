CREATE TABLE "weekly_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"barber_id" uuid NOT NULL,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"guest_name" text NOT NULL,
	"guest_phone" text NOT NULL,
	"first_date" text NOT NULL,
	"start_minute" smallint NOT NULL,
	"timezone" text NOT NULL,
	"conflict_date" text,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "weekly_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "weekly_bookings" ADD CONSTRAINT "weekly_bookings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_bookings" ADD CONSTRAINT "weekly_bookings_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_bookings" ADD CONSTRAINT "weekly_bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_weekly_booking_id_weekly_bookings_id_fk" FOREIGN KEY ("weekly_booking_id") REFERENCES "public"."weekly_bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_weekly_start_uq" ON "appointments" USING btree ("weekly_booking_id","starts_at");