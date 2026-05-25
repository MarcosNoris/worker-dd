import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseClientFactory {
  constructor(private readonly configService: ConfigService) {}

  createAnonymousClient(): SupabaseClient {
    return createClient(this.readSupabaseUrl(), this.readSupabaseAnonKey(), {
      auth: this.createAuthOptions(),
    });
  }

  createAuthenticatedClient(accessToken: string): SupabaseClient {
    return createClient(this.readSupabaseUrl(), this.readSupabaseAnonKey(), {
      auth: this.createAuthOptions(),
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  createServiceRoleClient(): SupabaseClient {
    return createClient(
      this.readSupabaseUrl(),
      this.readSupabaseServiceRoleKey(),
      {
        auth: this.createAuthOptions(),
      },
    );
  }

  private createAuthOptions(): {
    autoRefreshToken: false;
    persistSession: false;
  } {
    return {
      autoRefreshToken: false,
      persistSession: false,
    };
  }

  private readSupabaseUrl(): string {
    return this.readRequiredConfig('SUPABASE_URL');
  }

  private readSupabaseAnonKey(): string {
    return this.readRequiredConfig('SUPABASE_ANON_KEY');
  }

  private readSupabaseServiceRoleKey(): string {
    return this.readRequiredConfig('SUPABASE_SERVICE_ROLE_KEY');
  }

  private readRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(`${key} no esta configurada.`);
    }

    return value;
  }
}
