import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { DepositGoalDto } from './dto/deposit-goal.dto';
import { User } from '@prisma/client';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.goalsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goalsService.findOne(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(id, user.id, dto);
  }

  @Post(':id/deposit')
  deposit(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: DepositGoalDto) {
    return this.goalsService.deposit(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goalsService.remove(id, user.id);
  }
}
