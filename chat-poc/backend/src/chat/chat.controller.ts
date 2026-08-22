import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ChatService } from './chat.service';

interface CreateSessionDto {
  subject?: string;
}

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  async createSession(@Body() body: CreateSessionDto, @Request() req: any) {
    return this.chatService.createSession(req.user.userId, body.subject);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = await this.chatService.getSession(id);
    if (!session) throw new NotFoundException(`Session ${id} introuvable`);
    return session;
  }

  @Get('sessions/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }
}
