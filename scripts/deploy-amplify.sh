#!/usr/bin/env bash
# Deploy widget to AWS Amplify and add custom domain program.gravytylabs.com (CNAME in Route 53).
# Prerequisites: AWS CLI configured, pnpm, curl.
# Usage:
#   ./scripts/deploy-amplify.sh
#   APP_ID=dxxx HOSTED_ZONE_ID=Zxxx ./scripts/deploy-amplify.sh   # skip create, use existing app/zone

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Load deploy-related env vars from .env if present (APP_ID, HOSTED_ZONE_ID, VITE_API_URL, etc.)
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

APP_NAME="${APP_NAME:-Program Match Making}"
BRANCH_NAME="${BRANCH_NAME:-main}"
DOMAIN_ROOT="${DOMAIN_ROOT:-gravytylabs.com}"
SUBDOMAIN_PREFIX="${SUBDOMAIN_PREFIX:-program}"
FULL_DOMAIN="${SUBDOMAIN_PREFIX}.${DOMAIN_ROOT}"

echo "==> Deploying to Amplify (app=$APP_NAME, branch=$BRANCH_NAME, domain=$FULL_DOMAIN)"

# --- Resolve or create Amplify app
if [[ -n "${APP_ID:-}" ]]; then
  echo "==> Using existing Amplify app id: $APP_ID"
else
  EXISTING=$(aws amplify list-apps --output json --query "apps[?name=='$APP_NAME'].appId" --output text)
  if [[ -n "$EXISTING" ]]; then
    APP_ID="$EXISTING"
    echo "==> Using existing Amplify app: $APP_ID"
  else
    APP_ID=$(aws amplify create-app --name "$APP_NAME" --platform WEB --output json --query 'app.appId' --output text)
    echo "==> Created Amplify app: $APP_ID"
  fi
fi

# --- Create branch if missing
BRANCHES=$(aws amplify list-branches --app-id "$APP_ID" --output json --query "branches[?branchName=='$BRANCH_NAME'].branchName" --output text)
if [[ -z "$BRANCHES" ]]; then
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --no-enable-auto-build
  echo "==> Created branch: $BRANCH_NAME"
else
  echo "==> Branch $BRANCH_NAME exists"
fi

# --- SPA rewrite: serve index.html only for missing paths (404-200), so /assets/*.js are served as files
echo "==> Setting SPA redirect rules (404 -> index.html)..."
aws amplify update-app --app-id "$APP_ID" --custom-rules '[{"source":"/<*>","status":"404-200","target":"/index.html"}]' --output json > /dev/null

# --- Build widget (set VITE_API_URL to your production server so the widget can reach the API)
echo "==> Building widget..."
if [[ -n "${VITE_API_URL:-}" ]]; then
  echo "    VITE_API_URL=$VITE_API_URL"
  export VITE_API_URL
fi
pnpm --filter @pmm/widget build
WIDGET_DIST="$ROOT/apps/widget/dist"
if [[ ! -d "$WIDGET_DIST" ]]; then
  echo "Error: $WIDGET_DIST not found after build"
  exit 1
fi

# --- Zip and deploy
ZIP_PATH="$ROOT/deploy.zip"
rm -f "$ZIP_PATH"
(cd "$WIDGET_DIST" && zip -rq "$ZIP_PATH" .)
echo "==> Created $ZIP_PATH ($(wc -c < "$ZIP_PATH") bytes)"

DEPLOY_OUT=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --output json)
JOB_ID=$(echo "$DEPLOY_OUT" | jq -r '.jobId')
ZIP_URL=$(echo "$DEPLOY_OUT" | jq -r '.zipUploadUrl')
echo "==> Uploading deployment (jobId=$JOB_ID)..."
curl -sS -X PUT -H "Content-Type: application/zip" --data-binary @"$ZIP_PATH" "$ZIP_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --job-id "$JOB_ID" --output json > /dev/null
echo "==> Deployment started. Wait in Amplify console for job to complete."
rm -f "$ZIP_PATH"

# --- Custom domain: associate program.gravytylabs.com with main branch (skip if already pending)
echo "==> Associating domain $DOMAIN_ROOT with subdomain $SUBDOMAIN_PREFIX -> $BRANCH_NAME"
if ! aws amplify create-domain-association \
  --app-id "$APP_ID" \
  --domain-name "$DOMAIN_ROOT" \
  --sub-domain-settings "[{\"prefix\":\"$SUBDOMAIN_PREFIX\",\"branchName\":\"$BRANCH_NAME\"}]" \
  --output json 2>/dev/null; then
  if ! aws amplify update-domain-association \
    --app-id "$APP_ID" \
    --domain-name "$DOMAIN_ROOT" \
    --sub-domain-settings "[{\"prefix\":\"$SUBDOMAIN_PREFIX\",\"branchName\":\"$BRANCH_NAME\"}]" \
    --output json 2>/dev/null; then
    echo "==> Domain already associated (may be PENDING_VERIFICATION). Continuing to Route53 step..."
  fi
