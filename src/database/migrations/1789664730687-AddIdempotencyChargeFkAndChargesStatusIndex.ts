import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdempotencyChargeFkAndChargesStatusIndex1789664730687 implements MigrationInterface {
    name = 'AddIdempotencyChargeFkAndChargesStatusIndex1789664730687'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_3b0c097189deee001da5ae0d308" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // Composto e não CONCURRENTLY: a tabela ainda não existe em produção real
        // (projeto novo), então o lock breve do CREATE INDEX padrão não tem custo
        // prático aqui — CONCURRENTLY exigiria rodar fora da transação da migration.
        await queryRunner.query(`CREATE INDEX "IDX_charges_status_expires_at" ON "charges" ("status", "expires_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_charges_status_expires_at"`);
        await queryRunner.query(`ALTER TABLE "idempotency_keys" DROP CONSTRAINT "FK_3b0c097189deee001da5ae0d308"`);
    }

}
