# DNS Setup Guide for listenfairplay.com

This guide will help you configure your custom domain `listenfairplay.com` to work with your CloudFront distribution.

## Overview

Your Terraform configuration now includes:
- SSL certificate creation in AWS Certificate Manager (ACM)
- CloudFront distribution configured with custom domain alias
- Automatic DNS validation record outputs

## Step-by-Step DNS Configuration

### Step 1: Deploy the Infrastructure
Run your deployment script:
```bash
./scripts/deploy/deploy.sh dev
```

### Step 2: Get DNS Validation Records
After deployment, Terraform will output the DNS records you need to add. Look for:
- `certificate_validation_records` - Contains the CNAME record for SSL certificate validation
- `dns_instructions` - Contains user-friendly instructions

### Step 3: Add Certificate Validation Record in Namecheap

1. Log into your Namecheap account
2. Go to "Domain List" and click "Manage" next to `listenfairplay.com`
3. Go to the "Advanced DNS" tab
4. Add a new CNAME record using the values from `certificate_validation_records`:
   - **Type**: CNAME Record
   - **Host**: The `name` value from the validation output (usually something like `_abc123.listenfairplay.com`)
   - **Value**: The `value` from the validation output (usually ends with `.acm-validations.aws.`)
   - **TTL**: 1 min (for faster validation)

### Step 4: Wait for Certificate Validation
- Certificate validation typically takes 5-10 minutes
- You can check the status in the AWS Console under Certificate Manager
- Look for status "Issued"

### Step 5: Add Main Domain Record
Once the certificate is validated, add the main domain record:

1. In Namecheap's "Advanced DNS" for `listenfairplay.com`
2. Add a new CNAME record:
   - **Type**: CNAME Record
   - **Host**: `@` (for the root domain) or `www` if you prefer www.listenfairplay.com
   - **Value**: Your CloudFront domain (e.g., `drvuopx7zxbrt.cloudfront.net`)
   - **TTL**: 5 min

### Step 6: Test Your Custom Domain
- Wait 5-15 minutes for DNS propagation
- Visit `https://listenfairplay.com`
- You should see your website served securely with your custom domain

## Troubleshooting

### Certificate Validation Stuck
- Double-check the CNAME record in Namecheap matches exactly
- Ensure there are no typos in the record name or value
- Try setting TTL to 1 minute for faster propagation

### Domain Not Resolving
- DNS changes can take up to 48 hours to fully propagate
- Use `nslookup listenfairplay.com` to check DNS resolution
- Try accessing from different networks or use online DNS checker tools

### SSL Certificate Issues
- Ensure the certificate shows as "Issued" in AWS Certificate Manager
- Clear your browser cache and try in an incognito window

## Important Notes

- The SSL certificate is automatically managed by AWS
- Certificate renewal is handled automatically by AWS
- Your CloudFront distribution will continue to work with both the custom domain and the original CloudFront domain
- CORS is configured to allow requests from both domains

## Current Configuration

- **Custom Domain**: `listenfairplay.com`
- **Environment**: `dev`
- **SSL Certificate**: Auto-provisioned via AWS Certificate Manager
- **CDN**: CloudFront with global edge locations
- **DNS Provider**: Namecheap (manual configuration required) 