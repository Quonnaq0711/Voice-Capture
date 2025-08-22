import asyncio
import logging
import os
import requests
from backend.services.email_service import EmailService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_mailgun():
    logger.info("📨Testing MailGun Email Service")
    email_service = EmailService()
    to_email = "shaquonna@sadaora.com"
    subject = "MailGun TEST"
    body = "This is a test email from Sadaora backend self-test script."
    
    try:
        result = await email_service.send_email_verification_otp(to_email, subject, body)
        if result:
            logger.info("✅ Mailgun test email sent successfully")
        else:
            logger.info("❌ Mailgun email failed")
    except Exception as e:
        logger.error(f"❌ Mailgun test failed with exception: {e}")

async def test_mailgun_2():
    logger.info("📨Testing MailGun Password Reset OTP")
    email_service = EmailService()
    to_email = "shaquonna@sadaora.com"
    subject = "Password Reset OTP"
    body = "This is a test password reset email from Sadaora backend."
    
    try:
        result = await email_service.send_password_reset_otp(to_email, subject, body)
        if result:
            logger.info("✅ Mailgun test 2 email sent successfully")
        else:
            logger.info("❌ Mailgun email 2 failed")
    except Exception as e:
        logger.error(f"❌ Mailgun test 2 failed with exception: {e}")

def test_api_key_and_domain():
    """Test API key and domain configuration"""
    logger.info("🔑 Testing API Key and Domain Configuration")
    
    api_key = os.getenv('MAILGUN_API_KEY') or os.getenv('API_KEY')
    if not api_key or api_key == 'API_KEY':
        logger.error("❌ API_KEY environment variable not set or using placeholder value")
        return False
    
    logger.info(f"API Key found: {api_key[:10]}...")
    
    # Test domain access - try both domains
    domains_to_test = ['mg.sadaora.com', 'sadaora.com']
    
    for domain in domains_to_test:
        logger.info(f"🌐 Testing domain: {domain}")
        try:
            response = requests.get(
                f"https://api.mailgun.net/v3/domains/{domain}",
                auth=("api", api_key),
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Domain {domain} is accessible and verified")
                domain_info = response.json()
                logger.info(f"Domain state: {domain_info.get('domain', {}).get('state', 'unknown')}")
                return domain
            elif response.status_code == 401:
                logger.error(f"❌ 401 Unauthorized for domain {domain} - Check API key")
            elif response.status_code == 404:
                logger.error(f"❌ 404 Not Found for domain {domain} - Domain not configured")
            else:
                logger.error(f"❌ HTTP {response.status_code} for domain {domain}: {response.text}")
                
        except requests.RequestException as e:
            logger.error(f"❌ Request failed for domain {domain}: {e}")
    
    return None

def send_simple_message():
    """Send a simple test message using requests directly"""
    logger.info("📤 Sending simple test message via direct API call")
    
    api_key = os.getenv('MAILGUN_API_KEY') or os.getenv('API_KEY')
    if not api_key or api_key == 'API_KEY':
        logger.error("❌ API_KEY not properly configured")
        return None
    
    # Use the working domain from the test above
    working_domain = test_api_key_and_domain()
    if not working_domain:
        logger.error("❌ No working domain found, cannot send test message")
        return None
    
    try:
        response = requests.post(
            f"https://api.mailgun.net/v3/{working_domain}/messages",
            auth=("api", api_key),
            data={
                "from": f"Mailgun Test <postmaster@{working_domain}>",
                "to": "Quonna Williams <shaquonna@sadaora.com>",
                "subject": "Hello Quonna Williams - Direct API Test",
                "text": "Congratulations Quonna Williams, you just sent an email with Mailgun! You are truly awesome!",
                "html": "<html><body><h1>Success!</h1><p>This email was sent directly via the Mailgun API.</p></body></html>"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info("✅ Direct API test message sent successfully")
            result = response.json()
            logger.info(f"Message ID: {result.get('id', 'unknown')}")
            return result
        else:
            logger.error(f"❌ Direct API test failed: HTTP {response.status_code}")
            logger.error(f"Response: {response.text}")
            return None
            
    except requests.RequestException as e:
        logger.error(f"❌ Direct API test failed with exception: {e}")
        return None

def check_environment():
    """Check environment configuration"""
    logger.info("🔍 Checking Environment Configuration")
    
    env_vars = ['MAILGUN_API_KEY', 'API_KEY', 'MAILGUN_DOMAIN']
    for var in env_vars:
        value = os.getenv(var)
        if value:
            if 'KEY' in var:
                logger.info(f"{var}: {value[:10]}...")
            else:
                logger.info(f"{var}: {value}")
        else:
            logger.warning(f"{var}: Not set")

async def main():
    logger.info("🚀 Starting MailGun Test Suite")
    logger.info("=" * 50)
    
    # Check environment first
    check_environment()
    logger.info("=" * 50)
    
    # Test API key and domain access
    working_domain = test_api_key_and_domain()
    logger.info("=" * 50)
    
    if working_domain:
        # Test direct API call
        send_simple_message()
        logger.info("=" * 50)
        
        # Test EmailService methods
        await test_mailgun()
        logger.info("=" * 50)
        await test_mailgun_2()
    else:
        logger.error("❌ Cannot proceed with EmailService tests - no working domain found")
    
    logger.info("🏁 Test Suite Complete")

if __name__ == "__main__":
    asyncio.run(main())