import asyncio
import logging
from backend.services.email_service import EmailService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_mailgun():
    logger.info("📨Testing MailGun Email Service")
    email_service = EmailService()
    to_email = "jumah@sadaora.com"
    subject = "MailGun TEST"
    body = "This is a test email from Sadaora backend self-test script."
    result = await email_service.send_email_verification_otp(to_email, subject, body)
    if result:
        logger.info("✅ Mailgun test email sent successfully")
    else:
        logger.info("❌ Mailgun email failed")

async def test_mailgun_2():
    logger.info("📨Testing MailGun Password Reset OTP")
    email_service = EmailService()
    to_email = "jumah@sadaora.com"
    subject = "Password Reset OTP"
    body = "This is a test password reset email from Sadaora backend."
    result = await email_service.send_password_reset_otp(to_email, subject, body)
    if result:
        logger.info("✅ Mailgun test 2 email sent successfully")
    else:
        logger.info("❌ Mailgun email 2 failed")

async def main():
    await test_mailgun()
    await test_mailgun_2()

if __name__ == "__main__":
    asyncio.run(main())
