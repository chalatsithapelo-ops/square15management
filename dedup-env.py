import sys
lines = open('/root/square15management/.env').readlines()
seen = set()
out = []
for line in lines:
    stripped = line.strip()
    if '=' in stripped and not stripped.startswith('#'):
        key = stripped.split('=')[0]
        if key in seen:
            continue
        seen.add(key)
    out.append(line)
open('/root/square15management/.env', 'w').writelines(out)
print('Deduped .env - removed duplicate keys')
