import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const conf = readFileSync('docker/nginx.conf', 'utf8');

// Блок location до закрывающей скобки на отдельной строке: скобки внутри строк JSON не в счёт
function locationBlock(header: string): string {
  const start = conf.indexOf(`location ${header} {`);
  if (start === -1) return '';
  return conf.slice(start, conf.indexOf('\n  }', start) + 4);
}

describe('docker/nginx.conf', () => {
  it('rate-limits login requests per client address', () => {
    expect(conf).toMatch(/limit_req_zone \$binary_remote_addr zone=login:\d+m rate=\d+r\/m;/);
    const login = locationBlock('= /api/auth/login');
    expect(login).toMatch(/limit_req zone=login burst=\d+ nodelay;/);
    expect(login).toContain('limit_req_status 429;');
    expect(login).toContain('proxy_pass http://api:3000;');
  });

  it('answers a rate-limited login with the TOO_MANY_ATTEMPTS code in JSON', () => {
    const login = locationBlock('= /api/auth/login');
    expect(login).toContain('error_page 429 = @login_limited;');
    const limited = locationBlock('@login_limited');
    expect(limited).toContain('default_type application/json;');
    expect(limited).toContain(`return 429 '{"code":"TOO_MANY_ATTEMPTS"}';`);
  });

  it('takes the client address from the HTTPS proxy only on private networks', () => {
    expect(conf).toContain('real_ip_header X-Forwarded-For;');
    expect(conf).toContain('set_real_ip_from 127.0.0.1;');
    expect(conf).not.toMatch(/set_real_ip_from 0\.0\.0\.0\/0/);
  });
});
