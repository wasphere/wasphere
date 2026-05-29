import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function argon2Options(): argon2.Options & { raw?: false } {
  const memoryCost = parseInt(process.env.ARGON2_MEMORY_KB ?? '32768', 10);
  const timeCost = parseInt(process.env.ARGON2_TIME_COST ?? '4', 10);
  return {
    type: argon2.argon2id,
    memoryCost,
    timeCost,
    parallelism: 1,
    raw: false,
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Pre-compute dummy hash for timing-safe login
    this.dummyHash = await argon2.hash('__dummy_password__', argon2Options());
  }

  private async issueTokenPair(userId: string, email: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: '15m' },
    );

    const rawRefreshToken = generateRawToken();
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async registerAvailable(): Promise<{ available: boolean }> {
    const count = await this.prisma.user.count();
    return { available: count === 0 };
  }

  async register(dto: RegisterDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
    workspace: { id: string; name: string };
  }> {
    const count = await this.prisma.user.count();
    if (count > 0) {
      throw new ForbiddenException('registration_locked');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password, argon2Options());

    const { user, workspace } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: { email: dto.email, passwordHash },
      });
      const newWorkspace = await tx.workspace.create({
        data: { name: 'My Workspace', ownerId: newUser.id },
      });
      await tx.workspaceMember.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: newUser.id,
          role: 'OWNER',
        },
      });
      return { user: newUser, workspace: newWorkspace };
    });

    const tokens = await this.issueTokenPair(user.id, user.email);

    return {
      ...tokens,
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, name: workspace.name },
    };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Timing-safe: run argon2 against dummy hash even when user not found
      await argon2.verify(this.dummyHash, dto.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user.id, user.email);

    return {
      ...tokens,
      user: { id: user.id, email: user.email },
    };
  }

  async refresh(rawToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = sha256(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoked token signals possible theft — revoke all user tokens
    if (record.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const newTokens = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });

      const rawRefreshToken = generateRawToken();
      const newHash = sha256(rawRefreshToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

      await tx.refreshToken.create({
        data: { userId: record.userId, tokenHash: newHash, expiresAt },
      });

      const accessToken = this.jwtService.sign(
        { sub: record.userId, email: record.user.email },
        { expiresIn: '15m' },
      );

      return { accessToken, refreshToken: rawRefreshToken };
    });

    return newTokens;
  }

  async logout(rawToken: string): Promise<{ success: boolean }> {
    const tokenHash = sha256(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const genericResponse = {
      message: 'If that email exists, a reset token has been issued.',
    };

    if (!user) {
      return genericResponse;
    }

    const rawToken = generateRawToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Raw token may only be logged outside production. In production this is a
    // full account-takeover credential, so the flag is ignored and refused.
    if (process.env.EXPOSE_RESET_TOKEN_IN_LOGS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          '[Security] EXPOSE_RESET_TOKEN_IN_LOGS is enabled in production — refusing to log reset token. Unset this flag.',
        );
      } else {
        this.logger.log(`[PasswordReset] Raw token for ${email}: ${rawToken}`);
      }
    }

    return genericResponse;
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const tokenHash = sha256(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, argon2Options());

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { success: true };
  }
}
