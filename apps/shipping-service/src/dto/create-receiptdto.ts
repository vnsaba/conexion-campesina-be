import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemDto } from './create-shipping-item.dto';

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  // --- Sender Information ---
  @IsString()
  @IsNotEmpty()
  senderName: string;

  @IsString()
  @IsNotEmpty()
  senderId: string;

  @IsString()
  @IsNotEmpty()
  senderIdType: string;

  @IsString()
  @IsNotEmpty()
  senderAddress: string;

  @IsString()
  @IsNotEmpty()
  senderPhone: string;

  // --- Recipient Information ---
  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  recipientIdType: string;

  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @IsString()
  @IsNotEmpty()
  recipientPhone: string;

  // --- Carrier Information ---
  @IsString()
  @IsOptional()
  carrierName?: string;

  @IsString()
  @IsOptional()
  carrierId?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  // --- Receipt Details ---
  @IsString()
  @IsNotEmpty()
  receiptNumber: string;

  @IsDateString()
  dispatchDate: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  declaredValue?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  total?: number;

  @IsString()
  @IsOptional()
  remesaNumber?: string;

  // --- Items ---
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items: CreateItemDto[];

  // --- Digital Signature ---
  @IsString()
  @IsOptional()
  digitalSignature?: string;

  // --- Audit ---
  @IsString()
  @IsNotEmpty()
  generatedBy: string;

  // --- Access Control ---
  @IsString()
  @IsNotEmpty()
  ownerClientId: string;
}
