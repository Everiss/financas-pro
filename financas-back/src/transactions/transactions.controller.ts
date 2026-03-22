import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionsService, CreateInstallmentsDto } from './transactions.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { User } from '@prisma/client';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query() query: QueryTransactionDto) {
    return this.transactionsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transactionsService.findOne(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transactionsService.remove(id, user.id);
  }

  @Post('installments')
  createInstallments(@CurrentUser() user: User, @Body() dto: CreateInstallmentsDto) {
    return this.transactionsService.createInstallments(user.id, dto);
  }

  @Patch(':id/confirm')
  confirm(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transactionsService.confirm(id, user.id);
  }
}
