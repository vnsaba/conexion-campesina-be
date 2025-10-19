import { Module } from '@nestjs/common';

import { ProductBaseController } from './product-base.controller';
import { ProductBaseService } from './product-base.service';

@Module({
  controllers: [ProductBaseController],
  providers: [ProductBaseService],
  exports: [ProductBaseService],
})
export class ProductBaseModule {}
