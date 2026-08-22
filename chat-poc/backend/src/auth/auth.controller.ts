import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginDto {
  email: string;
  role: 'client' | 'agent';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    if (!body.email?.trim()) {
      throw new UnauthorizedException('Le champ email est requis');
    }
    if (!['client', 'agent'].includes(body.role)) {
      throw new UnauthorizedException('Le rôle doit être "client" ou "agent"');
    }

    const token = await this.authService.login(body.email.trim(), body.role);
    return { token, email: body.email.trim(), role: body.role };
  }
}
