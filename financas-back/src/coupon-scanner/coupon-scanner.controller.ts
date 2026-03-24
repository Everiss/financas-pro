import {
  Controller, Post, Get, Body, UploadedFile,
  UseInterceptors, UseGuards, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CouponScannerService, ConfirmReceiptDto } from './coupon-scanner.service';

@ApiTags('coupon-scanner')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('coupon-scanner')
export class CouponScannerController {
  constructor(private readonly service: CouponScannerService) {}

  /** Envia imagem do cupom e recebe dados extraídos pela IA */
  @Post('scan')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async scan(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new Error('Nenhum arquivo enviado.');
    return this.service.scanImage(file.buffer, file.mimetype, req.user.id);
  }

  /** Confirma o cupom: salva Receipt + ReceiptItems + cria Transaction */
  @Post('confirm')
  async confirm(@Body() dto: ConfirmReceiptDto, @Request() req: any) {
    return this.service.confirm(req.user.id, dto);
  }

  /** Lista cupons fiscais do usuário */
  @Get()
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user.id);
  }
}
