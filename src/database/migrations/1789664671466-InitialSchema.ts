import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789664671466 implements MigrationInterface {
    name = 'InitialSchema1789664671466'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."charge_status_enum" AS ENUM('CREATED', 'AWAITING_PAYMENT', 'PAID', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "charges" ("id" character varying NOT NULL, "status" "public"."charge_status_enum" NOT NULL, "amount" integer NOT NULL, "currency" character varying(3) NOT NULL, "payer_document" character varying NOT NULL, "description" character varying, "qr_code" character varying, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0c6feb10df0fa460714f8464dce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "idempotency_keys" ("key" character varying NOT NULL, "charge_id" character varying NOT NULL, "request_hash" character varying(64) NOT NULL, "response_body" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0afd83cbf08c9d12089a9bffc5e" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "webhook_events" ("event_id" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_eca7d9af1d5bb2184a201ed250d" PRIMARY KEY ("event_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "webhook_events"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP TABLE "charges"`);
        await queryRunner.query(`DROP TYPE "public"."charge_status_enum"`);
    }

}
