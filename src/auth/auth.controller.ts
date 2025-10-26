// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { UserService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user-dto';
import { RegisterUserDto } from './dto/register-user-dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface JwtPayload {
  id: number;
  username: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // -------- REGISTRO --------
  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  // -------- LOGIN --------
  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginUserDto);

    response.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseInt(process.env.COOKIE_MAX_AGE || '3600000'), // 1 hora
    });

    return {
      success: true,
      message: 'Login successful',
    };
  }

  // -------- LOGOUT --------
  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  // -------- PERFIL ACTUAL --------
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: Request & { user: JwtPayload }) {
    const userId = req.user.id;
    return this.userService.findOne(userId);
  }

  // -------- ACTUALIZAR PERFIL --------
  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        const allowed = /\/(jpg|jpeg|png|webp|gif)$/i.test(file.mimetype);
        if (allowed) return cb(null, true);
        cb(new Error('Tipo de archivo no soportado'), false);
      },
    }),
  )
  async updateProfile(
    @Req() req: Request & { user: { sub: number; id?: number } },
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/ }),
        ],
        fileIsRequired: false,
      }),
    )
    photo?: Express.Multer.File,
  ) {
    const userId: number = req.user.sub ?? req.user.id;
    return this.authService.updateProfile(userId, dto, photo);
  }
}
