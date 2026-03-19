import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { User } from '@prisma/client';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private remindersService: RemindersService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.remindersService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.remindersService.findOne(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateReminderDto) {
    return this.remindersService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.remindersService.remove(id, user.id);
  }
}
