import { Injectable } from '@nestjs/common';

import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import { DbService } from 'src/db/db.service';
import { User as TuneVaultUser } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly dbService: DbService) {}

  public async findAll(): Promise<TuneVaultUser[]> {
    return this.dbService.user.findMany();
  }

  public async findOne(id: string): Promise<TuneVaultUser> {
    return this.dbService.user.findUnique({
      where: { id },
    });
  }

  public async update(id: string, updateUserDto: UpdateUserDto): Promise<TuneVaultUser> {
    return this.dbService.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  public async remove(id: string): Promise<TuneVaultUser> {
    return this.dbService.user.delete({
      where: { id },
    });
  }
}
