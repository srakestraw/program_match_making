#!/usr/bin/env bash
# Deploy widget to AWS Amplify and add custom domain program.gravytylabs.com (CNAME in Route 53).
# Prerequisites: AWS CLI configured, pnpm, curl.
# Usage:
#   ./scripts/deploy-amplify.sh
#   APP_ID=dxxx HOSTED_ZONE_ID=Zxxx ./scripts/deploy-amplify.sh   # skip create, use existing app/zone

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="${APP_NAME:-pmm-widget}"
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
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --enable-auto-build false
  echo "==> Created branch: $BRANCH_NAME"
else
  echo "==> Branch $BRANCH_NAME exists"
fi

# --- SPA rewrite: serve index.html for all paths (so /widget, /widget/results work)
echo "==> Setting SPA redirect rules..."
aws amplify update-app --app-id "$APP_ID" --custom-rules '[{"source":"/<*>","status":"200","target":"/index.html"}]' --output json > /dev/null

# --- Build widget
echo "==> Building widget..."
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

# --- Custom domain: associate program.gravytylabs.com with main branch
echo "==> Associating domain $DOMAIN_ROOT with subdomain $SUBDOMAIN_PREFIX -> $BRANCH_NAME"
aws amplify create-domain-association \
  --app-id "$APP_ID" \
  --domain-name "$DOMAIN_ROOT" \
  --sub-domain-settings "[{\"prefix\":\"$SUBDOMAIN_PREFIX\",\"branchName\":\"$BRANCH_NAME\"}]" \
  --output json 2>/dev/null || aws amplify update-domain-association \
  --app-id "$APP_ID" \
  --domain-name "$DOMAIN_ROOT" \
  --sub-domain-settings "[{\"prefix\":\"$SUBDOMAIN_PREFIX\",\"branchName\":\"$BRANCH_NAME\"}]" \
  --output json

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
