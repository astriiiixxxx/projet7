import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token Bearer manquant dans Authorization');
    }

    const token = authHeader.slice(7).trim();
    const session = await this.authService.validateToken(token);

    if (!session) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    (request as any).user = session;
    return true;
  }
}
