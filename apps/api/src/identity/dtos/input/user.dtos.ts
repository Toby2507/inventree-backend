import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const PASSWORD_REGEX = {
  ex: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
  msg: 'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character',
};

export class RegisterUserDTO {
  @ApiProperty({ description: "User's email address" })
  @IsDefined()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: "User's password" })
  @IsDefined()
  @Matches(PASSWORD_REGEX.ex, { message: PASSWORD_REGEX.msg })
  password!: string;

  @ApiPropertyOptional({ description: "User's first name" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'firstName is required' })
  firstName?: string;

  @ApiPropertyOptional({ description: "User's last name" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'lastName is required' })
  lastName?: string;

  @ApiPropertyOptional({ description: "User's display name" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'displayName is required' })
  displayName?: string;
}
