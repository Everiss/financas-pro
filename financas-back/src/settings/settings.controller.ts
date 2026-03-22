import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { User } from '@prisma/client';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.settingsService.getOrCreate(user.id);
  }

  @Put()
  update(@CurrentUser() user: User, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(user.id, dto);
  }
}
