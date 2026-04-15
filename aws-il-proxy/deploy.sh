#!/bin/sh
# Redeploy rail-probe Lambda in AWS il-central-1.
# Requires AWS credentials in env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
set -eu

REGION=il-central-1
FUNCTION=rail-probe

cd "$(dirname "$0")"

if [ -z "${AWS_ACCESS_KEY_ID-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY-}" ]; then
  echo "AWS creds missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY." >&2
  exit 1
fi

# Package
tmpzip=$(mktemp -t rail-probe.XXXXXX.zip)
trap 'rm -f "$tmpzip"' EXIT
zip -qj "$tmpzip" index.mjs
echo "packaged $(wc -c < "$tmpzip") bytes"

# Deploy via boto3 (AWS CLI not assumed to be present).
python3 - "$REGION" "$FUNCTION" "$tmpzip" <<'PY'
import sys, boto3, time
region, fn, path = sys.argv[1], sys.argv[2], sys.argv[3]
lam = boto3.client('lambda', region_name=region)
with open(path, 'rb') as f:
    z = f.read()
# Wait for any in-progress update to finish first.
for _ in range(30):
    c = lam.get_function(FunctionName=fn)['Configuration']
    if c['State'] == 'Active' and c.get('LastUpdateStatus') == 'Successful':
        break
    time.sleep(1)
lam.update_function_code(FunctionName=fn, ZipFile=z)
print('update_function_code accepted, waiting for success...')
for _ in range(30):
    c = lam.get_function(FunctionName=fn)['Configuration']
    if c.get('LastUpdateStatus') == 'Successful':
        print('deployed', c['FunctionArn'], 'at', c['LastModified'])
        break
    time.sleep(1)
else:
    print('timed out waiting for deploy to settle', file=sys.stderr); sys.exit(1)
PY
