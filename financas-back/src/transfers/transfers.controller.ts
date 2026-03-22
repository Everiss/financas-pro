import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { User } from '@prisma/client';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private transfersService: TransfersService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.transfersService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transfersService.remove(id, user.id);
  }
}
