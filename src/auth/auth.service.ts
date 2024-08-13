import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'discord.js';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Wrapper for the JwtService
   */
  public decodeJwt<T extends object = any>(token: string) {
    return this.jwtService.decode<T>(token);
  }

  /**
   * Wrapper for the JwtService
   */
  public verifyJwt<T extends object = any>(token: string) {
    return this.jwtService.verify<T>(token);
  }

  public async generateJwt(user: User) {
    return {
      access_token: this.jwtService.sign(user),
    };
  }
}
