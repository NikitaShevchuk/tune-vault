import { Injectable, CanActivate, Logger } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { User } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class WsGuard implements CanActivate {
  private readonly logger = new Logger(WsGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  public async canActivate(context: any): Promise<boolean> {
    const bearerToken = context.args[0].handshake.headers.authorization.split(' ')[1];
    try {
      const decoded = this.authService.verifyJwt<User>(bearerToken);
      const user = await this.userService.findOne(decoded.id);
      return Boolean(user);
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }
}