fi

# --- CNAME in Route 53: program.gravytylabs.com -> Amplify
DOMAIN_DATA=$(aws amplify get-domain-association --app-id "$APP_ID" --domain-name "$DOMAIN_ROOT" --output json 2>/dev/null || true)
if [[ -z "$DOMAIN_DATA" ]]; then
  echo "==> Domain association may still be creating. Get CNAME target later with:"
  echo "    aws amplify get-domain-association --app-id $APP_ID --domain-name $DOMAIN_ROOT --query 'domainAssociation.subDomains'"
  exit 0
fi

CNAME_TARGET=$(echo "$DOMAIN_DATA" | jq -r ".domainAssociation.subDomains[] | select(.subDomainSetting.prefix==\"$SUBDOMAIN_PREFIX\") | .dnsRecord")
if [[ -z "$CNAME_TARGET" || "$CNAME_TARGET" == "null" ]]; then
  echo "==> Could not read CNAME target from domain association. Add CNAME manually in Route 53 for $FULL_DOMAIN"
  exit 0
fi
# Amplify returns "program CNAME <pending>" until domain/cert is ready; wait briefly then retry
WAIT_MAX=10
WAIT_SEC=30
while [[ "$CNAME_TARGET" == *"pending"* || "$CNAME_TARGET" == *" "* ]]; do
  if [[ $WAIT_MAX -le 0 ]]; then
    echo "==> Domain association still pending after ${WAIT_SEC}s x 10. Re-run later to update Route 53: ./scripts/deploy-amplify.sh"
    exit 0
  fi
  echo "==> CNAME target not ready yet. Waiting ${WAIT_SEC}s ($WAIT_MAX retries left)..."
  sleep "$WAIT_SEC"
  DOMAIN_DATA=$(aws amplify get-domain-association --app-id "$APP_ID" --domain-name "$DOMAIN_ROOT" --output json 2>/dev/null || true)
  CNAME_TARGET=$(echo "$DOMAIN_DATA" | jq -r ".domainAssociation.subDomains[] | select(.subDomainSetting.prefix==\"$SUBDOMAIN_PREFIX\") | .dnsRecord")
  WAIT_MAX=$((WAIT_MAX - 1))
done
if [[ -z "$CNAME_TARGET" || "$CNAME_TARGET" == "null" ]]; then
  echo "==> Could not get CNAME target. Add CNAME manually in Route 53 for $FULL_DOMAIN"
  exit 0
fi
# Amplify may return "prefix CNAME target" or just "target"; use only the hostname for Route53
if [[ "$CNAME_TARGET" == *" CNAME "* ]]; then
  CNAME_TARGET="${CNAME_TARGET#* CNAME }"
  CNAME_TARGET="${CNAME_TARGET%% *}"
fi
[[ "$CNAME_TARGET" != *\. ]] && CNAME_TARGET="${CNAME_TARGET}."

if [[ -n "${HOSTED_ZONE_ID:-}" ]]; then
  ZONE_ID="$HOSTED_ZONE_ID"
else
  ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN_ROOT}.'].Id" --output text | tr -d '\r')
  if [[ -z "$ZONE_ID" ]]; then
    echo "==> Route 53 hosted zone for $DOMAIN_ROOT not found. Add CNAME manually:"
    echo "    Name: $FULL_DOMAIN"
    echo "    Type: CNAME"
    echo "    Value: $CNAME_TARGET"
    exit 0
  fi
  ZONE_ID="${ZONE_ID#/hostedzone/}"
fi

echo "==> Adding CNAME in Route 53 (zone $ZONE_ID): $FULL_DOMAIN -> $CNAME_TARGET"
# CNAME record name must end with a dot in Route 53 JSON if FQDN
NAME="$FULL_DOMAIN"
[[ "$NAME" != *\. ]] && NAME="${NAME}."
TMP=$(mktemp)
cat <<EOF > "$TMP"
{
  "Comment": "Amplify custom domain $FULL_DOMAIN",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$NAME",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "$CNAME_TARGET"}]
      }
    }
  ]
}
EOF
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "file://$TMP"
rm -f "$TMP"
echo "==> Done. https://$FULL_DOMAIN will work after DNS and Amplify certificate propagation (often 5–15 min)."
