import {
  Controller,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { FaturaImportService } from './fatura-import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

@Controller('fatura-import')
@UseGuards(FirebaseAuthGuard)
export class FaturaImportController {
  constructor(private readonly service: FaturaImportService) {}

  /** Upload PDF/Excel fatura → returns reconciliation items */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId: string,
    @Request() req,
  ) {
    return this.service.processFile(file.buffer, file.mimetype, accountId, req.user.id);
  }

  /** Confirm reconciliation choices → creates/links transactions */
  @Post('confirm')
  confirm(@Body() dto: ConfirmImportDto, @Request() req) {
    return this.service.confirm(req.user.id, dto);
  }
}
