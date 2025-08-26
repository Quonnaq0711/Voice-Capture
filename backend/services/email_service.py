from dotenv import load_dotenv
import os
import aiohttp
import asyncio
import logging
from typing import Optional

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        # Validate MailGun configuration on initialization
        self.validate_mailgun_config()
        self.mailgun_api_key = os.getenv('MAILGUN_API_KEY')
        self.mailgun_domain = os.getenv('MAILGUN_DOMAIN')
        self.mailgun_base_url = f"https://api.mailgun.net/v3/{self.mailgun_domain}"
        self.app_name = os.getenv('APP_NAME')
        self.from_email = os.getenv('FROM_EMAIL') or f"postmaster@{self.mailgun_domain}"
    
    def validate_mailgun_config(self):
        required_vars = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'APP_NAME']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            raise ValueError(f"Missing required MailGun environment variables: {', '.join(missing_vars)}")
        
        logger.info(f"MailGun configured - Domain: {os.getenv('MAILGUN_DOMAIN')}")

    async def send_email_via_mailgun(self, to_email: str, subject: str, html_content: str, text_content: str):
        """
        Send email via MailGun API
        """
        try:
            logger.info(f"Sending email via MailGun to: {to_email}")
            
            # Prepare the email data
            data = {
                'from': f"{self.app_name} Security Team <{self.from_email}>",
                'to': to_email,
                'subject': subject,
                'text': text_content,
                'html': html_content
            }
            
            # Send via MailGun API
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.mailgun_base_url}/messages",
                    auth=aiohttp.BasicAuth('api', self.mailgun_api_key),
                    data=data,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Email sent successfully via MailGun. Message ID: {result.get('id', 'Unknown')}")
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"MailGun API error {response.status}: {error_text}")
                        raise Exception(f"MailGun API error: {response.status} - {error_text}")
                        
        except asyncio.TimeoutError:
            logger.error("MailGun API timeout")
            raise Exception("Email sending timed out. Please try again.")
        except Exception as e:
            logger.error(f"Failed to send email via MailGun: {str(e)}")
            raise Exception(f"Failed to send email: {str(e)}")

    async def send_password_reset_otp(self, to_email: str, otp: str, valid_time: int):
        """
        Send password reset OTP email
        """
        try:
            logger.info(f"Sending password reset OTP to: {to_email}")
            
            subject = f"🔒 Your {self.app_name} Password Reset Verification Code"
            
            # Text version
            text_content = f"""
Hey,

How's your day going? We see you're having a little technical difficulty.

You requested a password reset for your {self.app_name} account.

Here's your one-time Password (OTP): {otp}

If you have not requested this password, you can just ignore this message.

⚠️ This password is only valid for the next {valid_time} minutes.

As a precaution, you should not share this email with anyone. {self.app_name} or any of its affiliates will never ask you to give or share this password with anyone.

Stay Safe,
{self.app_name} Security Team
"""

            # HTML version 
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center; }}
        .otp {{ background-color: #007bff; color: white; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 5px; margin: 20px 0; }}
        .warning {{ background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; font-size: 14px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Password Reset Request</h2>
        </div>
        
        <p>Hey,</p>
        <p>How's your day going? We see you're having a little technical difficulty.</p>
        <p>You requested a password reset for your <strong>{self.app_name}</strong> account.</p>
        
        <p>Here's your OTP :</p>
        <div class="otp">{otp}</div>
        
        <div class="warning">
            <p>⚠️ <strong>Important:</strong> This code is only valid for the next {valid_time} minutes.</p>
        </div>
        
        <p>If you have not requested this password reset, you can safely ignore this message.</p>
        
        <div class="footer">
            <p>As a precaution, you should not share this email with anyone. {self.app_name} or any of its affiliates will never ask you to give or share this password with anyone.</p>
            <p>Stay Safe,<br>{self.app_name} Security Team</p>
        </div>
    </div>
</body>
</html>
"""

            return await self.send_email_via_mailgun(to_email, subject, html_content, text_content)
            
        except Exception as e:
            logger.error(f"Failed to send password reset OTP: {str(e)}")
            raise

    async def send_email_verification_otp(self, to_email: str, otp: str, valid_time: int):
        """
        Send email verification OTP
        """
        try:
            logger.info(f"Sending email verification OTP to: {to_email}")
            
            subject = f"🔒 Your {self.app_name} Email Verification Code"
            
            # Text version
            text_content = f"""
Hello there!

How's your day going? We see you signed up for a new {self.app_name} account.

WELCOME!!

Here's your one-time Password (OTP): {otp}

If you have not created an account, you can safely ignore this message.

⚠️ This code is only valid for the next {valid_time} minutes.

As a precaution, you should not share this email with anyone. {self.app_name} or any of its affiliates will never ask you to give or share this password with anyone.

Stay Safe,
{self.app_name} Security Team
"""

            # HTML version
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }}
        .otp {{ background-color: #28a745; color: white; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 5px; margin: 20px 0; }}
        .warning {{ background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; font-size: 14px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Welcome to {self.app_name}!</h2>
        </div>
        
        <p>Hello there!</p>
        <p>How's your day going? We see you signed up for a new <strong>{self.app_name}</strong> account.</p>
        
        <p>Here's your one-time Password (OTP):</p>
        <div class="otp">{otp}</div>
        
        <div class="warning">
            <p>⚠️ <strong>Important:</strong> This code is only valid for the next {valid_time} minutes.</p>
        </div>
        
        <p>If you have not created an account, you can safely ignore this message.</p>
        
        <div class="footer">
            <p>As a precaution, you should not share this email with anyone. {self.app_name} or any of its affiliates will never ask you to give or share this password with anyone.</p>
            <p>Stay Safe,<br>{self.app_name} Security Team</p>
        </div>
    </div>
</body>
</html>
"""

            return await self.send_email_via_mailgun(to_email, subject, html_content, text_content)
            
        except Exception as e:
            logger.error(f"Failed to send email verification OTP: {str(e)}")
            raise