import { Controller, Get, UseGuards, Sse, Res } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';
import { AuthGuard } from '../auth/guards/auth.guards';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected, User } from '../auth/guards/decorators';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/guards/interface/current-user.interface';
import { NotificationService } from './notification.service';

@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('stream')
  @Sse('stream')
  streamNotifications(
    @User() user: CurrentUser,
    @Res() res: Response,
  ): Observable<MessageEvent> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    return this.notificationService.getNotificationStream(user.id).pipe(
      map(
        (message: MessageEvent) =>
          ({
            id: Date.now().toString(),
            type: message.type || 'message',
            data: message.data,
          }) as unknown as MessageEvent,
      ),
      finalize(() => {
        this.notificationService.removeStream(user.id);
      }),
    );
  }
}
