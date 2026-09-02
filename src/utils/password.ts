import bcrypt from 'bcrypt';
import { config } from '../config';

export const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, config.BCRYPT_SALT_ROUNDS);

export const comparePassword = async (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export const hashPasswordSync = (plain: string): string =>
  bcrypt.hashSync(plain, config.BCRYPT_SALT_ROUNDS);
