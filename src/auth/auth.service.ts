import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'discord.js';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  public async generateJwt(user: User) {
    return {
      access_token: this.jwtService.sign(user),
    };
  }
}
