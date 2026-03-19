import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { User } from '@prisma/client';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.accountsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accountsService.findOne(id, user.id);
  }

  @Get(':id/statement')
  @ApiQuery({ name: 'month', required: false, example: '2026-03' })
  getStatement(@CurrentUser() user: User, @Param('id') id: string, @Query('month') month?: string) {
    return this.accountsService.getStatement(id, user.id, month);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accountsService.remove(id, user.id);
  }
}
