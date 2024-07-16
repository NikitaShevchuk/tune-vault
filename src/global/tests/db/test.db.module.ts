import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { TestDbService } from './test.db.service';

@Module({
  imports: [DbModule],
  providers: [TestDbService],
})
export class TestDbModule {}
