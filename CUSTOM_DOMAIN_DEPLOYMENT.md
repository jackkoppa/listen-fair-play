# Custom Domain Deployment Guide

This guide walks you through the **two-step process** to set up your custom domain `listenfairplay.com` with SSL certificate validation.

## Why Two Steps?

Since you're using Namecheap for DNS (not AWS Route53), we can't automatically validate the SSL certificate. We need to:
1. **Step 1**: Create the certificate and get DNS validation records
2. **Manual Step**: Add DNS records in Namecheap
3. **Step 2**: Enable the custom domain on CloudFront after certificate validation

## Step 1: Initial Deployment (Create Certificate)

The current configuration is set up for Step 1 with `enable_custom_domain_on_cloudfront = false`.

### 1.1 Deploy Infrastructure
```bash
./scripts/deploy/deploy.sh dev
```

This will:
- Create the SSL certificate in AWS Certificate Manager
- Keep CloudFront using the default certificate (no custom domain yet)
- Output the DNS validation records you need

### 1.2 Check the Outputs
After deployment, look for these outputs:
```bash
cd terraform
terraform output certificate_validation_records
terraform output dns_instructions
```

You'll see something like:
```json
{
  "listenfairplay.com" = {
    "name" = "_abc123def456.listenfairplay.com"
    "type" = "CNAME"
    "value" = "_xyz789.acm-validations.aws."
  }
}
```

## Step 2: Configure DNS in Namecheap

### 2.1 Add Certificate Validation Record
1. Log into Namecheap
2. Go to "Domain List" → "Manage" for `listenfairplay.com`
3. Go to "Advanced DNS" tab
4. Add a new CNAME record:
   - **Type**: CNAME Record
   - **Host**: `_abc123def456` (the part before .listenfairplay.com from the output)
   - **Value**: `_xyz789.acm-validations.aws.` (the full value from output)
   - **TTL**: 1 min

### 2.2 Wait for Certificate Validation
- Wait 5-10 minutes for DNS propagation
- Check certificate status in AWS Console (Certificate Manager in us-east-1)
- Wait until status shows "Issued"

## Step 3: Enable Custom Domain (Second Deployment)

### 3.1 Update Configuration
Edit `terraform/environments/dev.tfvars`:
```hcl
enable_custom_domain_on_cloudfront = true
```

### 3.2 Deploy Again
```bash
./scripts/deploy/deploy.sh dev
```

This will:
- Update CloudFront to use your custom domain
- Configure the SSL certificate
- Update CORS settings

### 3.3 Add Main Domain Record in Namecheap
After the second deployment completes, add the main domain record:

1. In Namecheap "Advanced DNS" for `listenfairplay.com`
2. Add a new CNAME record:
   - **Type**: CNAME Record  
   - **Host**: `@` (for root domain)
   - **Value**: `drvuopx7zxbrt.cloudfront.net` (your CloudFront domain from output)
   - **TTL**: 5 min

## Step 4: Test Your Domain

Wait 5-15 minutes for DNS propagation, then visit:
- `https://listenfairplay.com`

## Current Status Check

You can check where you are in the process:

```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Check current CloudFront aliases
aws cloudfront get-distribution --id <your-distribution-id> | grep -A5 Aliases

# Test DNS resolution
nslookup listenfairplay.com
```

## Troubleshooting

### Certificate Still Pending
- Verify the CNAME record in Namecheap exactly matches the validation output
- Wait up to 30 minutes for validation
- Check for typos in the DNS record

### CloudFront Error After Step 3
- Ensure certificate shows "Issued" status before Step 3
- If it fails, set `enable_custom_domain_on_cloudfront = false` and redeploy to rollback

### Domain Not Resolving
- DNS changes can take up to 48 hours
- Use online DNS checker tools to verify propagation
- Try from different networks/devices

## Files Modified

The configuration now includes:
- `enable_custom_domain_on_cloudfront` variable for controlled deployment
- Conditional certificate and domain configuration
- Safe rollback capability

## Next Steps After Success

Once working:
- Consider adding `www.listenfairplay.com` as an additional domain
- Monitor certificate auto-renewal (AWS handles this automatically)
- Update any hardcoded URLs in your application to use the custom domain 