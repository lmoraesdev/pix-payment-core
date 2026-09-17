import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './database.config';

// DataSource dedicado à CLI do TypeORM (migration:generate/run/revert).
// Reaproveita databaseConfig() para não duplicar as credenciais e o
// mapeamento de entidades usados pela aplicação em runtime, mas força
// synchronize: false — a CLI nunca deve alterar o schema fora de uma migration.
export const dataSourceOptions: DataSourceOptions = {
  ...(databaseConfig() as DataSourceOptions),
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
