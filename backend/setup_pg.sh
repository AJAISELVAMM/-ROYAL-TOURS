#!/bin/bash
set -e

PG_CONF=$(find /etc/postgresql/ -name postgresql.conf)
PG_HBA=$(find /etc/postgresql/ -name pg_hba.conf)

sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"

cat << 'EOF' > "$PG_HBA"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               trust
host    all             all             ::/0                    trust
EOF

service postgresql restart

sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'tourguard') THEN CREATE ROLE tourguard WITH LOGIN SUPERUSER PASSWORD 'tourguard'; END IF; END \$\$;"
sudo -u postgres createdb -O tourguard tourguard 2>/dev/null || true

echo "PostgreSQL pg_hba trust configured and restarted."
