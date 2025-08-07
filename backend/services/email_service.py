import aiosmtplib
from email.mime.text import MIMEText
import os

class Email_Service:
    async def send_password_rest_otp(self, to_email: str, otp: str, valid_time: int):
        
        body = f"""

    Hey,

    How's your day going?, We see your having a little technical difficulty.

    You requested a password reset for your {os.getenv('APP_Name')} account.

    If you have not requested this password, you can just ignore this message. 

    ⚠️ This password is only valid for the next {valid_time} minutes. 
     
    As a precaution,
    You should not share this email with anyone. {os.getenv('APP_Name')} or any of it's affiliates will never ask you to give or share this password with anyone. 

    Stay Safe, 
    {os.getenv('APP_Name')} security team. 
