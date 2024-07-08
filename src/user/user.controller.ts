import { Controller, Req, Get, Body, Param, Delete, UseGuards, Post } from '@nestjs/common';
import { Request } from 'express';

import { UserService } from 'src/user/user.service';
import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRoles } from 'src/auth/types';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { User as TuneVaultUser } from '@prisma/client';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.admin)
  findAll() {
    return this.userService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public async me(@Req() req: Request): Promise<TuneVaultUser> {
    return await this.userService.findOne(req.user.id);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  public async updateMe(@Req() req: Request, @Body() updateUserDto: UpdateUserDto): Promise<TuneVaultUser> {
    return await this.update(req.user.id, updateUserDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.admin)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
